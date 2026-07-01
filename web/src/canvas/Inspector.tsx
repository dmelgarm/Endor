import { useStore } from "../store";
import { resolveNode, ancestorCodes } from "../model/edit";
import { formatRuptureName } from "../model/graph";
import { WEIGHT_TOL } from "../ops/operations";

/**
 * Editing surface for the selected branch point: rename the parameter/label,
 * and add / remove / reorder / re-weight its branches with live feedback on
 * whether the weights sum to 1. Edits flow through the store's pure-edit
 * actions, so the canvas and validation update immediately.
 */

/** Coerce a text field back to a number when it reads like one, else keep the string. */
function coerceValue(text: string): string | number {
  const t = text.trim();
  if (t !== "" && Number.isFinite(Number(t))) return Number(t);
  return text;
}

export function Inspector() {
  const tree = useStore((s) => s.tree);
  const selected = useStore((s) => s.selected);
  const focus = useStore((s) => s.focus);
  const {
    patchBranch,
    patchNode,
    addBranch,
    removeBranch,
    moveBranch,
    addChildNode,
    removeChildNode,
    normalizeWeights,
    select,
    setFocus,
  } = useStore();

  if (!tree || !selected) {
    return <p className="hint">Select a branch point in the canvas to edit it.</p>;
  }

  // The selected path may point at a node that no longer exists after an edit.
  let node;
  try {
    node = resolveNode(tree.tree, selected);
  } catch {
    return <p className="hint">Selection no longer exists. Pick another node.</p>;
  }

  const total = node.branches.reduce((s, b) => s + b.weight, 0);
  const sumOk = Math.abs(total - 1) <= WEIGHT_TOL;

  // Codes on the path down to this node, for previewing derived rupture names.
  const prefixCodes = ancestorCodes(tree.tree, selected);

  return (
    <div className="inspector">
      <label className="field">
        <span>Parameter</span>
        <input
          value={node.parameter}
          onChange={(e) => patchNode(selected, { parameter: e.target.value })}
        />
      </label>
      <label className="field">
        <span>Label</span>
        <input
          value={node.label ?? ""}
          placeholder="(optional)"
          onChange={(e) => patchNode(selected, { label: e.target.value })}
        />
      </label>

      <div className="branches-head">
        <h4>Branches</h4>
        <span className={sumOk ? "pill good" : "pill bad"}>Σ {total.toPrecision(4)}</span>
      </div>

      <ul className="branch-list">
        {node.branches.map((b, i) => {
          const childPath = `${selected}/${i}`;
          return (
            <li key={i} className="branch-row">
              <div className="branch-line">
                <input
                  className="branch-label"
                  value={b.label ?? ""}
                  placeholder="label"
                  onChange={(e) => patchBranch(selected, i, { label: e.target.value })}
                />
                <input
                  className="branch-code"
                  value={b.code ?? ""}
                  placeholder="code"
                  title="Rupture-name token for this choice"
                  onChange={(e) => patchBranch(selected, i, { code: e.target.value })}
                />
                <input
                  className="branch-weight"
                  type="number"
                  step="0.05"
                  min="0"
                  max="1"
                  value={b.weight}
                  onChange={(e) => patchBranch(selected, i, { weight: Number(e.target.value) })}
                />
              </div>
              <div className="branch-line">
                <input
                  className="branch-value"
                  value={b.value == null ? "" : String(b.value)}
                  placeholder="value"
                  onChange={(e) => patchBranch(selected, i, { value: coerceValue(e.target.value) })}
                />
                <div className="branch-actions">
                  <button title="Move up" onClick={() => moveBranch(selected, i, -1)}>
                    ↑
                  </button>
                  <button title="Move down" onClick={() => moveBranch(selected, i, 1)}>
                    ↓
                  </button>
                  {b.node ? (
                    <>
                      <button title="Edit subtree" onClick={() => select(childPath)}>
                        →
                      </button>
                      <button title="Remove subtree" onClick={() => removeChildNode(selected, i)}>
                        ⌫
                      </button>
                    </>
                  ) : (
                    <button title="Add subtree" onClick={() => addChildNode(selected, i)}>
                      ＋▾
                    </button>
                  )}
                  <button
                    title="Delete branch"
                    className="danger"
                    disabled={node.branches.length <= 1}
                    onClick={() => removeBranch(selected, i)}
                  >
                    ✕
                  </button>
                </div>
              </div>
              {!b.node &&
                (() => {
                  const name = formatRuptureName(
                    b.code ? [...prefixCodes, b.code] : prefixCodes,
                    tree.naming,
                  );
                  return name ? <div className="branch-rupture">{name}</div> : null;
                })()}
            </li>
          );
        })}
      </ul>

      <div className="inspector-actions">
        <button onClick={() => addBranch(selected)}>＋ Add branch</button>
        <button onClick={() => normalizeWeights(selected)} disabled={sumOk}>
          Normalize to 1
        </button>
        {focus === selected ? (
          <button onClick={() => setFocus(null)}>Show full tree</button>
        ) : (
          <button onClick={() => setFocus(selected)} disabled={selected === "root"}>
            View only this branch
          </button>
        )}
      </div>
    </div>
  );
}
