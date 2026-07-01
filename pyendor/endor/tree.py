"""Core logic-tree data model and operations.

The on-disk format is nested: a ``Node`` is a branch point over one
``parameter``; each ``Branch`` carries a weight, a selected value, and an
optional child ``Node``. A branch with no child is a leaf. A root-to-leaf
path is one model realization; its weight is the product of branch weights.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Iterator


@dataclass
class Branch:
    """One alternative of a branch point."""

    weight: float
    value: Any = None
    label: str | None = None
    code: str | None = None
    id: str | None = None
    node: "Node | None" = None

    @property
    def is_leaf(self) -> bool:
        return self.node is None

    @classmethod
    def from_dict(cls, d: dict) -> "Branch":
        child = d.get("node")
        return cls(
            weight=d["weight"],
            value=d.get("value"),
            label=d.get("label"),
            code=d.get("code"),
            id=d.get("id"),
            node=Node.from_dict(child) if child is not None else None,
        )

    def to_dict(self) -> dict:
        out: dict[str, Any] = {}
        if self.id is not None:
            out["id"] = self.id
        if self.label is not None:
            out["label"] = self.label
        if self.code is not None:
            out["code"] = self.code
        out["weight"] = self.weight
        if self.value is not None:
            out["value"] = self.value
        if self.node is not None:
            out["node"] = self.node.to_dict()
        return out


@dataclass
class Node:
    """A branch point: an epistemic choice over ``parameter``."""

    parameter: str
    branches: list[Branch] = field(default_factory=list)
    label: str | None = None
    id: str | None = None

    @classmethod
    def from_dict(cls, d: dict) -> "Node":
        return cls(
            parameter=d["parameter"],
            label=d.get("label"),
            id=d.get("id"),
            branches=[Branch.from_dict(b) for b in d.get("branches", [])],
        )

    def to_dict(self) -> dict:
        out: dict[str, Any] = {}
        if self.id is not None:
            out["id"] = self.id
        out["parameter"] = self.parameter
        if self.label is not None:
            out["label"] = self.label
        out["branches"] = [b.to_dict() for b in self.branches]
        return out


@dataclass
class Realization:
    """A single root-to-leaf path through the tree."""

    weight: float
    parameters: dict[str, Any]
    path: list[str]  # branch labels (or ids) traversed, root first
    name: str | None = None  # rupture name derived from branch codes, if any

    def __repr__(self) -> str:  # pragma: no cover - convenience only
        return f"Realization(weight={self.weight:.6g}, name={self.name!r})"


@dataclass
class LogicTree:
    """A complete logic tree with metadata."""

    tree: Node
    metadata: dict[str, Any] = field(default_factory=dict)
    naming: dict[str, Any] = field(default_factory=dict)
    schema_version: str = "1.0"

    # ---- I/O -------------------------------------------------------------
    @classmethod
    def from_dict(cls, d: dict) -> "LogicTree":
        return cls(
            tree=Node.from_dict(d["tree"]),
            metadata=d.get("metadata", {}),
            naming=d.get("naming", {}),
            schema_version=d.get("schemaVersion", "1.0"),
        )

    def to_dict(self) -> dict:
        out: dict[str, Any] = {"schemaVersion": self.schema_version}
        if self.metadata:
            out["metadata"] = self.metadata
        if self.naming:
            out["naming"] = self.naming
        out["tree"] = self.tree.to_dict()
        return out

    @classmethod
    def load(cls, path: str | Path) -> "LogicTree":
        with open(path, "r", encoding="utf-8") as fh:
            return cls.from_dict(json.load(fh))

    def save(self, path: str | Path, indent: int = 2) -> None:
        with open(path, "w", encoding="utf-8") as fh:
            json.dump(self.to_dict(), fh, indent=indent)
            fh.write("\n")

    # ---- Operations ------------------------------------------------------
    def realizations(self) -> Iterator[Realization]:
        """Yield every root-to-leaf realization with its combined weight.

        The number of realizations is the product of branch counts along each
        path, so this is a generator — a deep tree can produce a very large set.
        Each realization carries the rupture ``name`` derived from branch codes
        (or ``None`` when no code is present on its path).
        """
        yield from _walk(self.tree, 1.0, {}, [], [], self.naming)

    def count_realizations(self) -> int:
        """Total number of leaf paths without materializing them."""
        return _count(self.tree)


def _key(branch: Branch, index: int) -> str:
    return branch.label or branch.id or f"branch[{index}]"


def _format_name(codes: list[str], naming: dict[str, Any]) -> str | None:
    """Join branch codes into a rupture name, or None when there are no codes."""
    if not codes:
        return None
    sep = naming.get("separator", "-")
    return naming.get("prefix", "") + sep.join(codes) + naming.get("suffix", "")


def _walk(
    node: Node,
    weight: float,
    parameters: dict[str, Any],
    path: list[str],
    codes: list[str],
    naming: dict[str, Any],
) -> Iterator[Realization]:
    for i, branch in enumerate(node.branches):
        w = weight * branch.weight
        params = {**parameters, node.parameter: branch.value}
        p = path + [_key(branch, i)]
        c = codes + [branch.code] if branch.code else codes
        if branch.is_leaf:
            yield Realization(weight=w, parameters=params, path=p, name=_format_name(c, naming))
        else:
            yield from _walk(branch.node, w, params, p, c, naming)


def _count(node: Node) -> int:
    total = 0
    for branch in node.branches:
        total += 1 if branch.is_leaf else _count(branch.node)
    return total
