import { useMemo, useState } from "react";
import { applyMigration, validateTree, type MigrationOp, type Schema, type TreeDoc, type TreeNode } from "@tree-schema/core";

interface Props {
  newSchema: Schema;
  doc: TreeDoc;
  initialOps: MigrationOp[];
  onApply: (roots: TreeNode[]) => void;
  onClose: () => void;
}

function countNodes(roots: TreeNode[]): number {
  let c = 0;
  const walk = (n: TreeNode): void => {
    c++;
    n.children.forEach(walk);
  };
  roots.forEach(walk);
  return c;
}

/**
 * スキーマ変更時のツリー移行を dry-run で確認・編集してから適用するモーダル。
 * migration script（MigrationOp[]）は自動生成され、JSON として編集できる。
 * remove+add を renameNodeType / renameField に書き換えればデータを保全できる。
 */
export function MigrationModal({ newSchema, doc, initialOps, onApply, onClose }: Props) {
  const [text, setText] = useState(() => JSON.stringify(initialOps, null, 2));

  const parsed = useMemo<{ ops?: MigrationOp[]; error?: string }>(() => {
    try {
      const v = JSON.parse(text);
      if (!Array.isArray(v)) return { error: "ops は配列である必要があります" };
      return { ops: v as MigrationOp[] };
    } catch (e) {
      return { error: e instanceof Error ? e.message : String(e) };
    }
  }, [text]);

  const result = useMemo(() => {
    if (!parsed.ops) return null;
    try {
      return applyMigration(parsed.ops, doc, newSchema);
    } catch {
      return null;
    }
  }, [parsed.ops, doc, newSchema]);

  const remaining = useMemo(
    () => (result ? validateTree(result.doc, newSchema) : []),
    [result, newSchema],
  );

  const before = countNodes(doc.roots);

  return (
    <div className="modal" onClick={onClose}>
      <div className="box mig" onClick={(e) => e.stopPropagation()}>
        <div className="top">
          <b>スキーマ移行（dry run）</b>
          <div className="tools">
            <button onClick={onClose}>キャンセル</button>
            <button className="primary" disabled={!result} onClick={() => result && onApply(result.doc.roots)}>
              適用して木を移行
            </button>
          </div>
        </div>
        <div className="migbody">
          <div className="migcol">
            <div className="sectlabel">migration script（編集可能）</div>
            <p className="hint">
              remove+add を <code>renameNodeType</code> / <code>renameField</code> に書き換えるとデータを保全できます。{" "}
              使える op: addNodeType / removeNodeType(strategy: delete|unwrap) / renameNodeType / addField / removeField / renameField / retypeField。
            </p>
            <textarea className="migedit" value={text} spellCheck={false} onChange={(e) => setText(e.target.value)} />
            {parsed.error ? <div className="migerr">JSON エラー: {parsed.error}</div> : null}
          </div>
          <div className="migcol">
            <div className="sectlabel">
              変更内容（{before} → {result ? countNodes(result.doc.roots) : "?"} ノード）
            </div>
            {result ? (
              result.effects.length ? (
                <ul className="effects">
                  {result.effects.map((ef, i) => (
                    <li key={i}>
                      <span className="opname">{ef.op.op}</span> {ef.description}
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="hint">構造変更なし（木はそのまま保持）。</div>
              )
            ) : (
              <div className="migerr">ops を評価できません。JSON を確認してください。</div>
            )}
            <div className="sectlabel">移行後に残る構造の問題</div>
            {remaining.length ? (
              <ul className="effects bad">
                {remaining.map((iss, i) => (
                  <li key={i}>{iss.message}</li>
                ))}
              </ul>
            ) : (
              <div className="ok">構造検証 OK。</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
