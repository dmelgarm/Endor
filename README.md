# Endor

A tool to **load, visualize, edit, and save logic trees for probabilistic tsunami
hazard analysis (PTHA)**. JSON is the source of truth for loading, visualizing, and
saving. Designed to handle very complex (deep, wide) trees.

## What a PTHA logic tree is

A weighted epistemic-uncertainty hierarchy. Each **node** is a branch point — one
choice over a `parameter` (source geometry, Mmax, scaling relation, rigidity,
recurrence model, …). Each **branch** carries a `weight`, a selected `value`, and an
optional child node. A branch with no child is a leaf. One root→leaf path is a model
**realization** whose weight is the product of its branch weights. Sibling weights
must sum to 1 at every branch point.

## Rupture names

A branch may also carry a short `code`, and the tree a top-level `naming` block
(`separator`, optional `prefix`/`suffix`). A leaf's **rupture name** is then the
ordered join of the `code`s along its root→leaf path — e.g. `DOGAMI-Aexp-B-D-DnS-L-AC`.
This keeps the naming convention *in the tree* (each choice owns its token), so names
stay correct as you edit and derive automatically in the viewer and in exports. Codes
are the natural fit for conventions like DOGAMI O-24-11, where the same value maps to
different tokens depending on the path. The viewer shows the derived name on each leaf,
and the Inspector previews it live as you type codes.

## Layout

```
schema/logic-tree.schema.json   JSON Schema — the single source of truth for the format
examples/                       simple.tree.json, cascadia.tree.json (illustrative),
                                cascadia_dnr.tree.json (~2,971-leaf hand-drawn tree),
                                cascadia_sources.tree.json (3,502 ruptures, CSV-derived)
web/                            Vite + React + TypeScript app
pyendor/                        Python companion package (same JSON format)
```

## Web app (`web/`)

Local-first: load and save real `.json` files via the File System Access API — no
backend, nothing leaves your machine.

- **Stack:** Vite + React + TypeScript, React Flow (`@xyflow/react`) canvas,
  `@dagrejs/dagre` top-down auto-layout, Zod runtime validation, Zustand state.
- **Source of truth** is the nested `LogicTreeFile` in the Zustand store
  (`web/src/store.ts`). The React Flow graph is a one-way projection derived from it
  (`web/src/model/graph.ts`) with **path-based node ids** (`root`, `root/0`,
  `root/0/1`) so identity/collapse/layout survive edits.
- **Editing:** the Inspector panel supports rename parameter/label; add/delete/reorder
  branches; edit weights & values; grow/prune subtrees; a live sum-to-1 check with
  "Normalize to 1"; selected-node highlight; dirty tracking; and save in place.

### Navigating large trees

Complex trees (thousands of leaf realizations) stay manageable:

- **Smart loading** — trees above ~60 leaves open collapsed to depth 2, so you land on
  the top-level choices instead of the whole tree. Smaller trees open fully expanded.
- **Depth stepper** — expand the entire tree to an exact depth; **Collapse all** /
  **Expand all** for the extremes. Per-node `+`/`–` badges collapse a single subtree and
  show how many realizations are hidden beneath it.
- **Focus mode ("view only this branch")** — double-click any branch point (or use the
  Inspector button) to isolate its subtree; the view recenters on it and a breadcrumb
  pill returns you to the full tree. Cumulative leaf weights still reflect the full path
  from the true root, so hazard weights read correctly while zoomed in.

### Run

```bash
npm --prefix web install   # first time only
npm --prefix web run dev    # → http://localhost:5173
```

### Build / typecheck

```bash
npm --prefix web run build
```

## Python companion (`pyendor/`)

Reads and writes the identical JSON format, so trees authored in the GUI drop straight
into a tsunami-hazard pipeline.

- `endor.LogicTree`: `load` / `save`, `realizations()` (generator of weighted root→leaf
  paths, each with its derived rupture `name`), `count_realizations()`.
- `endor.validate`: checks sibling weight sums.
- `endor.from_name_csv`: build an exact tree from a CSV of coded rupture names. Each
  token becomes a branch `code`; conditional weights are reconstructed from the CSV
  weights (siblings sum to 1); extra columns (Mw, Mo, …) ride on each leaf's `value`.
  Re-deriving each leaf's name reproduces its CSV name exactly.
- `endor.group_sources`: nest flat top-level codes into named groups (e.g. Whole
  margin / Partial), re-normalizing within each group; unlisted codes are parked under
  an "others" node at a given weight (default 0).

### Import a CSV of rupture names

```python
from endor import from_name_csv, group_sources

flat = from_name_csv("source_weights_Mw_Mo.csv")   # columns: Run_Name, Weight, Mw, Mo
tree = group_sources(flat, [
    {"label": "Whole margin", "parameter": "slip_model", "weight": 0.5,
     "members": ["DOGAMI", "USGS", "USGSclusters"]},
    {"label": "Partial", "parameter": "rupture_style", "weight": 0.5,
     "members": ["Segmented", "Floating"]},
])
tree.save("cascadia_sources.tree.json")
```

### Test

```bash
cd pyendor && PYTHONPATH=. python3 -m pytest -q
```

## Status

- **Phase 1 (done):** schema + Zod types + examples; load → dagre auto-layout → render
  → collapse/expand → save. Python companion with load/validate/enumerate.
- **Phase 2 (done):** interactive editing via the Inspector — rename, add/delete/reorder
  branches, edit weights & values, grow/prune subtrees, live sum-to-1 check +
  "Normalize to 1", selected-node highlight, dirty tracking, save in place.
- **Big-tree ergonomics (done):** smart depth-based loading, collapse/expand all + depth
  stepper, collapsed leaf-count badges, and focus mode. See the prioritized backlog in
  `CLAUDE.md` (skip relayout on non-structural edits, search/jump, cumulative-weight
  badges, epistemic-vs-aleatory node kind).
- **Rupture names (done):** per-branch `code` + tree `naming`; derived rupture names
  shown on leaves and previewed live in the Inspector. Python `from_name_csv` /
  `group_sources` build an exact tree from a coded-name CSV (see `cascadia_sources.tree.json`).
- **Phase 3 (planned):** enumerate-paths panel in the UI + export weighted realizations
  (CSV/JSON). Enumeration logic already exists in `web/src/ops/operations.ts`
  (`enumerate`) and `pyendor/endor/tree.py` (`realizations`).
- **Phase 4 (planned):** load two trees side by side and diff structure + weights.
- **Later:** `$ref`-style subtree reuse for the common PTHA case where the same
  sub-logic-tree repeats under every source (keeps complex trees DRY).
