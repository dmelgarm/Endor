import Dagre from "@dagrejs/dagre";
import type { Graph } from "../model/graph";

/**
 * Assigns positions to a Graph with a top-down hierarchical layout. React Flow
 * does not place nodes itself; dagre computes a tidy tree arrangement that keeps
 * deep, wide logic trees readable.
 */

const NODE_W = 200;
const NODE_H = 56;

export function layout(graph: Graph): Graph {
  const g = new Dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: "TB", nodesep: 30, ranksep: 70 });

  for (const node of graph.nodes) {
    g.setNode(node.id, { width: NODE_W, height: NODE_H });
  }
  for (const edge of graph.edges) {
    g.setEdge(edge.source, edge.target);
  }

  Dagre.layout(g);

  return {
    edges: graph.edges,
    nodes: graph.nodes.map((node) => {
      const { x, y } = g.node(node.id);
      // dagre returns centers; React Flow positions are top-left corners.
      return { ...node, position: { x: x - NODE_W / 2, y: y - NODE_H / 2 } };
    }),
  };
}

export const NODE_WIDTH = NODE_W;
export const NODE_HEIGHT = NODE_H;
