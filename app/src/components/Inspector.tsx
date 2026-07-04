import { buildIndex, descendants, fieldViolationKey, type TreeNode } from "@tree-schema/core";
import { useEditor } from "../store";
import { useConstraintReport } from "../lib/useConstraints";
import { FieldInput } from "../fieldRegistry";

export function Inspector() {
  const { schema, roots, selId, addRoot, addChild, updateField, remove } = useEditor();
  const report = useConstraintReport();

  if (!selId) {
    return (
      <div className="pane">
        <h2>ノード未選択</h2>
        <p className="hint">ノードをクリックすると編集できます。</p>
        <div className="sectlabel">ルートを追加</div>
        <div className="addrow">
          {schema.rootTypes.map((tp) => (
            <button key={tp} onClick={() => addRoot(tp)}>
              <span className="sw" style={{ background: schema.nodeTypes[tp]?.color }} /> {tp}
            </button>
          ))}
        </div>
      </div>
    );
  }

  const node = buildIndex(roots).byId.get(selId);
  if (!node) return <div className="pane"><p className="hint">選択ノードが見つかりません。</p></div>;
  const t = schema.nodeTypes[node.type];

  const nodeViol = report.byNode.get(node.id) ?? [];
  const treeViol = report.byTree.get(node.id) ?? [];
  const nodeScope = nodeViol.filter((v) => v.scope === "node");

  return (
    <div className="pane">
      <div className="typehead">
        <span className="sw" style={{ background: t?.color }} />
        <b>{t?.label ?? node.type}</b>
        {t?.terminal ? <span className="badge term">terminal</span> : null}
      </div>

      {/* node.id を key にして選択ノードが変わるたび入力を作り直す（DOM 再利用で前ノードの値が残るのを防ぐ）。 */}
      <div className="fields" key={node.id}>
        {(t?.fields ?? []).map((f) => {
          const fviol = report.byField.get(fieldViolationKey(node.id, f.key)) ?? [];
          const fErr = fviol.some((v) => v.severity !== "advisory");
          const fAdv = !fErr && fviol.some((v) => v.severity === "advisory");
          return (
            <div className={`field${fErr ? " fbad" : fAdv ? " fadvise" : ""}`} key={f.key}>
              <label>{f.label}{f.required ? " *" : ""}</label>
              <FieldInput field={f} value={node.fields[f.key]} onChange={(v) => updateField(node.id, f.key, v)} />
              {fviol.map((v, i) =>
                v.severity === "advisory" ? (
                  <div className="fieldadvise" key={i}>~ {v.message}</div>
                ) : (
                  <div className="fielderr" key={i}>✕ {v.message}{v.errored ? "（評価エラー）" : ""}</div>
                ),
              )}
            </div>
          );
        })}
      </div>

      {nodeScope.length || treeViol.length ? (
        <>
          <div className="sectlabel">制約違反</div>
          {nodeScope.map((v, i) => (
            <div className="violrow" key={`n${i}`}><span className="scopechip">node</span> {v.message}{v.errored ? "（評価エラー）" : ""}</div>
          ))}
          {treeViol.map((v, i) => (
            <div className="violrow" key={`t${i}`}><span className="scopechip">tree</span> {v.message}{v.errored ? "（評価エラー）" : ""}</div>
          ))}
        </>
      ) : null}

      {t && t.children.length > 0 ? (
        <>
          <div className="sectlabel">子を追加</div>
          <div className="addrow">
            {t.children.map((tp) => (
              <button key={tp} onClick={() => addChild(node.id, tp)}>
                <span className="sw" style={{ background: schema.nodeTypes[tp]?.color }} /> {tp}
              </button>
            ))}
          </div>
        </>
      ) : null}

      <MoveControl node={node} />

      <div className="sectlabel">操作</div>
      <button className="danger" onClick={() => remove(node.id)}>このノードを削除</button>
    </div>
  );
}

/** 選択ノードを、その型を子に許す別ノード（または最上位）へ移し替えるセレクタ。 */
function MoveControl({ node }: { node: TreeNode }) {
  const { schema, roots, moveNode } = useEditor();

  const all: TreeNode[] = [];
  const flat = (n: TreeNode) => {
    all.push(n);
    n.children.forEach(flat);
  };
  roots.forEach(flat);

  const blocked = new Set<string>([node.id, ...descendants(node).map((n) => n.id)]);
  const targets = all.filter((n) => !blocked.has(n.id) && (schema.nodeTypes[n.type]?.children ?? []).includes(node.type));
  const canBeRoot = schema.rootTypes.includes(node.type);
  if (targets.length === 0 && !canBeRoot) return null;

  const labelOf = (n: TreeNode): string => {
    const t = schema.nodeTypes[n.type];
    const f = (t?.fields ?? []).find((f) => { const v = n.fields[f.key]; return v !== "" && v != null; });
    const val = f ? String(n.fields[f.key]) : "";
    const short = val.length > 16 ? val.slice(0, 16) + "…" : val;
    return `${t?.label ?? n.type}${short ? "：" + short : ""}`;
  };

  return (
    <>
      <div className="sectlabel">移動</div>
      <select
        className="moveselect"
        value=""
        onChange={(e) => {
          const v = e.target.value;
          if (!v) return;
          moveNode(node.id, v === "__root__" ? null : v);
        }}
      >
        <option value="">別の親へ移動…</option>
        {canBeRoot ? <option value="__root__">ルート（最上位）へ</option> : null}
        {targets.map((t) => (
          <option key={t.id} value={t.id}>{labelOf(t)}</option>
        ))}
      </select>
    </>
  );
}
