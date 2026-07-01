"""Build a logic tree from a CSV of coded rupture names.

Each rupture name is the ordered join of branch codes along a root-to-leaf path
(see the Endor naming convention). This importer tokenizes those names into a
trie: every token becomes a branch ``code`` at its depth, and the CSV row's
weight plus any extra columns (Mw, Mo, …) ride on the leaf. Conditional branch
weights are reconstructed from the leaf weights so that siblings sum to 1 and a
leaf's cumulative weight equals its CSV weight (up to the overall normalization).

The result is exact: every leaf is a real rupture, and re-deriving each leaf's
name reproduces the original CSV name.
"""

from __future__ import annotations

import csv
from pathlib import Path
from typing import Any

from .tree import LogicTree, Node, Branch

# Best-effort human labels for a node, keyed by the SET of its children's codes.
# Correctness (codes/weights/names) does not depend on these — they only make the
# generated tree readable. A node whose children don't match any signature gets a
# generic label. Signatures are matched by subset, so partial choice sets still hit.
_SIGNATURES: list[tuple[frozenset[str], str, str]] = [
    (frozenset({"UpS", "Sym", "DnS"}), "shape", "Shape"),
    (frozenset({"T", "L", "M"}), "termination_at_depth", "Termination at depth"),
    (frozenset({"D", "S"}), "deep_or_shallow", "Deep or shallow"),
    (frozenset({"B", "Sb", "Sd", "T50", "T100"}), "buried_splay_or_trench",
     "Buried / Splay / Trench break"),
    (frozenset({"U", "AN", "AC", "AS", "A1", "A2", "A3", "A4", "A5", "U3", "U5"}),
     "event_slip_distribution", "Event slip distribution"),
    (frozenset({"Aexp", "A", "Bs", "Bm", "Bl", "Cs", "Cm", "Cl", "Cps", "Cpm", "Cpl",
                "Ds", "Dm", "Dl", "Fs", "Fm", "Fl"}), "rupture_length_model",
     "Rupture / length model"),
    (frozenset({"DOGAMI", "USGS", "USGSclusters", "Segmented", "Floating",
                "Variable", "noSeaVerg"}), "source_model", "Source model"),
]


def _classify(codes: set[str], depth: int) -> tuple[str, str]:
    """Best-effort (parameter, label) for a node from its children's codes."""
    for sig, param, label in _SIGNATURES:
        if codes <= sig:
            return param, label
    if codes and all(c[:1] == "E" and c[1:].isdigit() for c in codes):
        return "floating_source", "Floating source"
    if codes and all(c.isdigit() for c in codes):
        return "cluster_part", "Cluster part"
    return f"level_{depth}", f"Level {depth}"


class _TrieNode:
    __slots__ = ("children", "leaf", "weightsum")

    def __init__(self) -> None:
        self.children: dict[str, _TrieNode] = {}
        self.leaf: dict[str, Any] | None = None
        self.weightsum: float = 0.0


def from_name_csv(
    csv_path: str | Path,
    *,
    name_col: str = "Run_Name",
    weight_col: str = "Weight",
    extra_cols: tuple[str, ...] = ("Mw", "Mo"),
    separator: str = "-",
    suffix: str = "-result_trimmed",
    metadata: dict[str, Any] | None = None,
) -> LogicTree:
    """Construct a :class:`LogicTree` from a CSV of coded rupture names.

    Raises ``ValueError`` if a name is a strict prefix of another (which would
    force a branch to be both a leaf and a parent — invalid for a tree).
    """
    root = _TrieNode()

    with open(csv_path, newline="", encoding="utf-8") as fh:
        for row in csv.DictReader(fh):
            name = row[name_col]
            core = name[: -len(suffix)] if suffix and name.endswith(suffix) else name
            tokens = core.split(separator)
            weight = float(row[weight_col])
            extras = {k: _num(row[k]) for k in extra_cols if k in row}

            node = root
            node.weightsum += weight
            for j, tok in enumerate(tokens):
                child = node.children.get(tok)
                if child is None:
                    child = node.children[tok] = _TrieNode()
                child.weightsum += weight
                if j == len(tokens) - 1:
                    if child.children:
                        raise ValueError(f"name is a prefix of another: {name!r}")
                    child.leaf = {"weight": weight, **extras}
                elif child.leaf is not None:
                    raise ValueError(f"name is a prefix of another at {tok!r}: {name!r}")
                node = child

    total = root.weightsum or 1.0
    tree = _to_node(root.children, total, depth=1)

    meta = {"naming_convention": "coded rupture names"}
    meta.update(metadata or {})
    return LogicTree(
        tree=tree,
        metadata=meta,
        naming={"separator": separator, "suffix": suffix},
    )


def _to_node(children: dict[str, _TrieNode], parent_sum: float, depth: int) -> Node:
    branches: list[Branch] = []
    for code, entry in children.items():
        w = entry.weightsum / parent_sum if parent_sum else 0.0
        if entry.children:
            branches.append(
                Branch(weight=w, code=code, node=_to_node(entry.children, entry.weightsum, depth + 1))
            )
        else:
            # Leaf: carry the rupture's physical attributes as the branch value.
            branches.append(Branch(weight=w, code=code, value=dict(entry.leaf or {})))

    parameter, label = _classify(set(children), depth)
    return Node(parameter=parameter, label=label, branches=branches)


def _num(text: str) -> Any:
    """Parse a numeric CSV cell (incl. Fortran-style 0.1E+23); fall back to text."""
    try:
        return float(text)
    except (TypeError, ValueError):
        return text


def group_sources(
    lt: LogicTree,
    groups: list[dict[str, Any]],
    *,
    root_parameter: str = "rupture_extent",
    root_label: str = "Full or partial ruptures",
    others_label: str = "Alternates (unassigned)",
    others_weight: float = 0.0,
) -> LogicTree:
    """Reorganize a flat source tree by nesting top-level branch codes into groups.

    ``groups`` is an ordered list of dicts with keys ``label``, ``parameter``,
    ``node_label`` (optional), ``weight``, and ``members`` (top-level codes).
    Each group's members are re-normalized so their weights sum to 1 within the
    group. Any top-level code not listed lands under an "others" node carrying
    ``others_weight`` (default 0 — parked, its ruptures retain their attributes
    but contribute no probability until you assign a weight).

    Synthetic parent nodes carry no ``code``, so every leaf's derived rupture
    name is unchanged; only the cumulative weights shift.
    """
    top = {b.code: b for b in lt.tree.branches}

    def renorm(branches: list[Branch]) -> None:
        total = sum(b.weight for b in branches) or 1.0
        for b in branches:
            b.weight = b.weight / total

    new_branches: list[Branch] = []
    used: set[str] = set()
    for g in groups:
        members = []
        for code in g["members"]:
            if code not in top:
                raise ValueError(f"unknown top-level code in group {g['label']!r}: {code}")
            members.append(top[code])
            used.add(code)
        renorm(members)
        child = Node(parameter=g["parameter"], label=g.get("node_label"), branches=members)
        new_branches.append(Branch(weight=g["weight"], label=g["label"], node=child))

    others = [b for c, b in top.items() if c not in used]
    if others:
        renorm(others)
        child = Node(parameter="alternate_source", label=others_label, branches=others)
        new_branches.append(Branch(weight=others_weight, label=others_label, node=child))

    root = Node(parameter=root_parameter, label=root_label, branches=new_branches)
    return LogicTree(
        tree=root, metadata=lt.metadata, naming=lt.naming, schema_version=lt.schema_version
    )
