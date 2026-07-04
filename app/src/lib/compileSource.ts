import * as monaco from "monaco-editor";
import { setupMonaco } from "./monacoSetup";
import { evaluateSchema, type EvalResult } from "./evaluateSchema";

let seq = 0;

/**
 * エディタを介さず source 文字列を評価する（インポート用）。
 * 一時的な Monaco モデルを作って TS worker で型チェック + トランスパイルし、Schema を得る。
 * monaco を動的 import 経由で使う側に置くことで、木ビューの初期ロードからは外している。
 */
export async function compileSource(source: string): Promise<EvalResult> {
  setupMonaco();
  const uri = monaco.Uri.parse(`file:///__import_${++seq}.ts`);
  const model = monaco.editor.getModel(uri) ?? monaco.editor.createModel(source, "typescript", uri);
  model.setValue(source);
  // worker がモデル + extraLib を取り込むのを待つ（即時だと diagnostics が空になることがある）。
  await new Promise((r) => setTimeout(r, 60));
  try {
    return await evaluateSchema(monaco, model);
  } finally {
    model.dispose();
  }
}
