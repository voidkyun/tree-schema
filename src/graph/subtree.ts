import type { TreeNode } from "../types";

/** 部分木のディープクローン（id は維持）。 */
export function subtree(node: TreeNode): TreeNode {
  return {
    id: node.id,
    type: node.type,
    fields: { ...node.fields },
    children: node.children.map(subtree),
  };
}
