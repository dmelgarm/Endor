import { z } from "zod";

/**
 * Zod mirror of schema/logic-tree.schema.json. This is the runtime contract
 * for anything loaded from disk: parse() rejects malformed files before they
 * reach the canvas.
 */

// A branch may carry a child node, so the node/branch schemas are mutually
// recursive. z.lazy defers evaluation until the cycle is closed.
export type BranchInput = {
  id?: string;
  label?: string;
  weight: number;
  value?: unknown;
  node?: NodeInput;
};

export type NodeInput = {
  id?: string;
  parameter: string;
  label?: string;
  branches: BranchInput[];
};

export const branchSchema: z.ZodType<BranchInput> = z.lazy(() =>
  z.object({
    id: z.string().optional(),
    label: z.string().optional(),
    weight: z.number().min(0).max(1),
    value: z.unknown().optional(),
    node: nodeSchema.optional(),
  }),
);

export const nodeSchema: z.ZodType<NodeInput> = z.lazy(() =>
  z.object({
    id: z.string().optional(),
    parameter: z.string(),
    label: z.string().optional(),
    branches: z.array(branchSchema).min(1),
  }),
);

export const metadataSchema = z
  .object({
    name: z.string().optional(),
    description: z.string().optional(),
    author: z.string().optional(),
    created: z.string().optional(),
    tags: z.array(z.string()).optional(),
  })
  .passthrough();

export const logicTreeSchema = z.object({
  schemaVersion: z.string().regex(/^\d+\.\d+$/),
  metadata: metadataSchema.optional(),
  tree: nodeSchema,
});

export type LogicTreeFile = z.infer<typeof logicTreeSchema>;
export type Metadata = z.infer<typeof metadataSchema>;

export function parseLogicTree(data: unknown): LogicTreeFile {
  return logicTreeSchema.parse(data);
}
