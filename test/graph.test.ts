import { describe, it, expect } from "vitest";
import {
  buildIndex,
  ancestors,
  descendants,
  siblings,
  depth,
  height,
  pathToRoot,
  lca,
  validateTree,
  defineSchema,
  type TreeNode,
  type TreeDoc,
} from "../src/index";

function n(id: string, type: string, children: TreeNode[] = []): TreeNode {
  return { id, type, fields: {}, children };
}

// a -> b -> d, a -> c ; e (別ルート)
const a = n("a", "Story", [n("b", "Rule", [n("d", "Example")]), n("c", "Rule")]);
const e = n("e", "Question", [n("f", "Answer")]);
const roots = [a, e];

describe("relations", () => {
  const idx = buildIndex(roots);
  it("ancestors d -> [b, a]", () => {
    expect(ancestors(idx, "d").map((x) => x.id)).toEqual(["b", "a"]);
  });
  it("descendants a -> b,d,c", () => {
    expect(descendants(a).map((x) => x.id).sort()).toEqual(["b", "c", "d"]);
  });
  it("siblings b -> [c]", () => {
    expect(siblings(idx, "b").map((x) => x.id)).toEqual(["c"]);
  });
  it("siblings of root a -> [e]", () => {
    expect(siblings(idx, "a").map((x) => x.id)).toEqual(["e"]);
  });
});

describe("metrics", () => {
  const idx = buildIndex(roots);
  it("depth: a=0, b=1, d=2", () => {
    expect(depth(idx, "a")).toBe(0);
    expect(depth(idx, "b")).toBe(1);
    expect(depth(idx, "d")).toBe(2);
  });
  it("height: a=2, b=1, d=0", () => {
    expect(height(a)).toBe(2);
    expect(height(a.children[0]!)).toBe(1);
  });
  it("pathToRoot d -> [d,b,a]", () => {
    expect(pathToRoot(idx, "d").map((x) => x.id)).toEqual(["d", "b", "a"]);
  });
  it("lca(d,c) = a, lca(d,b) = b, lca(d,f) = null", () => {
    expect(lca(idx, "d", "c")?.id).toBe("a");
    expect(lca(idx, "d", "b")?.id).toBe("b");
    expect(lca(idx, "d", "f")).toBeNull();
  });
});

describe("validateTree", () => {
  const schema = defineSchema({
    id: "t",
    name: "t",
    rootTypes: ["Story", "Question"],
    nodeTypes: {
      Story: { label: "Story", color: "#ccc", terminal: false, children: ["Rule"], fields: [] },
      Rule: { label: "Rule", color: "#88f", terminal: false, children: ["Example"], fields: [] },
      Example: { label: "Example", color: "#8f8", terminal: true, children: [], fields: [{ key: "g", label: "Given", type: "text" }] },
      Question: { label: "Question", color: "#fd7", terminal: false, children: ["Answer"], fields: [] },
      Answer: { label: "Answer", color: "#8f8", terminal: true, children: [], fields: [] },
    },
    invariants: { leafMustBeTerminal: true },
  });

  it("末端の Rule(c) は LEAF_NOT_TERMINAL を出す", () => {
    const doc: TreeDoc = { schemaId: "t", roots };
    const issues = validateTree(doc, schema);
    expect(issues.some((i) => i.code === "LEAF_NOT_TERMINAL" && i.nodeId === "c")).toBe(true);
  });

  it("全て terminal まで展開された木は整合", () => {
    const ok: TreeDoc = {
      schemaId: "t",
      roots: [
        n("s", "Story", [n("r", "Rule", [{ id: "ex", type: "Example", fields: { g: "given" }, children: [] }])]),
        n("q", "Question", [n("an", "Answer")]),
      ],
    };
    expect(validateTree(ok, schema)).toEqual([]);
  });

  it("許可されない子型は CHILD_TYPE", () => {
    const bad: TreeDoc = { schemaId: "t", roots: [n("s", "Story", [n("x", "Answer")])] };
    expect(validateTree(bad, schema).some((i) => i.code === "CHILD_TYPE")).toBe(true);
  });
});
