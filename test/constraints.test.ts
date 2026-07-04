import { describe, it, expect } from "vitest";
import {
  defineSchema,
  evaluateConstraints,
  fieldViolationKey,
  type Schema,
  type TreeDoc,
  type TreeNode,
} from "../src/index";

function n(id: string, type: string, fields: Record<string, unknown>, children: TreeNode[] = []): TreeNode {
  return { id, type, fields, children };
}

// Table -> Column。constraints を全スコープ使う。
const schema: Schema = defineSchema({
  id: "t",
  name: "t",
  rootTypes: ["Table"],
  nodeTypes: {
    Table: {
      label: "Table",
      color: "#ccc",
      terminal: false,
      children: ["Column"],
      fields: [{ key: "name", label: "name", type: "varchar" }],
      // tree っぽい node 述語ではなく node scope: テーブル名は小文字
      constraints: [
        { id: "table.lower", message: "テーブル名は小文字", check: (node) => String(node.fields.name) === String(node.fields.name).toLowerCase() },
      ],
    },
    Column: {
      label: "Column",
      color: "#8f8",
      terminal: true,
      children: [],
      fields: [
        { key: "name", label: "name", type: "varchar", constraints: [
          { id: "col.name.len", message: "カラム名は10文字以内", check: (v) => String(v).length <= 10 },
        ] },
        { key: "pk", label: "pk", type: "boolean" },
        { key: "nullable", label: "nullable", type: "boolean" },
      ],
      // node scope: 主キーは NOT NULL
      constraints: [
        { id: "col.pk.notnull", message: "主キーは NOT NULL", check: (node) => !(node.fields.pk === true && node.fields.nullable === true) },
      ],
    },
  },
  constraints: {
    // tree scope: 各テーブルに主キーが1つ
    tree: [
      { id: "table.onepk", message: "テーブルに主キーが1つ必要", check: (root, ctx) => ctx.descendants(root).filter((c) => c.type === "Column" && c.fields.pk === true).length === 1 },
    ],
    // forest scope: テーブル名は一意
    forest: [
      { id: "forest.uniqtable", message: "テーブル名は一意", check: (roots) => {
        const names = roots.filter((r) => r.type === "Table").map((r) => String(r.fields.name));
        return new Set(names).size === names.length;
      } },
    ],
  },
});

describe("evaluateConstraints", () => {
  it("全制約を満たす forest は ok", () => {
    const doc: TreeDoc = {
      schemaId: "t",
      roots: [
        n("t1", "Table", { name: "users" }, [
          n("c1", "Column", { name: "id", pk: true, nullable: false }),
          n("c2", "Column", { name: "email", pk: false, nullable: false }),
        ]),
      ],
    };
    const rep = evaluateConstraints(doc, schema);
    expect(rep.ok).toBe(true);
    expect(rep.violations).toEqual([]);
  });

  it("field / node / tree / forest 各スコープの違反を検出する", () => {
    const doc: TreeDoc = {
      schemaId: "t",
      roots: [
        n("t1", "Table", { name: "Users" /* 大文字: node 違反 */ }, [
          n("c1", "Column", { name: "id", pk: true, nullable: true /* pk なのに null: node 違反 */ }),
          n("c2", "Column", { name: "very_long_column_name" /* 10超: field 違反 */, pk: true, nullable: false }),
          // pk が2つ: tree 違反
        ]),
        n("t2", "Table", { name: "Users" /* 重複 + 大文字 */ }, [
          n("c3", "Column", { name: "id", pk: false, nullable: false }),
          // pk 0個: tree 違反
        ]),
      ],
    };
    const rep = evaluateConstraints(doc, schema);
    expect(rep.ok).toBe(false);

    // field
    expect(rep.byField.get(fieldViolationKey("c2", "name"))?.some((v) => v.constraintId === "col.name.len")).toBe(true);
    // node (Column pk/null)
    expect(rep.byNode.get("c1")?.some((v) => v.constraintId === "col.pk.notnull")).toBe(true);
    // node (Table 大文字) — t1, t2 とも
    expect(rep.byNode.get("t1")?.some((v) => v.constraintId === "table.lower")).toBe(true);
    expect(rep.byNode.get("t2")?.some((v) => v.constraintId === "table.lower")).toBe(true);
    // tree (pk 数)
    expect(rep.byTree.get("t1")?.some((v) => v.constraintId === "table.onepk")).toBe(true);
    expect(rep.byTree.get("t2")?.some((v) => v.constraintId === "table.onepk")).toBe(true);
    // forest (重複)
    expect(rep.forest.some((v) => v.constraintId === "forest.uniqtable")).toBe(true);
  });

  it("述語が例外を投げたら errored 付き違反になる", () => {
    const s: Schema = defineSchema({
      id: "x",
      name: "x",
      rootTypes: ["A"],
      nodeTypes: {
        A: { label: "A", color: "#ccc", terminal: true, children: [], fields: [],
          constraints: [{ id: "boom", message: "boom", check: () => { throw new Error("boom"); } }] },
      },
    });
    const doc: TreeDoc = { schemaId: "x", roots: [n("a1", "A", {})] };
    const rep = evaluateConstraints(doc, s);
    expect(rep.ok).toBe(false);
    expect(rep.byNode.get("a1")?.[0]?.errored).toBe(true);
  });

  it("advisory 違反はフラグのみで ok をブロックしない", () => {
    const s: Schema = defineSchema({
      id: "adv",
      name: "adv",
      rootTypes: ["A"],
      nodeTypes: {
        A: { label: "A", color: "#ccc", terminal: true, children: [], fields: [],
          constraints: [
            { id: "hint", message: "助言", severity: "advisory", check: () => false },
          ] },
      },
    });
    const doc: TreeDoc = { schemaId: "adv", roots: [n("a1", "A", {})] };
    const rep = evaluateConstraints(doc, s);
    expect(rep.ok).toBe(true); // advisory はブロックしない
    expect(rep.violations.length).toBe(1);
    expect(rep.byNode.get("a1")?.[0]?.severity).toBe("advisory");
  });

  it("error と advisory が混在: error があれば ok=false", () => {
    const s: Schema = defineSchema({
      id: "mix",
      name: "mix",
      rootTypes: ["A"],
      nodeTypes: {
        A: { label: "A", color: "#ccc", terminal: true, children: [], fields: [],
          constraints: [
            { id: "adv", message: "助言", severity: "advisory", check: () => false },
            { id: "err", message: "エラー", check: () => false }, // 省略時 error
          ] },
      },
    });
    const rep = evaluateConstraints({ schemaId: "mix", roots: [n("a1", "A", {})] }, s);
    expect(rep.ok).toBe(false);
    expect(rep.byNode.get("a1")?.find((v) => v.constraintId === "err")?.severity).toBe("error");
    expect(rep.byNode.get("a1")?.find((v) => v.constraintId === "adv")?.severity).toBe("advisory");
  });
});
