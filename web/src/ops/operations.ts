import type { NodeInput, BranchInput } from "../schema/logicTree";

/** Floating-point tolerance for weight-sum checks. */
export const WEIGHT_TOL = 1e-6;

export interface Realization {
  weight: number;
  parameters: Record<string, unknown>;
  path: string[];
}

export interface ValidationIssue {
  path: string;
  message: string;
  severity: "error" | "warning";
}

function branchKey(branch: BranchInput, index: number): string {
  return branch.label ?? branch.id ?? `branch[${index}]`;
}

/**
 * Enumerate every root-to-leaf realization with its combined weight. The count
 * is the product of branch counts along each path, so a deep tree can yield a
 * large array — callers should be mindful for very complex trees.
 */
export function enumerate(root: NodeInput): Realization[] {
  const out: Realization[] = [];

  const walk = (
    node: NodeInput,
    weight: number,
    params: Record<string, unknown>,
    path: string[],
  ): void => {
    node.branches.forEach((branch, i) => {
      const w = weight * branch.weight;
      const nextParams = { ...params, [node.parameter]: branch.value };
      const nextPath = [...path, branchKey(branch, i)];
      if (branch.node) {
        walk(branch.node, w, nextParams, nextPath);
      } else {
        out.push({ weight: w, parameters: nextParams, path: nextPath });
      }
    });
  };

  walk(root, 1, {}, []);
  return out;
}

export function countRealizations(node: NodeInput): number {
  return node.branches.reduce(
    (sum, b) => sum + (b.node ? countRealizations(b.node) : 1),
    0,
  );
}

/** Verify sibling weights sum to 1 at every branch point. */
export function validateTree(root: NodeInput): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  const check = (node: NodeInput, path: string): void => {
    if (node.branches.length === 0) {
      issues.push({ path, message: "branch point has no branches", severity: "error" });
      return;
    }
    const total = node.branches.reduce((s, b) => s + b.weight, 0);
    if (Math.abs(total - 1) > WEIGHT_TOL) {
      issues.push({
        path,
        message: `branch weights sum to ${total.toPrecision(6)}, expected 1.0`,
        severity: "error",
      });
    }
    node.branches.forEach((branch, i) => {
      const bpath = `${path}.branches[${i}]`;
      if (branch.weight < 0) {
        issues.push({ path: bpath, message: "weight is negative", severity: "error" });
      }
      if (branch.node) check(branch.node, `${bpath}.node`);
    });
  };

  check(root, "tree");
  return issues;
}
