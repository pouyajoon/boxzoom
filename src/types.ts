export type TreeNode = {
  id: string;
  children: TreeNode[];
};

export type Rect = {
  x: number;
  y: number;
  size: number;
};

export type DatasetKey = "data1" | "data2";

export type AppLocation = {
  datasetKey: DatasetKey;
  path: string[];
};
