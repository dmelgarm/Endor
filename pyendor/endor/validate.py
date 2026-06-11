"""Structural and semantic validation for logic trees.

Goes beyond JSON-Schema shape checks: verifies that sibling weights sum to 1
at every branch point, the property the schema cannot express on its own.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from .tree import LogicTree, Node

# Floating-point tolerance for weight sums.
WEIGHT_TOL = 1e-6


@dataclass
class ValidationIssue:
    """A single problem found in a tree."""

    path: str  # dotted location, e.g. "tree.branches[0].node"
    message: str
    severity: str = "error"  # "error" | "warning"

    def __str__(self) -> str:  # pragma: no cover - convenience only
        return f"[{self.severity}] {self.path}: {self.message}"


def validate(tree: "LogicTree") -> list[ValidationIssue]:
    """Return all issues found. An empty list means the tree is valid."""
    issues: list[ValidationIssue] = []
    _check_node(tree.tree, "tree", issues)
    return issues


def _check_node(node: "Node", path: str, issues: list[ValidationIssue]) -> None:
    if not node.branches:
        issues.append(ValidationIssue(path, "branch point has no branches"))
        return

    total = sum(b.weight for b in node.branches)
    if abs(total - 1.0) > WEIGHT_TOL:
        issues.append(
            ValidationIssue(
                path,
                f"branch weights sum to {total:.6g}, expected 1.0",
            )
        )

    for i, branch in enumerate(node.branches):
        bpath = f"{path}.branches[{i}]"
        if branch.weight < 0:
            issues.append(ValidationIssue(bpath, "weight is negative"))
        if branch.node is not None:
            _check_node(branch.node, f"{bpath}.node", issues)
