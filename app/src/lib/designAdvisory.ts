import { useEffect } from "react";
import { fieldViolationKey, type ConstraintReport, type ConstraintViolation, type Schema, type TreeNode } from "@tree-schema/core";
import { useEditor } from "../store";
import { getDesignJudge } from "./designJudge";

export interface TextFieldRef {
  nodeId: string;
  fieldKey: string;
  text: string;
}

/**
 * このスキーマで設計依存 advisory が有効か。アプリ規約として schema.meta.designAdvisory を見る。
 * アプリ提供の BDD Example Mapping スキーマだけがこれを立てる。汎用木エディタのスキーマでは
 * 無印＝機能は不可視（任意 schema に判定をぶら下げない）。
 */
export function designAdvisorySchema(schema: Schema): boolean {
  return schema.meta?.designAdvisory === true;
}

/**
 * 設計依存判定の対象テキストを集める。散文の要件だけを対象にするため `text` 型のみ
 * （`varchar` は名前・タイトル等のラベルなので除外）、かつ極端に短い値は除く。
 */
export function collectTextFields(roots: TreeNode[], schema: Schema): TextFieldRef[] {
  const out: TextFieldRef[] = [];
  const visit = (n: TreeNode): void => {
    const t = schema.nodeTypes[n.type];
    if (t) {
      for (const f of t.fields) {
        if (f.type !== "text") continue;
        const v = n.fields[f.key];
        if (typeof v === "string" && v.trim().length >= 6) out.push({ nodeId: n.id, fieldKey: f.key, text: v });
      }
    }
    n.children.forEach(visit);
  };
  roots.forEach(visit);
  return out;
}

/** sync な構造/制約レポートに、非同期で得た advisory（フラグのみ）を重ねる。ok は変えない。 */
export function mergeReport(base: ConstraintReport, advisories: ConstraintViolation[]): ConstraintReport {
  if (advisories.length === 0) return base;
  const byField = new Map(base.byField);
  const byNode = new Map(base.byNode);
  for (const v of advisories) {
    const fk = fieldViolationKey(v.nodeId!, v.fieldKey!);
    byField.set(fk, [...(byField.get(fk) ?? []), v]);
    byNode.set(v.nodeId!, [...(byNode.get(v.nodeId!) ?? []), v]);
  }
  return { ...base, violations: [...base.violations, ...advisories], byField, byNode };
}

/**
 * 設計依存 advisory のエンジン。App で一度だけ呼ぶ。enabled の間、text フィールド値を
 * モデルに通し（debounce）、結果を store の advisories に書き込む。重い処理はここ一箇所に集約する。
 */
export function useDesignAdvisoryEngine(): void {
  const enabled = useEditor((s) => s.designEnabled);
  const roots = useEditor((s) => s.roots);
  const schema = useEditor((s) => s.schema);

  useEffect(() => {
    const { setAdvisories, setDesignStatus } = useEditor.getState();
    // BDD Example Mapping スキーマ（meta.designAdvisory）でのみ動く。汎用スキーマでは何もしない。
    if (!enabled || !designAdvisorySchema(schema)) {
      setAdvisories([]);
      setDesignStatus("off");
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      const items = collectTextFields(roots, schema);
      if (items.length === 0) {
        setAdvisories([]);
        setDesignStatus("ready");
        return;
      }
      setDesignStatus("loading");
      try {
        const judge = await getDesignJudge();
        const results = await judge.classify(items.map((i) => i.text));
        if (cancelled) return;
        const advisories: ConstraintViolation[] = items.flatMap((it, i) =>
          results[i]!.flagged
            ? [{
                scope: "field" as const,
                constraintId: "design.dependence",
                message: `設計依存の疑い（要件は実装に依存しない言葉で）`,
                severity: "advisory" as const,
                nodeId: it.nodeId,
                fieldKey: it.fieldKey,
              }]
            : [],
        );
        setAdvisories(advisories);
        setDesignStatus("ready");
      } catch {
        if (!cancelled) setDesignStatus("error");
      }
    }, 500);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [enabled, roots, schema]);
}
