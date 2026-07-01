import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { BranchPointData, LeafData } from "../model/graph";
import { useStore } from "../store";

/**
 * Custom React Flow node renderers. Branch points show the parameter and a
 * collapse toggle; leaves show the selected value and its cumulative weight.
 */

export function BranchPointNode({ data }: NodeProps) {
  const d = data as unknown as BranchPointData;
  const toggleCollapse = useStore((s) => s.toggleCollapse);

  return (
    <div className={`node branch-point${d.collapsed ? " collapsed" : ""}`}>
      <Handle type="target" position={Position.Left} />
      <div className="node-title">{d.label ?? d.parameter}</div>
      <div className="node-sub">{d.parameter}</div>
      <button
        className="collapse-btn"
        title={d.collapsed ? "Expand" : "Collapse"}
        onClick={(e) => {
          e.stopPropagation();
          toggleCollapse(d.path);
        }}
      >
        {d.collapsed ? `+${d.leafCount}` : "–"}
      </button>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}

export function LeafNode({ data }: NodeProps) {
  const d = data as unknown as LeafData;
  const val = d.value;
  const isObj = val !== null && typeof val === "object";
  const primitive = val != null && !isObj ? String(val) : "";
  // Leaves may carry structured attributes (e.g. { weight, Mw, Mo }).
  const mw = isObj && "Mw" in (val as object) ? (val as { Mw?: unknown }).Mw : undefined;
  const title = d.ruptureName ?? d.label ?? (primitive || "leaf");
  return (
    <div className="node leaf">
      <Handle type="target" position={Position.Left} />
      <div className={`node-title${d.ruptureName ? " mono" : ""}`} title={title}>
        {title}
      </div>
      <div className="node-sub">
        {mw !== undefined && <>Mw {Number(mw).toFixed(2)} · </>}w ={" "}
        <span className="weight">{d.cumulativeWeight.toPrecision(3)}</span>
      </div>
    </div>
  );
}

export const nodeTypes = {
  branchPoint: BranchPointNode,
  leaf: LeafNode,
};
