import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { useEditor } from "./store";
import { Canvas } from "./components/Canvas";
import { Inspector } from "./components/Inspector";
import { ValidationBar } from "./components/ValidationBar";
import { OutputModal } from "./components/OutputModal";
import { SchemaBar } from "./components/SchemaBar";
import { toJSON, toYAML } from "./serialize";
import { downloadBundle, makeBundle, parseBundle, type BundleFormat } from "./bundle";
import { designAdvisorySchema, useDesignAdvisoryEngine } from "./lib/designAdvisory";
import "./App.css";

const DESIGN_LABEL: Record<string, string> = { off: "OFF", loading: "読込中…", ready: "ON", error: "エラー" };

// monaco を含む SchemaEditor は遅延ロード（木ビューの初期表示には不要）。
const SchemaEditor = lazy(() => import("./components/SchemaEditor").then((m) => ({ default: m.SchemaEditor })));

type View = "tree" | "schema";

export function App() {
  const { schema, roots, source, addRoot, init, importSchema, designEnabled, designStatus, setDesignEnabled } = useEditor();
  const [modal, setModal] = useState<{ title: string; text: string } | null>(null);
  const [view, setView] = useState<View>("tree");
  const [importBusy, setImportBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useDesignAdvisoryEngine();

  useEffect(() => {
    init();
  }, [init]);

  const onExport = (format: BundleFormat) => {
    downloadBundle(makeBundle(schema.id, schema.name, source, roots), format).catch((err) =>
      setModal({ title: "エクスポートエラー", text: err instanceof Error ? err.message : String(err) }),
    );
  };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // 同じファイルを連続で選べるように
    if (!file) return;
    setImportBusy(true);
    try {
      const { bundle, error } = await parseBundle(await file.text());
      if (error || !bundle) {
        setModal({ title: "インポートエラー", text: error ?? "不明なエラー" });
        return;
      }
      const { compileSource } = await import("./lib/compileSource");
      const res = await compileSource(bundle.schema.source);
      if (res.error || !res.schema) {
        setModal({ title: "インポートエラー（スキーマ評価）", text: res.error ?? "スキーマを評価できません" });
        return;
      }
      importSchema(res.schema, bundle.schema.source, res.js, bundle.roots);
      setView("tree");
    } finally {
      setImportBusy(false);
    }
  };

  return (
    <div className="app">
      <header>
        <h1>tree-schema</h1>
        <SchemaBar />
        <div className="viewtabs">
          <button className={view === "tree" ? "on" : ""} onClick={() => setView("tree")}>木</button>
          <button className={view === "schema" ? "on" : ""} onClick={() => setView("schema")}>スキーマ編集</button>
        </div>
        {view === "tree" ? (
          <div className="legend">
            {Object.entries(schema.nodeTypes).map(([n, t]) => (
              <span className="chip" key={n}>
                <span className="sw" style={{ background: t.color }} /> {n}
              </span>
            ))}
          </div>
        ) : null}
        <div className="tools">
          {view === "tree" && designAdvisorySchema(schema) ? (
            <button
              className={`designtoggle${designEnabled ? " on" : ""}`}
              onClick={() => setDesignEnabled(!designEnabled)}
              title="text フィールドの設計依存を in-browser モデルで判定（フラグのみ・有効化で初回モデルDL）"
            >
              設計依存チェック: {DESIGN_LABEL[designStatus] ?? "OFF"}
            </button>
          ) : null}
          {view === "tree"
            ? schema.rootTypes.map((tp) => (
                <button key={tp} onClick={() => addRoot(tp)}>
                  <span className="sw" style={{ background: schema.nodeTypes[tp]?.color }} /> + {tp}
                </button>
              ))
            : null}
          <button onClick={() => setModal({ title: "JSON 出力（木データ）", text: toJSON(roots, schema) })}>木JSON</button>
          <button onClick={() => setModal({ title: "YAML 出力（木データ）", text: toYAML(roots, schema) })}>木YAML</button>
          <span className="exportgroup" title="スキーマと木を1ファイルに書き出し（再インポート可）">
            エクスポート
            <button onClick={() => onExport("json")}>JSON</button>
            <button onClick={() => onExport("yaml")}>YAML</button>
          </span>
          <button onClick={() => fileRef.current?.click()} disabled={importBusy}>
            {importBusy ? "取込中…" : "インポート"}
          </button>
          <input ref={fileRef} type="file" accept="application/json,.json,.yaml,.yml,application/yaml,text/yaml" style={{ display: "none" }} onChange={onFile} />
        </div>
      </header>

      <main>
        {view === "tree" ? (
          <>
            <Canvas />
            <aside>
              <Inspector />
              <ValidationBar />
            </aside>
          </>
        ) : (
          <Suspense fallback={<div className="se-loading">エディタを読み込み中…</div>}>
            <SchemaEditor onApplied={() => setView("tree")} />
          </Suspense>
        )}
      </main>

      {modal ? <OutputModal title={modal.title} text={modal.text} onClose={() => setModal(null)} /> : null}
    </div>
  );
}
