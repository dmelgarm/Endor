import type { NodeInput, BranchInput, Naming } from "../schema/logicTree";

/**
 * Derives a flat {nodes, edges} graph from the nested logic tree for React Flow
 * to render. The nested tree stays the source of truth; this is a one-way
 * projection recomputed whenever the tree or the collapsed set changes.
 *
 * Node ids are path-based ("root", "root/0", "root/0/1", ...) so a node keeps
 * its identity — and therefore its collapsed state and layout position — across
 * edits to weights or labels elsewhere in the tree.
 */

export interface BranchPointData {
  kind: "branchPoint";
  parameter: string;
  label?: string;
  leafCount: number; // realizations under this node (for the collapsed badge)
  childCount: number; // number of direct branches
  collapsed: boolean;
  path: string;
}

export interface LeafData {
  kind: "leaf";
  label?: string;
  value: unknown;
  weight: number; // this branch's own weight
  cumulativeWeight: number; // product of weights from root to here
  ruptureName?: string; // derived from the `code`s along the path
  path: string;
}

export type FlowNodeData = BranchPointData | LeafData;

export interface FlowNode {
  id: string;
  type: "branchPoint" | "leaf";
  data: FlowNodeData;
  position: { x: number; y: number };
}

export interface FlowEdge {
  id: string;
  source: string;
  target: string;
  label: string; // "branch label · weight"
  data: { weight: number; value: unknown; label?: string };
}

export interface Graph {
  nodes: FlowNode[];
  edges: FlowEdge[];
}

const ZERO = { x: 0, y: 0 };

export function countLeaves(node: NodeInput): number {
  let total = 0;
  for (const b of node.branches) {
    total += b.node ? countLeaves(b.node) : 1;
  }
  return total;
}

export interface NodeRef {
  path: string;
  depth: number; // root = 0
}

/** Every branch-point path in the tree with its depth (used for collapse-to-depth). */
export function allNodePaths(root: NodeInput): NodeRef[] {
  const out: NodeRef[] = [];
  const visit = (node: NodeInput, path: string, depth: number): void => {
    out.push({ path, depth });
    node.branches.forEach((b, i) => {
      if (b.node) visit(b.node, `${path}/${i}`, depth + 1);
    });
  };
  visit(root, "root", 0);
  return out;
}

/** Deepest branch-point depth in the tree (root = 0). */
export function maxDepth(root: NodeInput): number {
  return allNodePaths(root).reduce((m, n) => Math.max(m, n.depth), 0);
}

/** Set of node paths to collapse so that only depths < `depth` stay expanded. */
export function collapsedForDepth(root: NodeInput, depth: number): Set<string> {
  return new Set(allNodePaths(root).filter((n) => n.depth >= depth).map((n) => n.path));
}

function branchLabel(branch: BranchInput, index: number): string {
  return branch.label ?? (branch.value != null ? String(branch.value) : `#${index}`);
}

/**
 * Assemble a rupture name from the ordered `code`s along a root-to-leaf path.
 * Returns undefined when no branch on the path carried a code (nothing to name).
 */
export function formatRuptureName(codes: string[], naming?: Naming): string | undefined {
  if (codes.length === 0) return undefined;
  const sep = naming?.separator ?? "-";
  return (naming?.prefix ?? "") + codes.join(sep) + (naming?.suffix ?? "");
}

/**
 * Resolve a node path to its node plus the cumulative weight and the ordered
 * `code`s accumulated from the true root (so a focused view still derives full
 * rupture names).
 */
function resolveWithWeight(
  root: NodeInput,
  path: string,
): { node: NodeInput; cumulative: number; codes: string[] } | null {
  const segments = path.split("/").slice(1); // drop "root"
  let node = root;
  let cumulative = 1;
  const codes: string[] = [];
  for (const seg of segments) {
    const branch = node.branches[Number(seg)];
    if (!branch?.node) return null; // stale path (e.g. after an edit)
    cumulative *= branch.weight;
    if (branch.code) codes.push(branch.code);
    node = branch.node;
  }
  return { node, cumulative, codes };
}

/**
 * Build the render graph. When `focusPath` names a subtree (other than "root"),
 * only that subtree is rendered, but paths stay absolute and leaf cumulative
 * weights still include the branches above the focus — so hazard weights read
 * the same whether or not you're zoomed in.
 */
export function buildGraph(
  root: NodeInput,
  collapsed: ReadonlySet<string>,
  focusPath = "root",
  naming?: Naming,
): Graph {
  const nodes: FlowNode[] = [];
  const edges: FlowEdge[] = [];

  const visit = (
    node: NodeInput,
    path: string,
    cumulative: number,
    codes: string[],
  ): void => {
    const isCollapsed = collapsed.has(path);
    nodes.push({
      id: path,
      type: "branchPoint",
      position: ZERO,
      data: {
        kind: "branchPoint",
        parameter: node.parameter,
        label: node.label,
        leafCount: countLeaves(node),
        childCount: node.branches.length,
        collapsed: isCollapsed,
        path,
      },
    });

    if (isCollapsed) return;

    node.branches.forEach((branch, i) => {
      const childPath = `${path}/${i}`;
      const w = branch.weight;
      const label = branchLabel(branch, i);
      const childCodes = branch.code ? [...codes, branch.code] : codes;
      edges.push({
        id: `e:${childPath}`,
        source: path,
        target: branch.node ? childPath : `leaf:${childPath}`,
        label: `${label} · ${w}`,
        data: { weight: w, value: branch.value, label: branch.label },
      });

      if (branch.node) {
        visit(branch.node, childPath, cumulative * w, childCodes);
      } else {
        nodes.push({
          id: `leaf:${childPath}`,
          type: "leaf",
          position: ZERO,
          data: {
            kind: "leaf",
            label: branch.label,
            value: branch.value,
            weight: w,
            cumulativeWeight: cumulative * w,
            ruptureName: formatRuptureName(childCodes, naming),
            path: childPath,
          },
        });
      }
    });
  };

  if (focusPath === "root") {
    visit(root, "root", 1, []);
  } else {
    const resolved = resolveWithWeight(root, focusPath);
    // Fall back to the full tree if the focus path no longer resolves.
    if (resolved) visit(resolved.node, focusPath, resolved.cumulative, resolved.codes);
    else visit(root, "root", 1, []);
  }
  return { nodes, edges };
}
