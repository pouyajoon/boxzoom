import type { DatasetKey, TreeNode } from "../types";

export type Datasets = Record<DatasetKey, TreeNode>;

export async function loadDatasets(): Promise<Datasets> {
  const [data1, data2] = await Promise.all([
    fetch("/data1.json").then((response) => response.json() as Promise<TreeNode>),
    fetch("/data2.json").then((response) => response.json() as Promise<TreeNode>),
  ]);

  return { data1, data2 };
}
