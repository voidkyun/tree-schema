import type { FieldType, Schema, TreeDoc, TreeNode } from "./types";
import { coerceFieldValue, defaultFieldValue } from "./field-types";

/**
 * スキーマ変更を木へ反映する移行操作（宣言的・編集可能）。
 * diffSchema が構造差から自動生成し、ユーザーが編集してから applyMigration で適用する。
 * 自動生成はリネームを「removeNodeType + addNodeType」等として出すため、
 * これを手で renameNodeType / renameField に書き換えればデータを保全できる。
 */
export type MigrationOp =
  | { op: "addNodeType"; type: string }
  | { op: "removeNodeType"; type: string; strategy?: "delete" | "unwrap" }
  | { op: "renameNodeType"; from: string; to: string }
  | { op: "addField"; type: string; key: string }
  | { op: "removeField"; type: string; key: string }
  | { op: "renameField"; type: string; from: string; to: string }
  | { op: "retypeField"; type: string; key: string; to: FieldType };

export interface MigrationEffect {
  op: MigrationOp;
  /** 日本語の影響説明（件数つき）。 */
  description: string;
  /** 影響を受けたノード id。 */
  affectedNodeIds: string[];
}

export interface MigrationResult {
  /** 移行後の木（新規オブジェクト、入力は非破壊）。 */
  doc: TreeDoc;
  effects: MigrationEffect[];
}

/**
 * 旧 → 新スキーマの構造差から移行操作を自動生成する。
 * 型名・フィールドキーの一致で add / remove / 型変更を判定する（リネーム推定はしない）。
 */
export function diffSchema(oldS: Schema, newS: Schema): MigrationOp[] {
  const ops: MigrationOp[] = [];
  const oldTypeNames = Object.keys(oldS.nodeTypes);
  const newTypeNames = Object.keys(newS.nodeTypes);

  for (const t of oldTypeNames) {
    if (!newS.nodeTypes[t]) ops.push({ op: "removeNodeType", type: t, strategy: "delete" });
  }
  for (const t of newTypeNames) {
    if (!oldS.nodeTypes[t]) ops.push({ op: "addNodeType", type: t });
  }
  for (const t of oldTypeNames) {
    const nt = newS.nodeTypes[t];
    const ot = oldS.nodeTypes[t];
    if (!nt || !ot) continue; // 削除/新規は上で処理済み
    const oldFields = new Map(ot.fields.map((f) => [f.key, f]));
    const newFields = new Map(nt.fields.map((f) => [f.key, f]));
    for (const k of newFields.keys()) {
      if (!oldFields.has(k)) ops.push({ op: "addField", type: t, key: k });
    }
    for (const k of oldFields.keys()) {
      if (!newFields.has(k)) ops.push({ op: "removeField", type: t, key: k });
    }
    for (const [k, of_] of oldFields) {
      const nf = newFields.get(k);
      if (nf && nf.type !== of_.type) ops.push({ op: "retypeField", type: t, key: k, to: nf.type });
    }
  }
  return ops;
}

/**
 * 移行操作を木へ適用する（非破壊）。返り値の effects が dry-run の表示内容になる。
 * 操作は配列順に適用される（renameNodeType を先に置く等、順序に意味がある）。
 */
export function applyMigration(plan: readonly MigrationOp[], doc: TreeDoc, newSchema: Schema): MigrationResult {
  let roots: TreeNode[] = structuredClone(doc.roots) as TreeNode[];
  const effects: MigrationEffect[] = [];

  const allOfType = (type: string): TreeNode[] => {
    const out: TreeNode[] = [];
    const walk = (n: TreeNode): void => {
      if (n.type === type) out.push(n);
      n.children.forEach(walk);
    };
    roots.forEach(walk);
    return out;
  };
  const fieldDef = (type: string, key: string) => newSchema.nodeTypes[type]?.fields.find((f) => f.key === key);

  for (const op of plan) {
    switch (op.op) {
      case "addNodeType":
        effects.push({ op, description: `型「${op.type}」を追加（既存データへの影響なし）`, affectedNodeIds: [] });
        break;

      case "removeNodeType": {
        const strategy = op.strategy ?? "delete";
        const targets = allOfType(op.type).map((n) => n.id);
        if (strategy === "delete") {
          const prune = (list: TreeNode[]): TreeNode[] =>
            list.filter((n) => n.type !== op.type).map((n) => ({ ...n, children: prune(n.children) }));
          roots = prune(roots);
          effects.push({ op, description: `型「${op.type}」の ${targets.length} ノードを部分木ごと削除`, affectedNodeIds: targets });
        } else {
          const lift = (list: TreeNode[]): TreeNode[] => {
            const out: TreeNode[] = [];
            for (const n of list) {
              const kids = lift(n.children);
              if (n.type === op.type) out.push(...kids);
              else out.push({ ...n, children: kids });
            }
            return out;
          };
          roots = lift(roots);
          effects.push({ op, description: `型「${op.type}」の ${targets.length} ノードを除去し子を親へ引き上げ`, affectedNodeIds: targets });
        }
        break;
      }

      case "renameNodeType": {
        const targets = allOfType(op.from);
        for (const n of targets) n.type = op.to;
        effects.push({ op, description: `型「${op.from}」→「${op.to}」にリネーム（${targets.length} ノード、データ保全）`, affectedNodeIds: targets.map((n) => n.id) });
        break;
      }

      case "addField": {
        const field = fieldDef(op.type, op.key);
        const affected: string[] = [];
        for (const node of allOfType(op.type)) {
          if (!(op.key in node.fields)) {
            node.fields[op.key] = field ? defaultFieldValue(field) : null;
            affected.push(node.id);
          }
        }
        effects.push({ op, description: `型「${op.type}」に field「${op.key}」を ${affected.length} ノードへ追加（既定値）`, affectedNodeIds: affected });
        break;
      }

      case "removeField": {
        const affected: string[] = [];
        for (const node of allOfType(op.type)) {
          if (op.key in node.fields) {
            delete node.fields[op.key];
            affected.push(node.id);
          }
        }
        effects.push({ op, description: `型「${op.type}」の field「${op.key}」を ${affected.length} ノードから削除`, affectedNodeIds: affected });
        break;
      }

      case "renameField": {
        const affected: string[] = [];
        for (const node of allOfType(op.type)) {
          if (op.from in node.fields) {
            node.fields[op.to] = node.fields[op.from];
            delete node.fields[op.from];
            affected.push(node.id);
          }
        }
        effects.push({ op, description: `型「${op.type}」の field「${op.from}」→「${op.to}」にリネーム（${affected.length} ノード）`, affectedNodeIds: affected });
        break;
      }

      case "retypeField": {
        const field = fieldDef(op.type, op.key);
        const affected: string[] = [];
        for (const node of allOfType(op.type)) {
          const v = node.fields[op.key];
          if (op.key in node.fields && v != null && v !== "") {
            node.fields[op.key] = field ? coerceFieldValue(field, v) : v;
            affected.push(node.id);
          }
        }
        effects.push({ op, description: `型「${op.type}」の field「${op.key}」を ${op.to} に型変換（${affected.length} ノード）`, affectedNodeIds: affected });
        break;
      }
    }
  }

  return { doc: { schemaId: newSchema.id, roots }, effects };
}
