import "./style.css";
import { loadDatasets } from "./data/datasets";
import { locationFromHash, pathToHash } from "./domain/hash";
import type { DatasetKey, Rect } from "./types";
import { mountApp, setDatasetSelection, syncCamera, transitionToTree, type TransitionDirection } from "./ui/view";

const app = document.querySelector<HTMLDivElement>("#app");
if (!app) {
  throw new Error("Could not find #app element.");
}

const view = mountApp(app);
const datasets = await loadDatasets();
const initialLocation = locationFromHash(datasets, window.location.hash);

let currentDataset: DatasetKey = initialLocation.datasetKey;
let root = datasets[currentDataset];
let currentPath = initialLocation.path;
setDatasetSelection(view, currentDataset);

function navigate(path: string[], syncHash = true, animate = true, focusRect?: Rect): void {
  const direction = computeDirection(currentPath, path);
  currentPath = path;
  transitionToTree(
    view,
    root,
    currentPath,
    (nextPath, nextFocusRect) => navigate(nextPath, true, true, nextFocusRect),
    (nextPath) => navigate(nextPath, true, true),
    animate,
    focusRect,
    direction,
  );
  if (syncHash) {
    syncUrlHash(currentDataset, currentPath);
  }
}

function switchDataset(nextDataset: DatasetKey): void {
  if (currentDataset === nextDataset) {
    return;
  }

  currentDataset = nextDataset;
  root = datasets[currentDataset];
  setDatasetSelection(view, currentDataset);
  navigate([root.id]);
}

view.backBtn.addEventListener("click", () => {
  if (currentPath.length > 1) {
    navigate(currentPath.slice(0, -1));
  }
});

view.datasetSelect.addEventListener("change", () => {
  const nextValue: DatasetKey = view.datasetSelect.value === "data2" ? "data2" : "data1";
  switchDataset(nextValue);
});

window.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && currentPath.length > 1) {
    navigate(currentPath.slice(0, -1));
  }
});

window.addEventListener("hashchange", () => {
  const nextLocation = locationFromHash(datasets, window.location.hash);
  currentDataset = nextLocation.datasetKey;
  root = datasets[currentDataset];
  setDatasetSelection(view, currentDataset);
  navigate(nextLocation.path, false, false);
});

window.addEventListener("resize", () => {
  syncCamera(view);
});

navigate(currentPath, false, false);

function computeDirection(previousPath: string[], nextPath: string[]): TransitionDirection {
  const isPreviousPrefix = previousPath.every((segment, index) => nextPath[index] === segment);
  const isNextPrefix = nextPath.every((segment, index) => previousPath[index] === segment);

  if (nextPath.length > previousPath.length && isPreviousPrefix) {
    return "in";
  }

  if (nextPath.length < previousPath.length && isNextPrefix) {
    return "out";
  }

  return "jump";
}

function syncUrlHash(dataset: DatasetKey, path: string[]): void {
  const nextHash = pathToHash(dataset, path);
  if (window.location.hash === nextHash) {
    return;
  }
  window.history.replaceState(window.history.state, "", nextHash);
}
