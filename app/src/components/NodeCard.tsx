import { useLayoutEffect, useRef } from "react";
import type { ConstraintViolation, Schema, TreeNode } from "@tree-schema/core";

export const NODE_W = 160;
export const NODE_H = 92;

interface Props {
  node: TreeNode;
  schema: Schema;
  x: number;
  y: number;
  selected: boolean;
  leafBad: boolean;
  /** この node の field / node スコープ違反。 */
  violations: ConstraintViolation[];
  /** この node がルートのとき、その tree スコープ違反。 */
  treeViolations: ConstraintViolation[];
  onMeasure: (id: string, h: number) => void;
  onClick: () => void;
}

export function NodeCard({ node, schema, x, y, selected, leafBad, violations, treeViolations, onMeasure, onClick }: Props) {
  const t = schema.nodeTypes[node.type];
  const fields = t?.fields ?? [];
  const ref = useRef<HTMLDivElement>(null);

  // 実測高さを報告（内容変化で ResizeObserver が再計測 → Canvas が再レイアウト）。
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const report = () => onMeasure(node.id, el.offsetHeight);
    report();
    const ro = new ResizeObserver(report);
    ro.observe(el);
    return () => ro.disconnect();
  }, [node.id, onMeasure]);

  const isAdv = (v: ConstraintViolation): boolean => v.severity === "advisory";
  const errViol = [...violations.filter((v) => !isAdv(v)), ...treeViolations];
  const advViol = violations.filter(isAdv);
  const fieldErr = new Set(violations.filter((v) => v.scope === "field" && !isAdv(v) && v.fieldKey).map((v) => v.fieldKey!));
  const fieldAdv = new Set(violations.filter((v) => v.scope === "field" && isAdv(v) && v.fieldKey).map((v) => v.fieldKey!));
  const cls = errViol.length ? " cbad" : advViol.length ? " cadvise" : "";
  const errTip = errViol.map((v) => `・${v.message}${v.errored ? "（評価エラー）" : ""}`).join("\n");
  const advTip = advViol.map((v) => `・${v.message}`).join("\n");

  return (
    <div
      ref={ref}
      className={`node${selected ? " sel" : ""}${cls}`}
      style={{ left: x - NODE_W / 2, top: y, width: NODE_W, background: t?.color ?? "#ddd" }}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    >
      <div className="ntype">{t?.label ?? node.type}</div>
      <div className="nbody">
        {fields.map((f, i) => {
          const val = node.fields[f.key];
          const has = !(val === "" || val == null);
          const err = fieldErr.has(f.key);
          const adv = fieldAdv.has(f.key);
          if (!has && !err) return null;
          const text = has ? (typeof val === "object" ? JSON.stringify(val) : String(val)) : "（未入力）";
          return (
            <div key={f.key} className={`kv${i === 0 ? " primary" : ""}${err ? " fbad" : adv ? " fadvise" : ""}`}>
              <span className="k">{f.label}:</span> {text}
              {err ? <span className="fmark">✕</span> : adv ? <span className="fmark adv">~</span> : null}
            </div>
          );
        })}
      </div>
      {errViol.length || advViol.length ? (
        <div className="badges">
          {errViol.length ? <span className="cbadge err" title={errTip}>⚠ {errViol.length}</span> : null}
          {advViol.length ? <span className="cbadge adv" title={advTip}>~ {advViol.length}</span> : null}
        </div>
      ) : null}
      {leafBad ? <div className="leafwarn" title="末端が terminal 型ではありません">⚠️</div> : null}
    </div>
  );
}
