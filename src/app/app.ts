import { CommonModule } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink, RouterOutlet } from '@angular/router';

type TreeNode = {
  id: string;
  children: TreeNode[];
};

type RenderNode = {
  id: string;
  path: string[];
  children: TreeNode[];
};

type IndexMode = 'root' | 'simpledom' | 'domtransition';
type ViewerMode = 'simpledom' | 'domtransition';

type TransitionClone = {
  id: string;
  style: Record<string, string>;
  labelStyle: Record<string, string>;
};

const DOM_TRANSITION_DURATION_MS = 900;
const DOM_TRANSITION_HANDOFF_MS = 1000;

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
})
export class App {}

@Component({
  selector: 'app-data-index',
  imports: [CommonModule, RouterLink],
  templateUrl: './data-index.html',
  styleUrl: './app.css'
})
export class DataIndex implements OnInit {
  private readonly route = inject(ActivatedRoute);

  readonly mode = signal<IndexMode>('root');
  readonly routes = signal([
    { label: 'Simple DOM', path: '/simpledom' },
    { label: 'DOM Transition', path: '/domtransition' },
  ]);

  ngOnInit(): void {
    this.route.data.subscribe((data) => {
      const mode = this.resolveIndexMode(data['mode']);
      this.mode.set(mode);
      this.routes.set(this.routesForMode(mode));
    });
  }

  private resolveIndexMode(mode: unknown): IndexMode {
    if (mode === 'simpledom' || mode === 'domtransition') {
      return mode;
    }

    return 'root';
  }

  private routesForMode(mode: IndexMode): Array<{ label: string; path: string }> {
    if (mode === 'domtransition') {
      return [{ label: 'France Geography', path: '/domtransition/data3' }];
    }

    if (mode === 'simpledom') {
      return [
        { label: 'Data 2', path: '/simpledom/data2' },
        { label: 'France Geography', path: '/simpledom/data3' },
      ];
    }

    return [
      { label: 'Simple DOM', path: '/simpledom' },
      { label: 'DOM Transition', path: '/domtransition' },
    ];
  }
}

@Component({
  selector: 'app-data-viewer',
  imports: [CommonModule, RouterLink],
  templateUrl: './data-viewer.html',
  styleUrl: './app.css'
})
export class DataViewer implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private transitionTimeout: number | null = null;

  readonly dataset = signal('data2');
  readonly mode = signal<ViewerMode>('simpledom');
  readonly root = signal<TreeNode | null>(null);
  readonly currentNode = signal<TreeNode | null>(null);
  readonly currentPath = signal<string[]>([]);
  readonly renderTree = signal<RenderNode | null>(null);
  readonly errorMessage = signal('');
  readonly transitionClone = signal<TransitionClone | null>(null);
  readonly transitioningChildId = signal<string | null>(null);
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
      const response = await fetch(`/${dataset}.json`);
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

  onNodeKeydown(event: KeyboardEvent, child: TreeNode): void {
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

  homeRoute(): string {
    return this.mode() === 'domtransition' ? '/domtransition' : '/simpledom';
  }

  viewerTitle(): string {
    return this.mode() === 'domtransition' ? 'DOM Transition View' : 'Simple DOM View';
  }

  isTransitioningChild(child: TreeNode): boolean {
    return this.transitioningChildId() === child.id;
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
      this.showNode(child, nextPath);
      return;
    }

    const start = childElement.getBoundingClientRect();
    const end = parentElement.getBoundingClientRect();
    const baseStyle = this.cloneStyle(start);
    const childFontSize = window.getComputedStyle(childElement).fontSize;
    const parentFontSize = window.getComputedStyle(parentElement).fontSize;

    this.transitioningChildId.set(child.id);
    this.parentFading.set(true);
    this.transitionClone.set({
      id: child.id,
      style: baseStyle,
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
          style: {
            ...this.cloneStyle(end),
            transition: this.transitionCss([
              'left',
              'top',
              'width',
              'height',
              'border-radius',
            ]),
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
        style: {
          ...clone.style,
          opacity: '0',
          transition: `${clone.style['transition'] ?? ''}, opacity ${DOM_TRANSITION_HANDOFF_MS}ms ease`,
        },
        labelStyle: {
          ...clone.labelStyle,
          opacity: '0',
          transition: `${clone.labelStyle['transition'] ?? ''}, opacity ${DOM_TRANSITION_HANDOFF_MS}ms ease`,
        },
      });
    });

    this.transitionTimeout = window.setTimeout(() => {
      this.clearTransition();
    }, DOM_TRANSITION_HANDOFF_MS + 40);
  }

  private transitionCss(properties: string[]): string {
    return properties.map((property) => `${property} ${DOM_TRANSITION_DURATION_MS}ms ease`).join(', ');
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
    this.transitionClone.set(null);
    this.transitioningChildId.set(null);
    this.parentFading.set(false);
  }

  private buildRenderNode(node: TreeNode, path: string[]): RenderNode {
    return {
      id: node.id,
      path,
      children: node.children,
    };
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
