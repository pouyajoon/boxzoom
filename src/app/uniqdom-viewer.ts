import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TreeNodeView, UniqTreeNode } from './tree-node';
import { TreeStateService } from './tree-state.service';

@Component({
  selector: 'app-uniq-dom-viewer',
  imports: [CommonModule, RouterLink, TreeNodeView],
  templateUrl: './uniqdom-viewer.html',
  styleUrl: './uniqdom-viewer.css',
  providers: [TreeStateService],
})
export class UniqDomViewer implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly stateService = inject(TreeStateService);

  readonly dataset = signal('data3');
  readonly root = signal<UniqTreeNode | null>(null);
  readonly errorMessage = signal('');
  readonly currentPath = this.stateService.currentPath;

  ngOnInit(): void {
    this.route.data.subscribe((data) => {
      const dataset = data['dataset'] === 'data2' ? 'data2' : 'data3';
      void this.loadDataset(dataset);
    });
  }

  homeRoute(): string {
    return '/uniqdom';
  }

  rootPath(rootNode: UniqTreeNode): string[] {
    return [rootNode.id];
  }

  onBackClick(): void {
    this.stateService.goBack();
  }

  onBreadcrumbClick(index: number): void {
    this.stateService.jumpTo(index);
  }

  private async loadDataset(dataset: string): Promise<void> {
    this.dataset.set(dataset);
    this.root.set(null);
    this.errorMessage.set('');
    this.stateService.reset();

    try {
      const response = await fetch(new URL(`${dataset}.json`, document.baseURI));
      if (!response.ok) {
        throw new Error(`Could not load ${dataset}.json (${response.status})`);
      }

      const root = (await response.json()) as UniqTreeNode;
      this.root.set(root);
      this.stateService.setPath([root.id]);
    } catch (error) {
      this.errorMessage.set(
        error instanceof Error ? error.message : `Could not load ${dataset}.json`,
      );
    }
  }
}
