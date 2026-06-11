import { create } from "zustand";
import type { LogicTreeFile, NodeInput } from "./schema/logicTree";
import { buildGraph, type Graph } from "./model/graph";
import { layout } from "./layout/dagreLayout";
import { validateTree, type ValidationIssue } from "./ops/operations";
import { openTree, saveTree, type LoadedTree } from "./io/files";
import * as edit from "./model/edit";

type FileHandle = LoadedTree["handle"];

interface EndorState {
  tree: LogicTreeFile | null;
  fileName: string;
  handle: FileHandle;
  collapsed: Set<string>;
  selected: string | null; // selected branch-point node path
  dirty: boolean;
  graph: Graph;
  issues: ValidationIssue[];
  error: string | null;

  setTree: (loaded: LoadedTree) => void;
  open: () => Promise<void>;
  save: () => Promise<void>;
  toggleCollapse: (path: string) => void;
  expandAll: () => void;
  select: (path: string | null) => void;

  // Editing — each applies a pure edit to the current tree, re-derives, marks dirty.
  patchBranch: (nodePath: string, index: number, patch: Parameters<typeof edit.patchBranch>[3]) => void;
  patchNode: (nodePath: string, patch: Parameters<typeof edit.patchNode>[2]) => void;
  addBranch: (nodePath: string) => void;
  removeBranch: (nodePath: string, index: number) => void;
  moveBranch: (nodePath: string, index: number, dir: -1 | 1) => void;
  addChildNode: (nodePath: string, index: number) => void;
  removeChildNode: (nodePath: string, index: number) => void;
  normalizeWeights: (nodePath: string) => void;
}

const EMPTY_GRAPH: Graph = { nodes: [], edges: [] };

/** Recompute the laid-out graph and validation from the current tree + collapse set. */
function derive(tree: LogicTreeFile | null, collapsed: Set<string>) {
  if (!tree) return { graph: EMPTY_GRAPH, issues: [] as ValidationIssue[] };
  return {
    graph: layout(buildGraph(tree.tree, collapsed)),
    issues: validateTree(tree.tree),
  };
}

export const useStore = create<EndorState>((set, get) => {
  /** Apply a pure root-edit function, swap in the new tree, re-derive, mark dirty. */
  const applyEdit = (fn: (root: NodeInput) => NodeInput): void => {
    const { tree, collapsed } = get();
    if (!tree) return;
    const nextRoot = fn(tree.tree);
    if (nextRoot === tree.tree) return; // no-op edit (e.g. move out of bounds)
    const nextTree = { ...tree, tree: nextRoot };
    set({ tree: nextTree, dirty: true, ...derive(nextTree, collapsed) });
  };

  return {
    tree: null,
    fileName: "untitled.json",
    handle: null,
    collapsed: new Set(),
    selected: null,
    dirty: false,
    graph: EMPTY_GRAPH,
    issues: [],
    error: null,

    setTree: (loaded) => {
      const collapsed = new Set<string>();
      set({
        tree: loaded.tree,
        fileName: loaded.name,
        handle: loaded.handle,
        collapsed,
        selected: null,
        dirty: false,
        error: null,
        ...derive(loaded.tree, collapsed),
      });
    },

    open: async () => {
      try {
        const loaded = await openTree();
        if (loaded) get().setTree(loaded);
      } catch (err) {
        set({ error: err instanceof Error ? err.message : String(err) });
      }
    },

    save: async () => {
      const { tree, handle, fileName } = get();
      if (!tree) return;
      try {
        const newHandle = await saveTree(tree, handle, fileName);
        set({ dirty: false, ...(newHandle ? { handle: newHandle, fileName: newHandle.name } : {}) });
      } catch (err) {
        set({ error: err instanceof Error ? err.message : String(err) });
      }
    },

    toggleCollapse: (path) => {
      const collapsed = new Set(get().collapsed);
      if (collapsed.has(path)) collapsed.delete(path);
      else collapsed.add(path);
      set({ collapsed, ...derive(get().tree, collapsed) });
    },

    expandAll: () => {
      const collapsed = new Set<string>();
      set({ collapsed, ...derive(get().tree, collapsed) });
    },

    select: (path) => set({ selected: path }),

    patchBranch: (nodePath, index, patch) =>
      applyEdit((r) => edit.patchBranch(r, nodePath, index, patch)),
    patchNode: (nodePath, patch) => applyEdit((r) => edit.patchNode(r, nodePath, patch)),
    addBranch: (nodePath) => applyEdit((r) => edit.addBranch(r, nodePath)),
    removeBranch: (nodePath, index) => applyEdit((r) => edit.removeBranch(r, nodePath, index)),
    moveBranch: (nodePath, index, dir) => applyEdit((r) => edit.moveBranch(r, nodePath, index, dir)),
    addChildNode: (nodePath, index) => applyEdit((r) => edit.addChildNode(r, nodePath, index)),
    removeChildNode: (nodePath, index) =>
      applyEdit((r) => edit.removeChildNode(r, nodePath, index)),
    normalizeWeights: (nodePath) => applyEdit((r) => edit.normalizeWeights(r, nodePath)),
  };
});
