import type { Schema, TreeDoc, TreeNode } from "../types";
import { validateField } from "../field-types";

export interface ValidationIssue {
  nodeId?: string;
  code: "ROOT_TYPE" | "CHILD_TYPE" | "UNKNOWN_TYPE" | "LEAF_NOT_TERMINAL" | "FIELD_TYPE" | "REQUIRED_MISSING";
  message: string;
}

/** 木全体をスキーマに照らして検証する。違反の配列を返す（空なら整合）。 */
export function validateTree(doc: TreeDoc, schema: Schema): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  for (const r of doc.roots) {
    if (!schema.rootTypes.includes(r.type)) {
      issues.push({ nodeId: r.id, code: "ROOT_TYPE", message: `ルートに「${r.type}」は置けません（許可: ${schema.rootTypes.join(", ")}）` });
    }
  }

  const visit = (n: TreeNode): void => {
    const t = schema.nodeTypes[n.type];
    if (!t) {
      issues.push({ nodeId: n.id, code: "UNKNOWN_TYPE", message: `未知の型「${n.type}」` });
      return;
    }
    const isLeaf = n.children.length === 0;
    if (schema.invariants?.leafMustBeTerminal && isLeaf && !t.terminal) {
      issues.push({ nodeId: n.id, code: "LEAF_NOT_TERMINAL", message: `「${t.label}」が末端のままです（terminal 型まで展開してください）` });
    }
    for (const f of t.fields) {
      const fi = validateField(f, n.fields[f.key]);
      if (fi) issues.push({ nodeId: n.id, code: fi.code, message: fi.message });
    }
    for (const c of n.children) {
      if (!t.children.includes(c.type)) {
        issues.push({ nodeId: c.id, code: "CHILD_TYPE", message: `「${t.label}」の子に「${c.type}」は許可されていません` });
      }
      visit(c);
    }
  };
  for (const r of doc.roots) visit(r);
  return issues;
}
