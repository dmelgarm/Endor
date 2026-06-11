import Dagre from "@dagrejs/dagre";
import type { Graph } from "../model/graph";

/**
 * Assigns positions to a Graph with a left-to-right hierarchical layout. React
 * Flow does not place nodes itself; dagre computes a tidy tree arrangement that
 * keeps deep, wide logic trees readable. LR fits PTHA trees: breadth (the many
 * leaf realizations) maps to the vertical axis for natural scrolling, while the
 * bounded depth grows rightward and node labels read horizontally without
 * crowding their siblings.
 */

const NODE_W = 200;
const NODE_H = 56;

export function layout(graph: Graph): Graph {
  const g = new Dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));
  // rankdir LR: ranksep is the horizontal gap between depth levels, nodesep the
  // vertical gap between siblings sharing a level.
  g.setGraph({ rankdir: "LR", nodesep: 24, ranksep: 90 });

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
