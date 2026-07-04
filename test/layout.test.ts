import { describe, it, expect } from "vitest";
import { layoutTree, type TreeNode } from "../src/index";

function n(id: string, children: TreeNode[] = []): TreeNode {
  return { id, type: "X", fields: {}, children };
}

describe("layoutTree 可変高さ", () => {
  const root = n("r", [n("a"), n("b")]);

  it("同じ深さの行は最大高さで揃い、行 y が累積する", () => {
    const heights = new Map([["r", 100], ["a", 50], ["b", 200]]);
    const { positions } = layoutTree([root], { heights, marginY: 24, vGap: 64 });
    const r = positions.get("r")!;
    const a = positions.get("a")!;
    const b = positions.get("b")!;
    expect(r.y).toBe(24); // 先頭行
    expect(a.y).toBe(188); // 24 + 100(row0 max) + 64(vGap)
    expect(b.y).toBe(188); // 同じ行は揃う
    expect(a.h).toBe(50);
    expect(b.h).toBe(200);
  });

  it("heights 未指定は nodeH 既定にフォールバック", () => {
    const { positions } = layoutTree([root], { nodeH: 92, marginY: 24, vGap: 64 });
    expect(positions.get("a")!.y).toBe(24 + 92 + 64);
    expect(positions.get("r")!.h).toBe(92);
  });

  it("親は子の中央に置かれる", () => {
    const { positions } = layoutTree([root]);
    const r = positions.get("r")!;
    const a = positions.get("a")!;
    const b = positions.get("b")!;
    expect(r.x).toBeCloseTo((a.x + b.x) / 2);
  });
});
