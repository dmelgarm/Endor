"""Endor — Python companion for PTHA logic trees.

Reads and writes the same JSON logic-tree format as the Endor web app
(see ``schema/logic-tree.schema.json``), so trees authored in the GUI drop
straight into a tsunami-hazard pipeline and vice versa.
"""

from .tree import Branch, LogicTree, Node, Realization
from .validate import ValidationIssue, validate

__all__ = [
    "LogicTree",
    "Node",
    "Branch",
    "Realization",
    "validate",
    "ValidationIssue",
]
