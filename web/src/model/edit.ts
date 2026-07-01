import type { NodeInput, BranchInput } from "../schema/logicTree";

/**
 * Pure structural edits on the nested logic tree. Every function returns a new
 * root (the input is never mutated) so the store can swap state immutably and
 * re-derive the graph + validation. Nodes are addressed by the same path
 * scheme used for rendering: "root", "root/0", "root/0/1", ... where each
 * segment after "root" is a branch index whose child node we descend into.
 */

function clone(root: NodeInput): NodeInput {
  return structuredClone(root);
}

/** Resolve a node path to the live Node object inside `root`. Throws if absent. */
export function resolveNode(root: NodeInput, path: string): NodeInput {
  const segments = path.split("/");
  if (segments[0] !== "root") throw new Error(`bad node path: ${path}`);
  let node = root;
  for (const seg of segments.slice(1)) {
    const child = node.branches[Number(seg)]?.node;
    if (!child) throw new Error(`no node at path: ${path}`);
    node = child;
  }
  return node;
}

/** Node path of the branch point that owns a leaf id like "leaf:root/0/1". */
export function leafToNodePath(leafId: string): { nodePath: string; index: number } {
  const path = leafId.replace(/^leaf:/, "");
  const segments = path.split("/");
  const index = Number(segments[segments.length - 1]);
  const nodePath = segments.slice(0, -1).join("/");
  return { nodePath, index };
}

type BranchPatch = Partial<Pick<BranchInput, "label" | "code" | "weight" | "value">>;
type NodePatch = Partial<Pick<NodeInput, "parameter" | "label">>;

/** Ordered `code`s on the branches leading from the root down to `nodePath`. */
export function ancestorCodes(root: NodeInput, nodePath: string): string[] {
  const segments = nodePath.split("/").slice(1); // drop "root"
  const codes: string[] = [];
  let node = root;
  for (const seg of segments) {
    const branch = node.branches[Number(seg)];
    if (!branch?.node) break;
    if (branch.code) codes.push(branch.code);
    node = branch.node;
  }
  return codes;
}

export function patchBranch(
  root: NodeInput,
  nodePath: string,
  index: number,
  patch: BranchPatch,
): NodeInput {
  const next = clone(root);
  const node = resolveNode(next, nodePath);
  node.branches[index] = { ...node.branches[index], ...patch };
  return next;
}

export function patchNode(root: NodeInput, nodePath: string, patch: NodePatch): NodeInput {
  const next = clone(root);
  Object.assign(resolveNode(next, nodePath), patch);
  return next;
}

export function addBranch(root: NodeInput, nodePath: string): NodeInput {
  const next = clone(root);
  const node = resolveNode(next, nodePath);
  node.branches.push({ label: "New branch", weight: 0, value: "" });
  return next;
}

export function removeBranch(root: NodeInput, nodePath: string, index: number): NodeInput {
  const next = clone(root);
  const node = resolveNode(next, nodePath);
  // Keep at least one branch — a branch point with none is invalid.
  if (node.branches.length > 1) node.branches.splice(index, 1);
  return next;
}

export function moveBranch(
  root: NodeInput,
  nodePath: string,
  index: number,
  dir: -1 | 1,
): NodeInput {
  const target = index + dir;
  const next = clone(root);
  const node = resolveNode(next, nodePath);
  if (target < 0 || target >= node.branches.length) return root;
  const [b] = node.branches.splice(index, 1);
  node.branches.splice(target, 0, b);
  return next;
}

/** Turn a leaf branch into a branch point by giving it a child node. */
export function addChildNode(root: NodeInput, nodePath: string, index: number): NodeInput {
  const next = clone(root);
  const node = resolveNode(next, nodePath);
  if (node.branches[index].node) return root;
  node.branches[index] = {
    ...node.branches[index],
    node: { parameter: "new_parameter", branches: [{ label: "Branch 1", weight: 1, value: "" }] },
  };
  return next;
}

/** Collapse a branch's subtree back to a leaf, discarding the child node. */
export function removeChildNode(root: NodeInput, nodePath: string, index: number): NodeInput {
  const next = clone(root);
  const node = resolveNode(next, nodePath);
  const { node: _drop, ...rest } = node.branches[index];
  node.branches[index] = rest;
  return next;
}

/** Rescale a node's branch weights to sum to exactly 1, preserving ratios. */
export function normalizeWeights(root: NodeInput, nodePath: string): NodeInput {
  const next = clone(root);
  const node = resolveNode(next, nodePath);
  const total = node.branches.reduce((s, b) => s + b.weight, 0);
  if (total <= 0) {
    // No information to preserve — distribute equally.
    const equal = 1 / node.branches.length;
    node.branches.forEach((b) => (b.weight = equal));
  } else {
    node.branches.forEach((b) => (b.weight = b.weight / total));
  }
  return next;
}
