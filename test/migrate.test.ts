import { describe, it, expect } from "vitest";
import {
  applyMigration,
  diffSchema,
  defineSchema,
  type MigrationOp,
  type Schema,
  type TreeDoc,
  type TreeNode,
} from "../src/index";

function n(id: string, type: string, fields: Record<string, unknown>, children: TreeNode[] = []): TreeNode {
  return { id, type, fields, children };
}

const oldS: Schema = defineSchema({
  id: "s",
  name: "s",
  rootTypes: ["Table"],
  nodeTypes: {
    Table: { label: "Table", color: "#ccc", terminal: false, children: ["Column", "Legacy"], fields: [
      { key: "name", label: "name", type: "varchar" },
      { key: "note", label: "note", type: "text" },
    ] },
    Column: { label: "Column", color: "#8f8", terminal: true, children: [], fields: [
      { key: "name", label: "name", type: "varchar" },
      { key: "len", label: "len", type: "varchar" },
    ] },
    Legacy: { label: "Legacy", color: "#aaa", terminal: true, children: [], fields: [] },
  },
});

const newS: Schema = defineSchema({
  id: "s",
  name: "s",
  rootTypes: ["Table"],
  nodeTypes: {
    Table: { label: "Table", color: "#ccc", terminal: false, children: ["Column"], fields: [
      { key: "name", label: "name", type: "varchar" },
      // note 削除、comment 追加
      { key: "comment", label: "comment", type: "text" },
    ] },
    Column: { label: "Column", color: "#8f8", terminal: true, children: [], fields: [
      { key: "name", label: "name", type: "varchar" },
      { key: "len", label: "len", type: "integer" }, // varchar -> integer
    ] },
    // Legacy 削除
  },
});

describe("diffSchema", () => {
  it("追加/削除/型変更を ops に出す", () => {
    const ops = diffSchema(oldS, newS);
    expect(ops).toContainEqual({ op: "removeNodeType", type: "Legacy", strategy: "delete" });
    expect(ops).toContainEqual({ op: "addField", type: "Table", key: "comment" });
    expect(ops).toContainEqual({ op: "removeField", type: "Table", key: "note" });
    expect(ops).toContainEqual({ op: "retypeField", type: "Column", key: "len", to: "integer" });
  });
});

describe("applyMigration", () => {
  const doc: TreeDoc = {
    schemaId: "s",
    roots: [
      n("t1", "Table", { name: "users", note: "メモ" }, [
        n("c1", "Column", { name: "id", len: "20" }),
        n("lg", "Legacy", {}),
      ]),
    ],
  };

  it("自動 ops でデータ移行（note消去・comment追加・len整数化・Legacy削除）", () => {
    const ops = diffSchema(oldS, newS);
    const { doc: out } = applyMigration(ops, doc, newS);
    const t1 = out.roots[0]!;
    expect("note" in t1.fields).toBe(false);
    expect(t1.fields.comment).toBe(""); // text 既定値
    expect(t1.children.map((c) => c.type)).toEqual(["Column"]); // Legacy 削除
    expect(t1.children[0]!.fields.len).toBe(20); // "20" -> 20
  });

  it("入力は非破壊", () => {
    const ops = diffSchema(oldS, newS);
    applyMigration(ops, doc, newS);
    expect("note" in doc.roots[0]!.fields).toBe(true);
    expect(doc.roots[0]!.children.length).toBe(2);
  });

  it("renameField でデータ保全", () => {
    const plan: MigrationOp[] = [{ op: "renameField", type: "Table", from: "note", to: "comment" }];
    const { doc: out } = applyMigration(plan, doc, newS);
    expect(out.roots[0]!.fields.comment).toBe("メモ");
    expect("note" in out.roots[0]!.fields).toBe(false);
  });

  it("removeNodeType unwrap は子を親へ引き上げる", () => {
    const nested: TreeDoc = {
      schemaId: "s",
      roots: [n("t1", "Table", { name: "x" }, [
        n("g", "Legacy", {}, [n("c1", "Column", { name: "id", len: "1" })]),
      ])],
    };
    const plan: MigrationOp[] = [{ op: "removeNodeType", type: "Legacy", strategy: "unwrap" }];
    const { doc: out } = applyMigration(plan, nested, newS);
    expect(out.roots[0]!.children.map((c) => c.type)).toEqual(["Column"]);
    expect(out.roots[0]!.children[0]!.id).toBe("c1");
  });
});
