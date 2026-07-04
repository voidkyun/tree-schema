import type { TreeNode } from "../types";

export type VisitFn = (node: TreeNode, parent: TreeNode | null) => void;

/** 幅優先走査。 */
export function bfs(roots: TreeNode[], visit: VisitFn): void {
  const queue: { n: TreeNode; p: TreeNode | null }[] = roots.map((r) => ({ n: r, p: null }));
  while (queue.length) {
    const { n, p } = queue.shift()!;
    visit(n, p);
    for (const c of n.children) queue.push({ n: c, p: n });
  }
}

/** 深さ優先走査（pre / post）。 */
export function dfs(roots: TreeNode[], visit: VisitFn, order: "pre" | "post" = "pre"): void {
  const rec = (n: TreeNode, p: TreeNode | null): void => {
    if (order === "pre") visit(n, p);
    for (const c of n.children) rec(c, n);
    if (order === "post") visit(n, p);
  };
  for (const r of roots) rec(r, null);
}

/** pre-order の遅延列挙（depth 付き）。 */
export function* iterate(
  roots: TreeNode[],
): Generator<{ node: TreeNode; parent: TreeNode | null; depth: number }> {
  const stack: { node: TreeNode; parent: TreeNode | null; depth: number }[] = roots
    .map((r) => ({ node: r, parent: null as TreeNode | null, depth: 0 }))
    .reverse();
  while (stack.length) {
    const cur = stack.pop()!;
    yield cur;
    for (let i = cur.node.children.length - 1; i >= 0; i--) {
      stack.push({ node: cur.node.children[i]!, parent: cur.node, depth: cur.depth + 1 });
    }
  }
}
