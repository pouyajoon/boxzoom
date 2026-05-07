import type { AppLocation, DatasetKey, TreeNode } from "../types";
import type { Datasets } from "../data/datasets";

export function pathToHash(datasetKey: DatasetKey, path: string[]): string {
  return `#/${datasetKey}/${path.join("/")}`;
}

export function pathFromHash(treeRoot: TreeNode, hash: string): string[] {
  const raw = hash.replace(/^#\/?/, "");
  const parts = raw.split("/").filter(Boolean);
  const pathParts = parts.slice(1);

  if (pathParts.length === 0 || pathParts[0] !== treeRoot.id) {
    return [treeRoot.id];
  }

  const resolved: string[] = [treeRoot.id];
  let node = treeRoot;

  for (let i = 1; i < pathParts.length; i += 1) {
    const next = node.children.find((child) => child.id === pathParts[i]);
    if (!next) {
      break;
    }
    resolved.push(next.id);
    node = next;
  }

  return resolved;
}

export function locationFromHash(datasets: Datasets, hash: string): AppLocation {
  const raw = hash.replace(/^#\/?/, "");
  if (!raw) {
    return { datasetKey: "data1", path: [datasets.data1.id] };
  }

  const parts = raw.split("/").filter(Boolean);
  const datasetKey: DatasetKey = parts[0] === "data2" ? "data2" : "data1";
  const path = pathFromHash(datasets[datasetKey], hash);

  return { datasetKey, path };
}
