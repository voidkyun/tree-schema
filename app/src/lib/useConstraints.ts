import { useMemo } from "react";
import { evaluateConstraints, type ConstraintReport } from "@tree-schema/core";
import { useEditor } from "../store";
import { mergeReport } from "./designAdvisory";

/** 構造/制約レポート（sync）に、設計依存 advisory（非同期・フラグのみ）を重ねて返す。 */
export function useConstraintReport(): ConstraintReport {
  const schema = useEditor((s) => s.schema);
  const roots = useEditor((s) => s.roots);
  const advisories = useEditor((s) => s.advisories);
  const base = useMemo(() => evaluateConstraints({ schemaId: schema.id, roots }, schema), [schema, roots]);
  return useMemo(() => mergeReport(base, advisories), [base, advisories]);
}
