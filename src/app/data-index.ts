import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

export type IndexMode = 'root' | 'simpledom' | 'domtransition' | 'uniqdom';

@Component({
  selector: 'app-data-index',
  imports: [CommonModule, RouterLink],
  templateUrl: './data-index.html',
  styleUrl: './data-index.css',
})
export class DataIndex implements OnInit {
  private readonly route = inject(ActivatedRoute);

  readonly mode = signal<IndexMode>('root');
  readonly routes = signal([
    { label: 'Simple DOM', path: '/simpledom' },
    { label: 'DOM Transition', path: '/domtransition' },
    { label: 'Uniq DOM', path: '/uniqdom' },
  ]);

  ngOnInit(): void {
    this.route.data.subscribe((data) => {
      const mode = this.resolveIndexMode(data['mode']);
      this.mode.set(mode);
      this.routes.set(this.routesForMode(mode));
    });
  }

  headerTitle(): string {
    switch (this.mode()) {
      case 'domtransition':
        return 'DOM transition datasets';
      case 'simpledom':
        return 'Simple DOM datasets';
      case 'uniqdom':
        return 'Uniq DOM datasets';
      default:
        return 'Choose a viewer';
    }
  }

  private resolveIndexMode(mode: unknown): IndexMode {
    if (mode === 'simpledom' || mode === 'domtransition' || mode === 'uniqdom') {
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

    if (mode === 'uniqdom') {
      return [
        { label: 'Data 2', path: '/uniqdom/data2' },
        { label: 'France Geography', path: '/uniqdom/data3' },
      ];
    }

    return [
      { label: 'Simple DOM', path: '/simpledom' },
      { label: 'DOM Transition', path: '/domtransition' },
      { label: 'Uniq DOM', path: '/uniqdom' },
    ];
  }
}
