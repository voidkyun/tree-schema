import { useMemo } from "react";
import { validateTree, type ConstraintViolation } from "@tree-schema/core";
import { useEditor } from "../store";
import { useConstraintReport } from "../lib/useConstraints";
import { designAdvisorySchema } from "../lib/designAdvisory";

const SCOPE_LABEL: Record<ConstraintViolation["scope"], string> = {
  field: "field",
  node: "node",
  tree: "tree",
  forest: "forest",
};

export function ValidationBar() {
  const { schema, roots, select, designEnabled, designStatus } = useEditor();
  const structural = useMemo(
    () => validateTree({ schemaId: schema.id, roots }, schema),
    [roots, schema],
  );
  const report = useConstraintReport();

  const errorViol = report.violations.filter((v) => v.severity !== "advisory");
  const advisoryViol = report.violations.filter((v) => v.severity === "advisory");
  const validForest = structural.length === 0 && report.ok;
  // 助言（設計依存）は BDD Example Mapping スキーマ＋有効時のみ表示。
  const designActive = designEnabled && designAdvisorySchema(schema);

  return (
    <div className="vbar">
      <div className={`verdict ${validForest ? "ok" : "bad"}`}>
        {validForest ? "✔ valid forest" : "✕ invalid forest"}
        <span className="vcount">
          構造 {structural.length} / 制約 {errorViol.length}
          {designActive ? <span className="advcount"> / 助言 {advisoryViol.length}</span> : null}
        </span>
      </div>

      {structural.length > 0 ? (
        <div className="vsect">
          <div className="vsectlabel">構造</div>
          {structural.map((i, k) => (
            <div className="vrow" key={k} onClick={() => i.nodeId && select(i.nodeId)}>
              <span className="x">✕</span>
              <span>{i.message}</span>
            </div>
          ))}
        </div>
      ) : null}

      {errorViol.length > 0 ? (
        <div className="vsect">
          <div className="vsectlabel">制約</div>
          {errorViol.map((v, k) => {
            const target = v.nodeId ?? v.treeRootId;
            return (
              <div className="vrow" key={k} onClick={() => target && select(target)}>
                <span className="scopechip">{SCOPE_LABEL[v.scope]}</span>
                <span>{v.message}{v.errored ? "（評価エラー）" : ""}</span>
              </div>
            );
          })}
        </div>
      ) : null}

      {designActive ? (
        <div className="vsect">
          <div className="vsectlabel">
            助言（設計依存・フラグのみ）
            {designStatus === "loading" ? <span className="advstat"> モデル読込中…</span> : null}
            {designStatus === "error" ? <span className="advstat err"> 判定エラー</span> : null}
          </div>
          {advisoryViol.length > 0 ? (
            advisoryViol.map((v, k) => (
              <div className="vrow adv" key={k} onClick={() => v.nodeId && select(v.nodeId)}>
                <span className="scopechip">{SCOPE_LABEL[v.scope]}</span>
                <span>{v.message}</span>
              </div>
            ))
          ) : designStatus === "ready" ? (
            <div className="advnone">設計依存の疑いは見つかりませんでした。</div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
