import type { TreeNode } from "@tree-schema/core";

/** スキーマ（TS source）と木を1ファイルに収めた可搬バンドル。インポートで source を再評価して復元する。 */
export interface TreeSchemaBundle {
  format: "tree-schema/v1";
  schema: { id: string; name: string; source: string };
  roots: TreeNode[];
}

export type BundleFormat = "json" | "yaml";

export function makeBundle(id: string, name: string, source: string, roots: TreeNode[]): TreeSchemaBundle {
  return { format: "tree-schema/v1", schema: { id, name, source }, roots };
}

/** バンドルを JSON か YAML 文字列にする（yaml は動的 import で初期バンドルから外す）。 */
export async function serializeBundle(bundle: TreeSchemaBundle, format: BundleFormat): Promise<string> {
  if (format === "yaml") {
    const YAML = await import("yaml");
    return YAML.stringify(bundle);
  }
  return JSON.stringify(bundle, null, 2);
}

/** バンドルをファイルとしてダウンロードさせる。 */
export async function downloadBundle(bundle: TreeSchemaBundle, format: BundleFormat): Promise<void> {
  const text = await serializeBundle(bundle, format);
  const ext = format === "yaml" ? "yaml" : "json";
  const mime = format === "yaml" ? "text/yaml" : "application/json";
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${bundle.schema.id || "schema"}.tree-schema.${ext}`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function validate(v: unknown): { bundle?: TreeSchemaBundle; error?: string } {
  const b = v as Partial<TreeSchemaBundle>;
  if (!b || b.format !== "tree-schema/v1") return { error: "format が tree-schema/v1 ではありません" };
  if (!b.schema || typeof b.schema.source !== "string") return { error: "schema.source がありません" };
  if (!Array.isArray(b.roots)) return { error: "roots が配列ではありません" };
  return { bundle: b as TreeSchemaBundle };
}

/** JSON でも YAML でも取り込む（まず JSON、ダメなら YAML をパース）。 */
export async function parseBundle(text: string): Promise<{ bundle?: TreeSchemaBundle; error?: string }> {
  let v: unknown;
  try {
    v = JSON.parse(text);
  } catch {
    try {
      const YAML = await import("yaml");
      v = YAML.parse(text);
    } catch (e) {
      return { error: "JSON / YAML として読めません: " + (e instanceof Error ? e.message : String(e)) };
    }
  }
  return validate(v);
}
