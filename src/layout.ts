import type { TreeNode } from "./types";

export interface LayoutOpts {
  nodeW?: number;
  /** 高さ未指定ノードの既定高さ。heights で個別に上書きできる。 */
  nodeH?: number;
  hGap?: number;
  vGap?: number;
  marginX?: number;
  marginY?: number;
  /** node id -> 実測高さ。指定がないノードは nodeH を使う。 */
  heights?: Map<string, number>;
}

export interface LayoutResult {
  /** node id -> 中心座標(x)・上端座標(y)・そのノードの高さ(h)。x はノード中央。 */
  positions: Map<string, { x: number; y: number; h: number }>;
  width: number;
  height: number;
}

/**
 * 葉数ベースの横詰めツリーレイアウト。高さは可変対応：同じ深さの行は
 * その深さの最大ノード高さで揃え、行 y を累積する（フィールドが増えても重ならない）。
 * 複数ルートは横に並べる。DOM 非依存。
 */
export function layoutTree(roots: TreeNode[], opts: LayoutOpts = {}): LayoutResult {
  const nodeW = opts.nodeW ?? 160;
  const nodeH = opts.nodeH ?? 92;
  const hGap = opts.hGap ?? 38;
  const vGap = opts.vGap ?? 64;
  const marginX = opts.marginX ?? 30;
  const marginY = opts.marginY ?? 24;
  const unit = nodeW + hGap;
  const h = (n: TreeNode): number => opts.heights?.get(n.id) ?? nodeH;

  // 1) 深さごとの行高さ（最大ノード高さ）を求める。
  const rowHeight: number[] = [];
  const measure = (n: TreeNode, depth: number): void => {
    rowHeight[depth] = Math.max(rowHeight[depth] ?? 0, h(n));
    for (const c of n.children) measure(c, depth + 1);
  };
  for (const r of roots) measure(r, 0);

  // 2) 行の上端 y を累積（前の行の高さ + vGap）。
  const rowY: number[] = [];
  let acc = marginY;
  for (let d = 0; d < rowHeight.length; d++) {
    rowY[d] = acc;
    acc += (rowHeight[d] ?? nodeH) + vGap;
  }

  const positions = new Map<string, { x: number; y: number; h: number }>();
  const leafCount = (n: TreeNode): number =>
    n.children.length === 0 ? 1 : n.children.reduce((s, c) => s + leafCount(c), 0);

  const assign = (n: TreeNode, depth: number, leftUnit: number): void => {
    const y = rowY[depth] ?? marginY;
    let x: number;
    if (n.children.length === 0) {
      x = marginX + leftUnit * unit + (unit - hGap) / 2;
    } else {
      let cur = leftUnit;
      for (const c of n.children) {
        assign(c, depth + 1, cur);
        cur += leafCount(c);
      }
      const first = positions.get(n.children[0]!.id)!;
      const last = positions.get(n.children[n.children.length - 1]!.id)!;
      x = (first.x + last.x) / 2;
    }
    positions.set(n.id, { x, y, h: h(n) });
  };

  let cur = 0;
  for (const r of roots) {
    assign(r, 0, cur);
    cur += leafCount(r);
  }

  const width = Math.max(marginX * 2 + cur * unit, 600);
  const height = Math.max(acc - vGap + marginY, 400);
  return { positions, width, height };
}
