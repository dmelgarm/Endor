import { useCallback, useMemo } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  type Node,
  type Edge,
  type NodeMouseHandler,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useStore } from "../store";
import { leafToNodePath } from "../model/edit";
import { nodeTypes } from "./nodes";

/**
 * The interactive logic-tree canvas. Reads the laid-out graph from the store
 * and renders it with React Flow (pan/zoom, minimap, collapse via node buttons).
 */
export function TreeCanvas() {
  const graph = useStore((s) => s.graph);
  const selected = useStore((s) => s.selected);
  const select = useStore((s) => s.select);

  // Clicking a branch point selects it; clicking a leaf selects its parent.
  const onNodeClick: NodeMouseHandler = useCallback(
    (_e, node) => {
      if (node.type === "leaf") select(leafToNodePath(node.id).nodePath);
      else select(node.id);
    },
    [select],
  );

  const nodes: Node[] = useMemo(
    () =>
      graph.nodes.map((n) => ({
        id: n.id,
        type: n.type,
        position: n.position,
        selected: n.id === selected,
        data: n.data as unknown as Record<string, unknown>,
      })),
    [graph, selected],
  );

  const edges: Edge[] = useMemo(
    () =>
      graph.edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        // smoothstep routes cleanly between Left/Right handles in the LR layout
        // and seats the weight label on a horizontal segment.
        type: "smoothstep",
        label: e.label,
        labelStyle: { fontSize: 11, fill: "#b45309", fontWeight: 600 },
        labelBgPadding: [4, 2] as [number, number],
        labelBgStyle: { fill: "#f5f5f4" },
      })),
    [graph],
  );

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      onNodeClick={onNodeClick}
      fitView
      minZoom={0.05}
      proOptions={{ hideAttribution: true }}
    >
      <Background gap={20} />
      <MiniMap pannable zoomable />
      <Controls />
    </ReactFlow>
  );
}
