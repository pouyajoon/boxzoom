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

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
})
export class App {}

@Component({
  selector: 'app-data-index',
  imports: [RouterLink],
  templateUrl: './data-index.html',
  styleUrl: './app.css'
})
export class DataIndex {}

@Component({
  selector: 'app-data-viewer',
  imports: [CommonModule, RouterLink],
  templateUrl: './data-viewer.html',
  styleUrl: './app.css'
})
export class DataViewer implements OnInit {
  private readonly route = inject(ActivatedRoute);

  readonly dataset = signal('data2');
  readonly root = signal<TreeNode | null>(null);
  readonly currentNode = signal<TreeNode | null>(null);
  readonly currentPath = signal<string[]>([]);
  readonly renderTree = signal<RenderNode | null>(null);
  readonly errorMessage = signal('');

  ngOnInit(): void {
    this.route.data.subscribe((data) => {
      const dataset = data['dataset'] === 'data3' ? 'data3' : 'data2';
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
    const currentPath = this.currentPath();
    if (currentPath.length === 0) {
      return;
    }

    this.showNode(child, [...currentPath, child.id]);
  }

  onNodeKeydown(event: KeyboardEvent, child: TreeNode): void {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    const currentPath = this.currentPath();
    if (currentPath.length > 0) {
      this.showNode(child, [...currentPath, child.id]);
    }
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
