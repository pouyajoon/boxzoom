import { Injectable, signal } from '@angular/core';

/**
 * Shared state for the recursive Uniq DOM viewer.
 *
 * Why a service:
 *   - Each `TreeNodeView` reads `currentPath` to know whether it should render
 *     as `big` (on the zoom path) or `small` (a tile inside a big parent).
 *   - The service is the single place that mutates the path (zoom in, back,
 *     breadcrumb jump), so coordination across the whole recursive tree is
 *     trivial.
 *   - Before mutating the path the service snapshots every registered box's
 *     `getBoundingClientRect()`. Each `TreeNodeView` then performs a FLIP
 *     animation from its captured "pre-change" rect to its new layout rect.
 *     There is **no clone, no re-render**: the very DOM element that was a
 *     small tile becomes the new big box.
 */
@Injectable()
export class TreeStateService {
  readonly currentPath = signal<string[]>([]);

  private readonly elements = new Map<string, HTMLElement>();
  private readonly prePathRects = new Map<string, DOMRect>();

  registerElement(id: string, el: HTMLElement): void {
    this.elements.set(id, el);
  }

  unregisterElement(id: string, el: HTMLElement): void {
    if (this.elements.get(id) === el) {
      this.elements.delete(id);
    }
  }

  setPath(path: string[]): void {
    this.snapshotRects();
    this.currentPath.set(path);
  }

  zoomInto(parentPath: readonly string[], childId: string): void {
    this.setPath([...parentPath, childId]);
  }

  goBack(): void {
    const path = this.currentPath();
    if (path.length > 1) {
      this.setPath(path.slice(0, -1));
    }
  }

  jumpTo(index: number): void {
    const path = this.currentPath();
    if (index < 0 || index >= path.length - 1) {
      return;
    }
    this.setPath(path.slice(0, index + 1));
  }

  /** True when `nodePath` is a prefix of (or equal to) the current zoom path. */
  isOnPath(nodePath: readonly string[]): boolean {
    const cp = this.currentPath();
    if (nodePath.length > cp.length) {
      return false;
    }
    for (let i = 0; i < nodePath.length; i += 1) {
      if (nodePath[i] !== cp[i]) {
        return false;
      }
    }
    return true;
  }

  /** Returns and clears the pre-change rect captured for this node id. */
  consumePrePathRect(id: string): DOMRect | null {
    const rect = this.prePathRects.get(id) ?? null;
    if (rect) {
      this.prePathRects.delete(id);
    }
    return rect;
  }

  reset(): void {
    this.prePathRects.clear();
    this.currentPath.set([]);
  }

  private snapshotRects(): void {
    this.prePathRects.clear();
    for (const [id, el] of this.elements) {
      this.prePathRects.set(id, el.getBoundingClientRect());
    }
  }
}
