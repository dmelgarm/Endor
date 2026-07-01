from endor import from_name_csv, group_sources, validate


def _write_csv(path, rows):
    path.write_text("Run_Name,Weight,Mw,Mo\n" + "\n".join(rows) + "\n")


def test_from_name_csv_builds_exact_tree(tmp_path):
    csv = tmp_path / "runs.csv"
    _write_csv(
        csv,
        [
            "A-B-x-result_trimmed,0.5,8.1,1e22",
            "A-B-y-result_trimmed,0.25,8.2,2e22",
            "A-C-z-result_trimmed,0.25,8.3,3e22",
        ],
    )
    lt = from_name_csv(csv)

    # Valid tree: sibling weights sum to 1 everywhere.
    assert validate(lt) == []

    reals = list(lt.realizations())
    assert len(reals) == 3

    # Names round-trip exactly, including the stripped suffix.
    names = {r.name for r in reals}
    assert names == {
        "A-B-x-result_trimmed",
        "A-B-y-result_trimmed",
        "A-C-z-result_trimmed",
    }

    # Cumulative weights reproduce the CSV weights (they already sum to 1 here).
    by_name = {r.name: r.weight for r in reals}
    assert abs(by_name["A-B-x-result_trimmed"] - 0.5) < 1e-9
    assert abs(by_name["A-B-y-result_trimmed"] - 0.25) < 1e-9

    # Leaf carries physical attributes.
    leaf_x = next(r for r in reals if r.name.endswith("x-result_trimmed"))
    assert leaf_x.parameters  # populated
    # Mw/Mo stored on the leaf branch value.
    node_a = lt.tree.branches[0].node          # A
    node_b = node_a.branches[0].node           # B
    leaf_branch = node_b.branches[0]           # x
    assert leaf_branch.value["Mw"] == 8.1


def test_group_sources_nests_and_preserves_names(tmp_path):
    csv = tmp_path / "runs.csv"
    _write_csv(
        csv,
        [
            "DOGAMI-x-result_trimmed,0.52,8,1e22",
            "USGS-y-result_trimmed,0.48,8,1e22",
            "Segmented-z-result_trimmed,0.5,8,1e22",
            "Floating-w-result_trimmed,0.5,8,1e22",
            "Variable-v-result_trimmed,0.52,8,1e22",
        ],
    )
    grouped = group_sources(
        from_name_csv(csv),
        [
            {"label": "Whole margin", "parameter": "slip_model", "weight": 0.5,
             "members": ["DOGAMI", "USGS"]},
            {"label": "Partial", "parameter": "rupture_style", "weight": 0.5,
             "members": ["Segmented", "Floating"]},
        ],
    )
    assert validate(grouped) == []

    reals = list(grouped.realizations())
    # Grouping inserts code-less parents, so names are unchanged.
    assert {r.name for r in reals} >= {"DOGAMI-x-result_trimmed", "USGS-y-result_trimmed"}

    labels = [b.label for b in grouped.tree.branches]
    assert "Whole margin" in labels and "Alternates (unassigned)" in labels

    by = {r.name: r.weight for r in reals}
    # DOGAMI cumulative = 0.5 (Whole) * 0.52 (within-group renorm) = 0.26
    assert abs(by["DOGAMI-x-result_trimmed"] - 0.26) < 1e-9
    # Parked alternates contribute no probability.
    assert by["Variable-v-result_trimmed"] == 0.0


def test_from_name_csv_rejects_prefix_collision(tmp_path):
    csv = tmp_path / "runs.csv"
    _write_csv(csv, ["A-B-result_trimmed,0.5,8,1e22", "A-B-C-result_trimmed,0.5,8,1e22"])
    try:
        from_name_csv(csv)
    except ValueError:
        return
    raise AssertionError("expected ValueError on prefix collision")
