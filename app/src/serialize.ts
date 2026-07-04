import type { Schema, TreeNode } from "@tree-schema/core";

/** スキーマで宣言された field のみを残した plain オブジェクトへ。 */
function toPlain(n: TreeNode, schema: Schema): Record<string, unknown> {
  const o: Record<string, unknown> = { type: n.type };
  const t = schema.nodeTypes[n.type];
  if (t) {
    for (const f of t.fields) {
      const v = n.fields[f.key];
      if (v !== "" && v != null) o[f.key] = v;
    }
  }
  if (n.children.length) o.children = n.children.map((c) => toPlain(c, schema));
  return o;
}

export function toJSON(roots: TreeNode[], schema: Schema): string {
  return JSON.stringify({ schema: schema.id, roots: roots.map((r) => toPlain(r, schema)) }, null, 2);
}

function yamlScalar(v: unknown): string {
  if (typeof v === "boolean" || typeof v === "number") return String(v);
  const s = String(v);
  if (s === "" || /[:#\-?*&!|>'"%@`{}[\],]|^\s|\s$/.test(s)) return JSON.stringify(s);
  return s;
}

export function toYAML(roots: TreeNode[], schema: Schema): string {
  const lines: string[] = [`schema: ${schema.id}`, "roots:"];
  const emit = (n: TreeNode, indent: number): void => {
    const pad = "  ".repeat(indent);
    lines.push(`${pad}- type: ${n.type}`);
    const t = schema.nodeTypes[n.type];
    if (t) {
      for (const f of t.fields) {
        const v = n.fields[f.key];
        if (v === "" || v == null) continue;
        const sv = String(v);
        if (typeof v === "string" && sv.includes("\n")) {
          lines.push(`${pad}  ${f.key}: |-`);
          for (const l of sv.split("\n")) lines.push(`${pad}    ${l}`);
        } else {
          lines.push(`${pad}  ${f.key}: ${yamlScalar(v)}`);
        }
      }
    }
    if (n.children.length) {
      lines.push(`${pad}  children:`);
      for (const c of n.children) emit(c, indent + 2);
    }
  };
  for (const r of roots) emit(r, 1);
  return lines.join("\n");
}
