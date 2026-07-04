import * as monaco from "monaco-editor";
import { loader } from "@monaco-editor/react";
import editorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";
import tsWorker from "monaco-editor/esm/vs/language/typescript/ts.worker?worker";
// 配布ライブラリのビルド済み型を Monaco に注入し、schema.ts に補完・型エラーを効かせる。
import coreDts from "../../../dist/index.d.ts?raw";

let done = false;

/** Monaco を CDN ではなく自前バンドルの worker で動かし、@tree-schema/core の d.ts を注入する。 */
export function setupMonaco(): void {
  if (done) return;
  done = true;

  self.MonacoEnvironment = {
    getWorker(_id, label) {
      if (label === "typescript" || label === "javascript") return new tsWorker();
      return new editorWorker();
    },
  };

  const ts = monaco.languages.typescript;
  ts.typescriptDefaults.setCompilerOptions({
    target: ts.ScriptTarget.ES2020,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.NodeJs,
    strict: true,
    allowNonTsExtensions: true,
    paths: { "@tree-schema/core": ["file:///node_modules/@tree-schema/core/index.d.ts"] },
  });
  ts.typescriptDefaults.addExtraLib(
    coreDts,
    "file:///node_modules/@tree-schema/core/index.d.ts",
  );

  registerSnippets();
  loader.config({ monaco });
}

/** schema.ts 用の補完スニペット（field / nodeType / 各スコープの constraint）。 */
function registerSnippets(): void {
  monaco.languages.registerCompletionItemProvider("typescript", {
    provideCompletionItems(model, position) {
      const word = model.getWordUntilPosition(position);
      const range = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endColumn: word.endColumn,
      };
      const snip = (label: string, insertText: string, documentation: string) => ({
        label,
        kind: monaco.languages.CompletionItemKind.Snippet,
        insertText,
        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
        documentation,
        range,
      });
      return {
        suggestions: [
          snip("field", '{ key: "${1:key}", label: "${2:label}", type: "${3:text}" }', "field 定義"),
          snip("field:enum", '{ key: "${1:key}", label: "${2:label}", type: "enum", options: ["${3:a}", "${4:b}"] }', "enum field"),
          snip("nodeType", '${1:Name}: { label: "${2:Name}", color: "${3:#c3ccd5}", terminal: ${4:false}, children: [${5}], fields: [\n  ${6}\n] }', "nodeType 定義"),
          snip("constraint:field", 'constraints: [\n  { id: "${1:id}", message: "${2:メッセージ}", check: (v) => ${3:String(v).length <= 60} },\n]', "field scope（value のみ）"),
          snip("constraint:node", 'constraints: [\n  { id: "${1:id}", message: "${2:メッセージ}", check: (node) => ${3:node.fields.x != null} },\n]', "node scope（node 内の field）"),
          snip("constraint:tree", 'constraints: {\n  tree: [\n    { id: "${1:id}", message: "${2:メッセージ}", check: (root, ctx) => ${3:ctx.descendants(root).length > 0} },\n  ],\n}', "tree scope（tree 内の node）"),
          snip("constraint:forest", 'constraints: {\n  forest: [\n    { id: "${1:id}", message: "${2:メッセージ}", check: (roots) => ${3:roots.length > 0} },\n  ],\n}', "forest scope（全体）"),
        ],
      };
    },
  });
}
