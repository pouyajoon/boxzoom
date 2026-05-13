import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

/** Normalized [0,1] coordinates relative to imageMap logical width/height */
type ImageMapPolygonPoint = readonly [number, number];

type ImageMapZoneJson = {
  childId: string;
  label?: string;
  description?: string;
  polygon: ImageMapPolygonPoint[];
};

type ImageMapJson = {
  imageUrl: string;
  /** Logical coordinate system for polygons (default 100×100 if omitted) */
  width?: number;
  height?: number;
  zones: ImageMapZoneJson[];
};

type TreeNode = {
  id: string;
  children: TreeNode[];
  imageMap?: ImageMapJson;
  /** Shown as the child tile background when this node appears under a classic (non–image-map) parent */
  backgroundImageUrl?: string;
};

type RenderImageMapZone = {
  child: TreeNode;
  label: string;
  description?: string;
  /** SVG `points` attribute in viewBox space */
  pointsAttr: string;
  /** Tooltip: child id + optional description */
  tooltip: string;
  labelCenterX: number;
  labelCenterY: number;
};

type RenderImageMap = {
  imageUrl: string;
  viewWidth: number;
  viewHeight: number;
  zones: RenderImageMapZone[];
};

type RenderNode = {
  id: string;
  path: string[];
  children: TreeNode[];
  imageMap: RenderImageMap | null;
};

type ViewerMode = 'simpledom' | 'domtransition';

/** Resolved preview image + logical size (aligns child tile SVG with parent image-map SVG). */
type ImagePreviewSlice = {
  href: string;
  viewWidth: number;
  viewHeight: number;
};

type TransitionClone = {
  id: string;
  preview: ImagePreviewSlice | null;
  style: Record<string, string>;
  labelStyle: Record<string, string>;
};

const DOM_TRANSITION_DURATION_MS = 900;
const DOM_TRANSITION_HANDOFF_MS = 1000;
const DOM_TRANSITION_SIBLING_FADE_MS = 200;

/** Centroid in viewBox units (shoelace; falls back to vertex average if area is tiny). */
function polygonCentroid(points: ReadonlyArray<readonly [number, number]>): readonly [number, number] {
  const n = points.length;
  if (n === 0) {
    return [0, 0];
  }

  let twiceArea = 0;
  let cx = 0;
  let cy = 0;

  for (let i = 0; i < n; i += 1) {
    const j = (i + 1) % n;
    const [xi, yi] = points[i];
    const [xj, yj] = points[j];
    const cross = xi * yj - xj * yi;
    twiceArea += cross;
    cx += (xi + xj) * cross;
    cy += (yi + yj) * cross;
  }

  if (Math.abs(twiceArea) < 1e-6) {
    let sx = 0;
    let sy = 0;
    for (const [x, y] of points) {
      sx += x;
      sy += y;
    }
    return [sx / n, sy / n];
  }

  const area = twiceArea / 2;
  return [cx / (6 * area), cy / (6 * area)];
}

@Component({
  selector: 'app-data-viewer',
  imports: [CommonModule, RouterLink],
  templateUrl: './data-viewer.html',
  styleUrl: './data-viewer.css',
})
export class DataViewer implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private transitionTimeout: number | null = null;
  private siblingFadeTimeout: number | null = null;

  readonly dataset = signal('data2');
  readonly mode = signal<ViewerMode>('simpledom');
  readonly root = signal<TreeNode | null>(null);
  readonly currentNode = signal<TreeNode | null>(null);
  readonly currentPath = signal<string[]>([]);
  readonly renderTree = signal<RenderNode | null>(null);
  readonly errorMessage = signal('');
  readonly transitionClone = signal<TransitionClone | null>(null);
  readonly transitioningChildId = signal<string | null>(null);
  /** During DOM transition: fade siblings then drop them from the template. */
  readonly transitionSiblingPhase = signal<'fading' | 'gone' | null>(null);
  readonly parentFading = signal(false);

  ngOnInit(): void {
    this.route.data.subscribe((data) => {
      const dataset = data['dataset'] === 'data3' ? 'data3' : 'data2';
      const mode: ViewerMode = data['mode'] === 'domtransition' ? 'domtransition' : 'simpledom';
      this.mode.set(mode);
      void this.loadDataset(dataset);
    });
  }

  private async loadDataset(dataset: string): Promise<void> {
    this.dataset.set(dataset);
    this.root.set(null);
    this.currentNode.set(null);
    this.currentPath.set([]);
    this.renderTree.set(null);
    this.errorMessage.set('');
    this.clearTransition();

    try {
      const response = await fetch(new URL(`${dataset}.json`, document.baseURI));
      if (!response.ok) {
        throw new Error(`Could not load ${dataset}.json (${response.status})`);
      }

      const root = await response.json() as TreeNode;
      this.root.set(root);
      this.showNode(root, [root.id]);
    } catch (error) {
      this.errorMessage.set(error instanceof Error ? error.message : `Could not load ${dataset}.json`);
    }
  }

  showNode(node: TreeNode, path: string[]): void {
    this.currentNode.set(node);
    this.currentPath.set(path);
    this.renderTree.set(this.buildRenderNode(node, path));
  }

  onNodeClick(event: MouseEvent, child: TreeNode): void {
    event.stopPropagation();
    this.openChild(child, event.currentTarget);
  }

  onImageZoneClick(event: MouseEvent, child: TreeNode): void {
    event.stopPropagation();
    this.openChild(child, event.currentTarget);
  }

  onNodeKeydown(event: KeyboardEvent, child: TreeNode): void {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    this.openChild(child, event.currentTarget);
  }

  onImageZoneKeydown(event: KeyboardEvent, child: TreeNode): void {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    this.openChild(child, event.currentTarget);
  }

  goBack(): void {
    const root = this.root();
    const currentPath = this.currentPath();
    if (!root || currentPath.length <= 1) {
      return;
    }

    const nextPath = currentPath.slice(0, -1);
    this.showNode(this.findNode(root, nextPath), nextPath);
  }

  onBreadcrumbClick(index: number): void {
    const root = this.root();
    const currentPath = this.currentPath();
    if (!root || index === currentPath.length - 1) {
      return;
    }

    const nextPath = currentPath.slice(0, index + 1);
    this.showNode(this.findNode(root, nextPath), nextPath);
  }

  trackById(_index: number, node: TreeNode): string {
    return node.id;
  }

  trackByZoneChildId(_index: number, zone: RenderImageMapZone): string {
    return zone.child.id;
  }

  childHasImagePreview(child: TreeNode): boolean {
    return this.imagePreviewForNode(child) !== null;
  }

  /** Same SVG framing as the full image-map (viewBox + meet) for tiles and the transition clone. */
  imagePreviewForNode(node: TreeNode): ImagePreviewSlice | null {
    const href = this.resolveMediaUrl(node.backgroundImageUrl);
    if (!href) {
      return null;
    }

    const map = node.imageMap;
    const viewWidth =
      map && typeof map.width === 'number' && map.width > 0 ? map.width : 16;
    const viewHeight =
      map && typeof map.height === 'number' && map.height > 0 ? map.height : 9;

    return { href, viewWidth, viewHeight };
  }

  imageMapLabelFont(viewWidth: number): number {
    return Math.max(12, Math.round(viewWidth * 0.034));
  }

  homeRoute(): string {
    return this.mode() === 'domtransition' ? '/domtransition' : '/simpledom';
  }

  viewerTitle(): string {
    return this.mode() === 'domtransition' ? 'DOM Transition View' : 'Simple DOM View';
  }

  isTransitioningChild(child: TreeNode): boolean {
    return this.transitioningChildId() === child.id;
  }

  visibleChildren(tree: RenderNode): TreeNode[] {
    if (
      this.mode() !== 'domtransition' ||
      this.transitionSiblingPhase() !== 'gone' ||
      !this.transitioningChildId()
    ) {
      return tree.children;
    }

    const id = this.transitioningChildId()!;
    return tree.children.filter((c) => c.id === id);
  }

  siblingFadeActive(child: TreeNode): boolean {
    return (
      this.mode() === 'domtransition' &&
      this.transitionSiblingPhase() === 'fading' &&
      !!this.transitioningChildId() &&
      this.transitioningChildId() !== child.id
    );
  }

  visibleZones(im: RenderImageMap): RenderImageMapZone[] {
    if (
      this.mode() !== 'domtransition' ||
      this.transitionSiblingPhase() !== 'gone' ||
      !this.transitioningChildId()
    ) {
      return im.zones;
    }

    const id = this.transitioningChildId()!;
    return im.zones.filter((z) => z.child.id === id);
  }

  zoneSiblingFadeActive(zone: RenderImageMapZone): boolean {
    return (
      this.mode() === 'domtransition' &&
      this.transitionSiblingPhase() === 'fading' &&
      !!this.transitioningChildId() &&
      this.transitioningChildId() !== zone.child.id
    );
  }

  private openChild(child: TreeNode, eventTarget: EventTarget | null): void {
    const currentPath = this.currentPath();
    if (currentPath.length === 0 || this.transitionClone()) {
      return;
    }

    const nextPath = [...currentPath, child.id];
    if (this.mode() === 'domtransition') {
      this.animateChildToParent(eventTarget, child, nextPath);
      return;
    }

    this.showNode(child, nextPath);
  }

  private animateChildToParent(eventTarget: EventTarget | null, child: TreeNode, nextPath: string[]): void {
    const childElement = eventTarget instanceof HTMLElement ? eventTarget : null;
    const parentElement = childElement?.closest<HTMLElement>('.root-box');
    if (!childElement || !parentElement) {
      this.transitionSiblingPhase.set(null);
      this.showNode(child, nextPath);
      return;
    }

    const start = childElement.getBoundingClientRect();
    const end = parentElement.getBoundingClientRect();
    const baseStyle = this.cloneStyle(start);
    const preview = this.imagePreviewForNode(child);
    const childFontSize = window.getComputedStyle(childElement).fontSize;
    const parentFontSize = window.getComputedStyle(parentElement).fontSize;

    this.transitioningChildId.set(child.id);
    this.parentFading.set(true);
    this.transitionSiblingPhase.set('fading');
    if (this.siblingFadeTimeout !== null) {
      window.clearTimeout(this.siblingFadeTimeout);
    }
    this.siblingFadeTimeout = window.setTimeout(() => {
      this.transitionSiblingPhase.set('gone');
      this.siblingFadeTimeout = null;
    }, DOM_TRANSITION_SIBLING_FADE_MS);

    this.transitionClone.set({
      id: child.id,
      preview,
      style: { ...baseStyle },
      labelStyle: {
        left: '14px',
        right: '14px',
        top: '50%',
        transform: 'translateY(-50%)',
        fontSize: childFontSize,
      },
    });

    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        this.transitionClone.set({
          id: child.id,
          preview,
          style: {
            ...this.cloneStyle(end),
            transition: this.transitionCss(['left', 'top', 'width', 'height', 'border-radius']),
          },
          labelStyle: {
            left: '24px',
            right: '24px',
            top: '24px',
            transform: 'translateY(0)',
            fontSize: parentFontSize,
            transition: this.transitionCss([
              'left',
              'right',
              'top',
              'transform',
              'font-size',
            ]),
          },
        });
      });
    });

    this.transitionTimeout = window.setTimeout(() => {
      this.transitionSiblingPhase.set(null);
      this.showNode(child, nextPath);
      this.parentFading.set(false);
      this.fadeOutTransitionClone();
    }, DOM_TRANSITION_DURATION_MS + 20);
  }

  private fadeOutTransitionClone(): void {
    const clone = this.transitionClone();
    if (!clone) {
      this.clearTransition();
      return;
    }

    window.requestAnimationFrame(() => {
      this.transitionClone.set({
        id: clone.id,
        preview: clone.preview,
        style: {
          ...clone.style,
          opacity: '0',
          transition: `${clone.style['transition'] ?? ''}, opacity ${DOM_TRANSITION_HANDOFF_MS}ms ease-in-out`,
        },
        labelStyle: {
          ...clone.labelStyle,
          opacity: '0',
          transition: `${clone.labelStyle['transition'] ?? ''}, opacity ${DOM_TRANSITION_HANDOFF_MS}ms ease-in-out`,
        },
      });
    });

    this.transitionTimeout = window.setTimeout(() => {
      this.clearTransition();
    }, DOM_TRANSITION_HANDOFF_MS + 40);
  }

  private transitionCss(properties: string[]): string {
    return properties
      .map((property) => `${property} ${DOM_TRANSITION_DURATION_MS}ms ease-in-out`)
      .join(', ');
  }

  private cloneStyle(rect: DOMRect): Record<string, string> {
    return {
      position: 'fixed',
      left: `${rect.left}px`,
      top: `${rect.top}px`,
      width: `${rect.width}px`,
      height: `${rect.height}px`,
      opacity: '1',
    };
  }

  private clearTransition(): void {
    if (this.transitionTimeout !== null) {
      window.clearTimeout(this.transitionTimeout);
      this.transitionTimeout = null;
    }
    if (this.siblingFadeTimeout !== null) {
      window.clearTimeout(this.siblingFadeTimeout);
      this.siblingFadeTimeout = null;
    }
    this.transitionClone.set(null);
    this.transitioningChildId.set(null);
    this.transitionSiblingPhase.set(null);
    this.parentFading.set(false);
  }

  private buildRenderNode(node: TreeNode, path: string[]): RenderNode {
    return {
      id: node.id,
      path,
      children: node.children,
      imageMap: this.resolveImageMap(node),
    };
  }

  private resolveImageMap(node: TreeNode): RenderImageMap | null {
    const raw = node.imageMap;
    if (!raw?.imageUrl || !Array.isArray(raw.zones) || raw.zones.length === 0) {
      return null;
    }

    const viewWidth = raw.width ?? 100;
    const viewHeight = raw.height ?? 100;
    const zones: RenderImageMapZone[] = [];
    const mapImageUrl = this.resolveMediaUrl(raw.imageUrl) ?? raw.imageUrl;

    for (const zone of raw.zones) {
      const child = node.children.find((c) => c.id === zone.childId);
      if (!child || !zone.polygon || zone.polygon.length < 3) {
        continue;
      }

      const parts: string[] = [];
      const absPoints: [number, number][] = [];
      for (const pair of zone.polygon) {
        if (!Array.isArray(pair) || pair.length < 2) {
          parts.length = 0;
          absPoints.length = 0;
          break;
        }
        const nx = Number(pair[0]);
        const ny = Number(pair[1]);
        if (!Number.isFinite(nx) || !Number.isFinite(ny)) {
          parts.length = 0;
          absPoints.length = 0;
          break;
        }
        const ax = nx * viewWidth;
        const ay = ny * viewHeight;
        absPoints.push([ax, ay]);
        parts.push(`${ax},${ay}`);
      }

      if (parts.length < 3 || absPoints.length < 3) {
        continue;
      }

      const label = zone.label?.trim() || child.id;
      const description = zone.description?.trim();
      const tooltip = description ? `${child.id} — ${description}` : child.id;
      const [labelCenterX, labelCenterY] = polygonCentroid(absPoints);

      zones.push({
        child,
        label,
        description: description || undefined,
        pointsAttr: parts.join(' '),
        tooltip,
        labelCenterX,
        labelCenterY,
      });
    }

    return zones.length > 0
      ? { imageUrl: mapImageUrl, viewWidth, viewHeight, zones }
      : null;
  }

  private resolveMediaUrl(src: string | undefined | null): string | null {
    if (!src?.trim()) {
      return null;
    }

    const value = src.trim();
    if (/^https?:\/\//i.test(value) || value.startsWith('data:')) {
      return value;
    }

    try {
      return new URL(value, document.baseURI).href;
    } catch {
      return value;
    }
  }

  private findNode(root: TreeNode, path: string[]): TreeNode {
    let node = root;

    for (let index = 1; index < path.length; index += 1) {
      const next = node.children.find((child) => child.id === path[index]);
      if (!next) {
        return root;
      }
      node = next;
    }

    return node;
  }
}
