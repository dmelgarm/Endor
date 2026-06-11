import json
from pathlib import Path

import pytest

from endor import LogicTree, validate

EXAMPLES = Path(__file__).resolve().parents[2] / "examples"


def test_roundtrip_preserves_content():
    tree = LogicTree.load(EXAMPLES / "cascadia.tree.json")
    raw = json.loads((EXAMPLES / "cascadia.tree.json").read_text())
    assert tree.to_dict() == raw


def test_simple_realizations():
    tree = LogicTree.load(EXAMPLES / "simple.tree.json")
    reals = list(tree.realizations())
    # full -> {strasser, murotani} = 2 leaves, plus partial leaf = 3
    assert len(reals) == 3
    assert tree.count_realizations() == 3

    total_weight = sum(r.weight for r in reals)
    assert total_weight == pytest.approx(1.0)

    # Strasser path: 0.6 * 0.5
    strasser = next(r for r in reals if r.parameters.get("scaling_relation") == "strasser")
    assert strasser.weight == pytest.approx(0.3)


def test_examples_are_valid():
    for name in ("simple.tree.json", "cascadia.tree.json"):
        tree = LogicTree.load(EXAMPLES / name)
        assert validate(tree) == []


def test_validate_catches_bad_weights():
    tree = LogicTree.load(EXAMPLES / "simple.tree.json")
    tree.tree.branches[0].weight = 0.9  # siblings now sum to 1.3
    issues = validate(tree)
    assert any("sum to" in i.message for i in issues)
