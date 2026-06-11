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

## Layout

```
schema/logic-tree.schema.json   JSON Schema — the single source of truth for the format
examples/                       simple.tree.json, cascadia.tree.json (illustrative)
web/                            Vite + React + TypeScript app
pyendor/                        Python companion package (same JSON format)
```

### Web app (`web/`)
- **Stack:** Vite + React + TS, React Flow (`@xyflow/react`) canvas, `@dagrejs/dagre`
  top-down auto-layout, Zod runtime validation, Zustand state. Local-first: load/save
  real `.json` files via the File System Access API — no backend, nothing leaves the machine.
- **Source of truth** is the nested `LogicTreeFile` in the Zustand store
  (`web/src/store.ts`). The React Flow graph is a one-way projection derived from it
  (`web/src/model/graph.ts`) with **path-based node ids** ("root", "root/0", "root/0/1")
  so identity/collapse/layout survive edits.
- Key files: `schema/logicTree.ts` (Zod), `model/graph.ts` (tree→graph),
  `model/edit.ts` (pure immutable edits), `layout/dagreLayout.ts`, `ops/operations.ts`
  (enumerate + validate), `io/files.ts` (load/save), `canvas/` (React Flow canvas,
  custom nodes, Inspector panel).
- **Run:** `npm --prefix web run dev` → http://localhost:5173
- **Build/typecheck:** `npm --prefix web run build`

### Python companion (`pyendor/`)
- `endor.LogicTree`: `load`/`save`, `realizations()` (generator of weighted root→leaf
  paths), `count_realizations()`; `endor.validate` checks weight sums.
- Reads/writes the identical JSON format so trees authored in the GUI drop straight
  into a tsunami-hazard pipeline.
- **Test:** `cd pyendor && PYTHONPATH=. python3 -m pytest -q` (4 tests, all passing)

## Status — built so far

- **Phase 1 (done):** schema + Zod types + examples; load → dagre auto-layout → render →
  collapse/expand → save. Python companion with load/validate/enumerate. Builds clean,
  Python tests pass.
- **Phase 2 (done):** interactive editing via the Inspector — rename parameter/label;
  add/delete/reorder branches; edit weights & values; grow/prune subtrees; live
  sum-to-1 check + "Normalize to 1"; selected-node highlight; dirty tracking; save in place.

## Next up

- **Phase 3 (not started):** enumerate-paths panel in the UI + export weighted
  realizations (CSV/JSON). The enumeration logic already exists in
  `web/src/ops/operations.ts` (`enumerate`) and `pyendor/endor/tree.py` (`realizations`)
  — Phase 3 is the UI + export on top.
- **Phase 4 (not started):** load two trees side by side and diff structure + weights.
- Later: `$ref`-style subtree reuse for the common PTHA case where the same
  sub-logic-tree repeats under every source (keeps complex trees DRY).

## Conventions

- Comments explain the numerics/intent, not implementation trivia. One attribution
  block per file at most.
