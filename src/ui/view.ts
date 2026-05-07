import { buildChildRects } from "../domain/layout";
import { findNode } from "../domain/tree";
import gsap from "gsap";
import type { DatasetKey, Rect, TreeNode } from "../types";

export type ViewElements = {
  scene: HTMLDivElement;
  viewport: HTMLDivElement;
  backBtn: HTMLButtonElement;
  breadcrumb: HTMLElement;
  datasetSelect: HTMLSelectElement;
};

export type TransitionDirection = "in" | "out" | "jump";

export function mountApp(container: HTMLDivElement): ViewElements {
  container.innerHTML = `
    <header class="toolbar">
      <label class="dataset-picker">
        Dataset
        <select id="datasetSelect" class="select">
          <option value="data1">Data 1</option>
          <option value="data2">Data 2</option>
        </select>
      </label>
      <button id="backBtn" class="btn">Back</button>
      <nav id="breadcrumb" class="breadcrumb" aria-label="Breadcrumb"></nav>
    </header>
    <main id="viewport" class="viewport">
      <div id="scene" class="scene"></div>
    </main>
  `;

  return {
    scene: container.querySelector<HTMLDivElement>("#scene")!,
    viewport: container.querySelector<HTMLDivElement>("#viewport")!,
    backBtn: container.querySelector<HTMLButtonElement>("#backBtn")!,
    breadcrumb: container.querySelector<HTMLElement>("#breadcrumb")!,
    datasetSelect: container.querySelector<HTMLSelectElement>("#datasetSelect")!,
  };
}

export function applyCamera(view: ViewElements): void {
  const { x: tx, y: ty, scale } = cameraForRect(view, { x: 250, y: 250, size: 500 });
  view.scene.style.transform = `translate(${tx}px, ${ty}px) scale(${scale})`;
}

export function syncCamera(view: ViewElements): void {
  const { x: tx, y: ty, scale } = cameraForRect(view, { x: 250, y: 250, size: 500 });
  gsap.set(view.scene, { x: tx, y: ty, scale, transformOrigin: "0 0" });
}

export function transitionToTree(
  view: ViewElements,
  root: TreeNode,
  path: string[],
  onNodeClick: (nextPath: string[], focusRect?: Rect) => void,
  onCrumbClick: (nextPath: string[]) => void,
  animate = true,
  focusRect?: Rect,
  direction: TransitionDirection = "jump",
): void {
  const node = findNode(root, path);
  const effectiveFocusRect = focusRect ?? { x: 250, y: 250, size: 500 };
  const retainedParent = view.scene.querySelector<HTMLDivElement>(`.node.retained-parent[data-node-id="${node.id}"]`);

  if (!animate) {
    const directRenderResult = renderScene(view, node, path, onNodeClick, onCrumbClick, retainedParent ?? undefined);
    syncCamera(view);
    gsap.set(directRenderResult.children, { opacity: 1, scale: 1 });
    gsap.set(directRenderResult.current, { opacity: 1 });
    return;
  }

  const previousCurrent = view.scene.querySelector<HTMLDivElement>(".node.current");
  const previousChildren = Array.from(view.scene.querySelectorAll<HTMLDivElement>(".node.child"));
  const previousNodes = [...previousChildren, ...(previousCurrent ? [previousCurrent] : [])];

  const focusCamera = cameraForRect(view, effectiveFocusRect);
  const baseCamera = cameraForRect(view, { x: 250, y: 250, size: 500 });

  gsap.killTweensOf(view.scene);
  gsap.killTweensOf(previousNodes);

  if (direction === "in" && previousCurrent) {
    previousCurrent.classList.remove("current");
    previousCurrent.classList.add("retained-parent");
    previousCurrent.style.pointerEvents = "none";
  }

  let renderResult!: { children: HTMLDivElement[]; current: HTMLDivElement };
  const timeline = gsap.timeline();
  timeline.to(
    previousNodes,
    {
      opacity: direction === "out" ? 0.2 : 0,
      scale: 0.94,
      duration: 0.24,
      ease: "power2.out",
      stagger: 0.02,
    },
    0,
  );
  timeline.to(view.scene, {
    x: focusCamera.x,
    y: focusCamera.y,
    scale: focusCamera.scale,
    duration: 0.62,
    ease: "power2.inOut",
    transformOrigin: "0 0",
  }, 0);
  timeline.add(() => {
    renderResult = renderScene(
      view,
      node,
      path,
      onNodeClick,
      onCrumbClick,
      direction === "out" ? retainedParent ?? undefined : undefined,
    );
    gsap.set(renderResult.children, { opacity: 0, scale: 0.9, transformOrigin: "50% 50%" });
    gsap.set(renderResult.current, { opacity: direction === "out" ? 0 : 1 });
    gsap.set(view.scene, {
      x: baseCamera.x,
      y: baseCamera.y,
      scale: baseCamera.scale * 1.08,
      transformOrigin: "0 0",
    });
  });
  timeline.set(view.scene, {
    x: baseCamera.x,
    y: baseCamera.y,
    scale: baseCamera.scale * 1.08,
    transformOrigin: "0 0",
  });
  timeline.to(view.scene, {
    x: baseCamera.x,
    y: baseCamera.y,
    scale: baseCamera.scale,
    duration: 0.46,
    ease: "power3.out",
  });
  timeline.to(renderResult.children, {
      opacity: 1,
      scale: 1,
      duration: 0.34,
      ease: "power2.out",
      stagger: 0.04,
    }, "-=0.26");
  if (direction === "out") {
    timeline.to(
      renderResult.current,
      {
        opacity: 1,
        duration: 0.32,
        ease: "power2.out",
      },
      "-=0.28",
    );
  }
}

function renderBreadcrumb(
  path: string[],
  onCrumbClick: (nextPath: string[]) => void,
): HTMLElement[] {
  return path.map((segment, index) => {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "crumb";
    item.textContent = segment;
    item.disabled = index === path.length - 1;
    item.addEventListener("click", () => onCrumbClick(path.slice(0, index + 1)));
    return item;
  });
}

function renderScene(
  view: ViewElements,
  node: TreeNode,
  path: string[],
  onNodeClick: (nextPath: string[], focusRect?: Rect) => void,
  onCrumbClick: (nextPath: string[]) => void,
  reusedCurrent?: HTMLDivElement,
): { children: HTMLDivElement[]; current: HTMLDivElement } {
  const removableNodes = Array.from(view.scene.querySelectorAll<HTMLElement>(".node"));
  removableNodes.forEach((nodeEl) => {
    if (reusedCurrent && nodeEl === reusedCurrent) {
      return;
    }
    nodeEl.remove();
  });

  const current = reusedCurrent ?? document.createElement("div");
  current.className = "node current";
  current.dataset.nodeId = node.id;
  current.dataset.depth = "0";
  current.style.left = "250px";
  current.style.top = "250px";
  current.style.width = "500px";
  current.style.height = "500px";
  current.style.pointerEvents = "auto";
  current.textContent = node.id;
  if (!reusedCurrent) {
    view.scene.append(current);
  }

  const children = createChildrenRecursive(current, node, path, 500, { x: 250, y: 250 }, onNodeClick, 1);

  view.backBtn.disabled = path.length <= 1;
  view.breadcrumb.replaceChildren(...renderBreadcrumb(path, onCrumbClick));
  return { children, current };
}

function createChildrenRecursive(
  parentEl: HTMLDivElement,
  parentNode: TreeNode,
  parentPath: string[],
  parentSize: number,
  parentOrigin: { x: number; y: number },
  onNodeClick: (nextPath: string[], focusRect?: Rect) => void,
  depth: number,
): HTMLDivElement[] {
  const directChildren: HTMLDivElement[] = [];
  const rects = buildRectsForParent(parentNode.children.length, parentSize);

  parentNode.children.forEach((child, index) => {
    const rect = rects[index];
    const childEl = document.createElement("div");
    childEl.className = "node child";
    childEl.dataset.nodeId = child.id;
    childEl.dataset.depth = String(depth);
    childEl.textContent = child.id;
    childEl.style.left = `${rect.x}px`;
    childEl.style.top = `${rect.y}px`;
    childEl.style.width = `${rect.size}px`;
    childEl.style.height = `${rect.size}px`;

    const absoluteRect: Rect = {
      x: parentOrigin.x + rect.x,
      y: parentOrigin.y + rect.y,
      size: rect.size,
    };

    childEl.addEventListener("click", (event) => {
      event.stopPropagation();
      onNodeClick([...parentPath, child.id], absoluteRect);
    });

    parentEl.append(childEl);
    directChildren.push(childEl);

    if (child.children.length > 0 && rect.size >= 42) {
      createChildrenRecursive(
        childEl,
        child,
        [...parentPath, child.id],
        rect.size,
        { x: absoluteRect.x, y: absoluteRect.y },
        onNodeClick,
        depth + 1,
      );
    }
  });

  return directChildren;
}

function buildRectsForParent(childrenCount: number, parentSize: number): Rect[] {
  if (childrenCount === 0) {
    return [];
  }

  if (parentSize === 500) {
    return buildChildRects(childrenCount).map((rect) => ({
      x: rect.x - 250,
      y: rect.y - 250,
      size: rect.size,
    }));
  }

  const cols = Math.ceil(Math.sqrt(childrenCount));
  const rows = Math.ceil(childrenCount / cols);
  const padding = Math.max(10, parentSize * 0.08);
  const usable = parentSize - padding * 2;
  const cellW = usable / cols;
  const cellH = usable / rows;
  const minSize = Math.max(12, parentSize * 0.22);
  const maxSize = Math.max(minSize, parentSize * 0.48);
  const size = Math.max(minSize, Math.min(maxSize, Math.min(cellW, cellH) * 0.72));
  const gridW = cols * cellW;
  const gridH = rows * cellH;
  const startX = (parentSize - gridW) / 2;
  const startY = (parentSize - gridH) / 2;

  return Array.from({ length: childrenCount }, (_, index) => {
    const row = Math.floor(index / cols);
    const col = index % cols;
    const centerX = startX + col * cellW + cellW / 2;
    const centerY = startY + row * cellH + cellH / 2;

    return {
      x: centerX - size / 2,
      y: centerY - size / 2,
      size,
    };
  });
}

function cameraForRect(view: ViewElements, rect: Rect): { x: number; y: number; scale: number } {
  const scale = Math.min(view.viewport.clientWidth, view.viewport.clientHeight) / rect.size;
  const centerX = rect.x + rect.size / 2;
  const centerY = rect.y + rect.size / 2;
  const x = view.viewport.clientWidth / 2 - centerX * scale;
  const y = view.viewport.clientHeight / 2 - centerY * scale;
  return { x, y, scale };
}

export function setDatasetSelection(view: ViewElements, datasetKey: DatasetKey): void {
  view.datasetSelect.value = datasetKey;
}
