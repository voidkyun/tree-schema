import type * as Monaco from "monaco-editor";
import type { Schema } from "@tree-schema/core";

export interface EvalResult {
  schema?: Schema;
  /** 実行可能な module テキスト（import 剥がし済み）。永続化して再生成に使う。 */
  js?: string;
  error?: string;
}

/** import を剥がし identity な defineSchema を注入した実行可能 JS を Blob として動的 import し、default(Schema) を取り出す。 */
export async function instantiateSchema(js: string): Promise<EvalResult> {
  const url = URL.createObjectURL(new Blob([js], { type: "text/javascript" }));
  try {
    const mod = (await import(/* @vite-ignore */ url)) as { default?: unknown };
    const schema = mod.default as Schema | undefined;
    if (!schema || typeof schema !== "object" || !("nodeTypes" in schema) || !("rootTypes" in schema)) {
      return { error: "default export が Schema ではありません（export default defineSchema({...}) を確認）" };
    }
    return { schema, js };
  } catch (e) {
    return { error: "評価エラー: " + (e instanceof Error ? e.message : String(e)) };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Monaco 内蔵 TypeScript worker で schema.ts を評価する。
 * 1) 構文/意味エラーをマーカーから収集しゲート
 * 2) worker.getEmitOutput でトランスパイル
 * 3) `@tree-schema/core` の import を剥がし、identity な defineSchema を注入
 * 4) Blob として動的 import し default export(Schema) を取り出す
 * constraints の述語は ctx 経由で木を辿るため、core import を剥がしても壊れない。
 * iframe 完全隔離はしない（自分専用ツールのため過剰）。schema.ts は宣言のみの想定。
 */
export async function evaluateSchema(
  monaco: typeof Monaco,
  model: Monaco.editor.ITextModel,
): Promise<EvalResult> {
  const uri = model.uri.toString();
  const getWorker = await monaco.languages.typescript.getTypeScriptWorker();
  const client = await getWorker(model.uri);

  const diags = [
    ...(await client.getSyntacticDiagnostics(uri)),
    ...(await client.getSemanticDiagnostics(uri)),
  ];
  if (diags.length) {
    const msg = diags
      .map((d) => (typeof d.messageText === "string" ? d.messageText : d.messageText.messageText))
      .join("\n");
    return { error: "型エラー:\n" + msg };
  }

  const out = await client.getEmitOutput(uri);
  const file = out.outputFiles.find((f) => f.name.endsWith(".js"));
  if (!file) return { error: "トランスパイル結果が空です" };

  let js = file.text.replace(/import[^;\n]*from\s*["']@tree-schema\/core["'];?/g, "");
  js = "const defineSchema = (s) => s;\n" + js;

  return instantiateSchema(js);
}
