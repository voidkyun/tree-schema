import type { TreeNode } from "../types";

/** 親引き・id 引きを O(1) にする前処理（木は親ポインタを持たないため）。 */
export interface TreeIndex {
  byId: Map<string, TreeNode>;
  parentOf: Map<string, string | null>;
  roots: TreeNode[];
}

export function buildIndex(roots: TreeNode[]): TreeIndex {
  const byId = new Map<string, TreeNode>();
  const parentOf = new Map<string, string | null>();
  const walk = (n: TreeNode, parent: string | null): void => {
    byId.set(n.id, n);
    parentOf.set(n.id, parent);
    for (const c of n.children) walk(c, n.id);
  };
  for (const r of roots) walk(r, null);
  return { byId, parentOf, roots };
}

export function getRoots(idx: TreeIndex): TreeNode[] {
  return idx.roots;
}

export function getParent(idx: TreeIndex, id: string): TreeNode | null {
  const p = idx.parentOf.get(id);
  return p == null ? null : (idx.byId.get(p) ?? null);
}

export function getChildren(node: TreeNode): TreeNode[] {
  return node.children;
}

/** 自分→root に向かう祖先（近い順、自分を含まない）。 */
export function ancestors(idx: TreeIndex, id: string): TreeNode[] {
  const out: TreeNode[] = [];
  let p = idx.parentOf.get(id) ?? null;
  while (p != null) {
    const node = idx.byId.get(p);
    if (node) out.push(node);
    p = idx.parentOf.get(p) ?? null;
  }
  return out;
}

/** 自分を含まない全子孫（pre-order）。 */
export function descendants(node: TreeNode): TreeNode[] {
  const out: TreeNode[] = [];
  for (const c of node.children) {
    out.push(c);
    out.push(...descendants(c));
  }
  return out;
}

/** 同じ親を持つ兄弟（自分を含まない）。ルートの兄弟は他のルート。 */
export function siblings(idx: TreeIndex, id: string): TreeNode[] {
  const p = idx.parentOf.get(id) ?? null;
  if (p == null) return idx.roots.filter((r) => r.id !== id);
  const parent = idx.byId.get(p);
  return parent ? parent.children.filter((c) => c.id !== id) : [];
}
