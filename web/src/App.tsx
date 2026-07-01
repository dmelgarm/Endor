import { useMemo } from "react";
import { TreeCanvas } from "./canvas/TreeCanvas";
import { Inspector } from "./canvas/Inspector";
import { useStore } from "./store";
import { parseLogicTree } from "./schema/logicTree";
import { countRealizations } from "./ops/operations";
import "./App.css";

export default function App() {
  const {
    tree,
    fileName,
    issues,
    error,
    dirty,
    viewDepth,
    treeDepth,
    open,
    save,
    expandAll,
    collapseAll,
    setViewDepth,
    setTree,
  } = useStore();

  const realizations = useMemo(
    () => (tree ? countRealizations(tree.tree) : 0),
    [tree],
  );

  async function loadExample() {
    const res = await fetch(`${import.meta.env.BASE_URL}cascadia.tree.json`);
    const data = parseLogicTree(await res.json());
    setTree({ tree: data, handle: null, name: "cascadia.tree.json" });
  }

  return (
    <div className="app">
      <header className="toolbar">
        <span className="brand">Endor</span>
        <button onClick={open}>Open…</button>
        <button onClick={save} disabled={!tree}>
          Save{dirty ? " •" : ""}
        </button>

        <span className="divider" />

        <button onClick={collapseAll} disabled={!tree} title="Collapse to root">
          Collapse all
        </button>
        <button onClick={expandAll} disabled={!tree} title="Expand every branch">
          Expand all
        </button>
        <span className="depth-control" title="Expand the tree down to this depth">
          Depth
          <button onClick={() => setViewDepth(viewDepth - 1)} disabled={!tree || viewDepth <= 0}>
            –
          </button>
          <span className="depth-value">{tree ? Math.min(viewDepth, treeDepth + 1) : "–"}</span>
          <button
            onClick={() => setViewDepth(viewDepth + 1)}
            disabled={!tree || viewDepth > treeDepth}
          >
            +
          </button>
        </span>

        <span className="divider" />

        <button onClick={loadExample}>Load example</button>
        <span className="filename">
          {tree ? fileName : "no tree loaded"}
          {dirty ? " (unsaved)" : ""}
        </span>
      </header>

      <main className="content">
        <div className="canvas-wrap">
          {tree ? (
            <TreeCanvas />
          ) : (
            <div className="empty">
              <p>Open a logic-tree JSON file, or load the example to start.</p>
            </div>
          )}
        </div>

        <aside className="sidebar">
          {error && <div className="banner error">{error}</div>}
          {tree && (
            <>
              <section>
                <h3>{tree.metadata?.name ?? "Untitled tree"}</h3>
                {tree.metadata?.description && <p>{tree.metadata.description}</p>}
                <dl>
                  <dt>Realizations</dt>
                  <dd>{realizations.toLocaleString()}</dd>
                  <dt>Schema</dt>
                  <dd>v{tree.schemaVersion}</dd>
                  {tree.metadata?.author && (
                    <>
                      <dt>Author</dt>
                      <dd>{tree.metadata.author}</dd>
                    </>
                  )}
                </dl>
              </section>

              <section>
                <h4>
                  Validation{" "}
                  <span className={issues.length ? "pill bad" : "pill good"}>
                    {issues.length ? `${issues.length} issue(s)` : "OK"}
                  </span>
                </h4>
                {issues.length > 0 && (
                  <ul className="issues">
                    {issues.map((i, k) => (
                      <li key={k}>
                        <code>{i.path}</code> — {i.message}
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section>
                <h4>Inspector</h4>
                <Inspector />
              </section>
            </>
          )}
        </aside>
      </main>
    </div>
  );
}
