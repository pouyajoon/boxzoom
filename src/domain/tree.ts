import type { TreeNode } from "../types";

export function findNode(root: TreeNode, path: string[]): TreeNode {
  let node: TreeNode = root;

  for (let i = 1; i < path.length; i += 1) {
    const next = node.children.find((child) => child.id === path[i]);
    if (!next) {
      return root;
    }
    node = next;
  }

  return node;
}
