import type { TreeNode } from "../types";
import { ancestors, type TreeIndex } from "./relations";

/** ルートからの深さ（root = 0）。 */
export function depth(idx: TreeIndex, id: string): number {
  return ancestors(idx, id).length;
}

/** 部分木の高さ（葉 = 0）。 */
export function height(node: TreeNode): number {
  return node.children.length === 0 ? 0 : 1 + Math.max(...node.children.map(height));
}

/** 自分から root までのパス（[self, ..., root]）。 */
export function pathToRoot(idx: TreeIndex, id: string): TreeNode[] {
  const self = idx.byId.get(id);
  if (!self) return [];
  return [self, ...ancestors(idx, id)];
}

/** 最小共通祖先。同じ木に無い等で見つからなければ null。 */
export function lca(idx: TreeIndex, a: string, b: string): TreeNode | null {
  const pathA = new Set<string>([a, ...ancestors(idx, a).map((n) => n.id)]);
  let cur: string | null = b;
  while (cur != null) {
    if (pathA.has(cur)) return idx.byId.get(cur) ?? null;
    cur = idx.parentOf.get(cur) ?? null;
  }
  return null;
}
