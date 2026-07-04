import { useRef, useState } from "react";
import Editor, { type OnMount } from "@monaco-editor/react";
import * as monaco from "monaco-editor";
import { diffSchema, type MigrationOp, type Schema, type TreeDoc, type TreeNode } from "@tree-schema/core";
import { setupMonaco } from "../lib/monacoSetup";
import { evaluateSchema } from "../lib/evaluateSchema";
import { useEditor } from "../store";
import { MigrationModal } from "./MigrationModal";
import { SchemaReference } from "./SchemaReference";

setupMonaco();

interface Pending {
  schema: Schema;
  source: string;
  js?: string;
  doc: TreeDoc;
  ops: MigrationOp[];
}

export function SchemaEditor({ onApplied }: { onApplied: () => void }) {
  const { source, setSource, commitSchema } = useEditor();
  const modelRef = useRef<monaco.editor.ITextModel | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<Pending | null>(null);

  const onMount: OnMount = (editor) => {
    modelRef.current = editor.getModel();
  };

  const apply = async () => {
    const model = modelRef.current;
    if (!model) return;
    setBusy(true);
    setErr(null);
    const res = await evaluateSchema(monaco, model);
    setBusy(false);
    if (res.error) {
      setErr(res.error);
      return;
    }
    if (!res.schema) return;

    const { schema: oldSchema, roots } = useEditor.getState();
    const ops = diffSchema(oldSchema, res.schema);
    if (ops.length === 0) {
      // 構造変更なし（constraints / label など）。木を保持してそのまま確定。
      commitSchema(res.schema, source, res.js, structuredClone(roots) as TreeNode[]);
      onApplied();
      return;
    }
    setPending({ schema: res.schema, source, js: res.js, doc: { schemaId: oldSchema.id, roots }, ops });
  };

  return (
    <div className="schema-editor">
      <div className="se-bar">
        <span>スキーマ（TypeScript）</span>
        <button className="primary" disabled={busy} onClick={apply}>
          {busy ? "評価中…" : "適用"}
        </button>
      </div>
      <div className="se-main">
        <div className="se-monaco">
          <Editor
            height="100%"
            defaultLanguage="typescript"
            theme="vs"
            path="file:///schema.ts"
            value={source}
            onChange={(v) => setSource(v ?? "")}
            onMount={onMount}
            options={{
              minimap: { enabled: false },
              fontSize: 13,
              scrollBeyondLastLine: false,
              tabSize: 2,
              automaticLayout: true,
            }}
          />
        </div>
        <SchemaReference />
      </div>
      {err ? <pre className="se-err">{err}</pre> : null}

      {pending ? (
        <MigrationModal
          newSchema={pending.schema}
          doc={pending.doc}
          initialOps={pending.ops}
          onClose={() => setPending(null)}
          onApply={(migratedRoots) => {
            commitSchema(pending.schema, pending.source, pending.js, migratedRoots);
            setPending(null);
            onApplied();
          }}
        />
      ) : null}
    </div>
  );
}
