import type { NodeInput, BranchInput } from "../schema/logicTree";

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

export function buildGraph(root: NodeInput, collapsed: ReadonlySet<string>): Graph {
  const nodes: FlowNode[] = [];
  const edges: FlowEdge[] = [];

  const visit = (node: NodeInput, path: string, cumulative: number): void => {
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
      edges.push({
        id: `e:${childPath}`,
        source: path,
        target: branch.node ? childPath : `leaf:${childPath}`,
        label: `${label} · ${w}`,
        data: { weight: w, value: branch.value, label: branch.label },
      });

      if (branch.node) {
        visit(branch.node, childPath, cumulative * w);
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
            path: childPath,
          },
        });
      }
    });
  };

  visit(root, "root", 1);
  return { nodes, edges };
}
