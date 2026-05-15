import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { App } from './app';
import { DataIndex } from './data-index';
import { DataViewer } from './data-viewer';
import { UniqDomViewer } from './uniqdom-viewer';

const data2 = {
  id: 'a',
  children: [
    {
      id: 'a1',
      children: [
        {
          id: 'a11',
          children: [],
        },
      ],
    },
    {
      id: 'a2',
      children: [],
    },
  ],
};

const dataImageMapRoot = {
  id: 'map-root',
  imageMap: {
    imageUrl: 'https://example.com/preview.png',
    width: 100,
    height: 100,
    zones: [
      {
        childId: 'Alpha',
        label: 'Alpha zone',
        description: 'Extra info',
        polygon: [
          [0.05, 0.05],
          [0.45, 0.05],
          [0.45, 0.45],
          [0.05, 0.45],
        ],
      },
      {
        childId: 'Beta',
        label: 'Beta zone',
        polygon: [
          [0.55, 0.55],
          [0.95, 0.55],
          [0.95, 0.95],
          [0.55, 0.95],
        ],
      },
    ],
  },
  children: [
    { id: 'Alpha', children: [{ id: 'Alpha-leaf', children: [] }] },
    { id: 'Beta', children: [] },
  ],
};

describe('App', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => data2,
    }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should create the app', () => {
    TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter([])],
    });

    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should list the root viewer routes', () => {
    TestBed.configureTestingModule({
      imports: [DataIndex],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            data: of({ mode: 'root' }),
          },
        },
      ],
    });

    const fixture = TestBed.createComponent(DataIndex);
    fixture.componentInstance.ngOnInit();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const routes = Array.from(compiled.querySelectorAll('.route-card')).map((link) => link.getAttribute('href'));
    expect(routes).toEqual(['/simpledom', '/domtransition', '/uniqdom']);
  });

  it('should list the uniqdom data routes', () => {
    TestBed.configureTestingModule({
      imports: [DataIndex],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            data: of({ mode: 'uniqdom' }),
          },
        },
      ],
    });

    const fixture = TestBed.createComponent(DataIndex);
    fixture.componentInstance.ngOnInit();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const routes = Array.from(compiled.querySelectorAll('.route-card')).map((link) => link.getAttribute('href'));
    expect(routes).toEqual(['/uniqdom/data2', '/uniqdom/data3']);
  });

  it('should list the simpledom data routes', () => {
    TestBed.configureTestingModule({
      imports: [DataIndex],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            data: of({ mode: 'simpledom' }),
          },
        },
      ],
    });

    const fixture = TestBed.createComponent(DataIndex);
    fixture.componentInstance.ngOnInit();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const routes = Array.from(compiled.querySelectorAll('.route-card')).map((link) => link.getAttribute('href'));
    expect(routes).toEqual(['/simpledom/data2', '/simpledom/data3']);
  });

  it('should list the transition data route', () => {
    TestBed.configureTestingModule({
      imports: [DataIndex],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            data: of({ mode: 'domtransition' }),
          },
        },
      ],
    });

    const fixture = TestBed.createComponent(DataIndex);
    fixture.componentInstance.ngOnInit();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const routes = Array.from(compiled.querySelectorAll('.route-card')).map((link) => link.getAttribute('href'));
    expect(routes).toEqual(['/domtransition/data3']);
  });

  it('should render only the current node and one child level', async () => {
    TestBed.configureTestingModule({
      imports: [DataViewer],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            data: of({ dataset: 'data2', mode: 'simpledom' }),
          },
        },
      ],
    });

    const fixture = TestBed.createComponent(DataViewer);
    fixture.componentInstance.ngOnInit();
    await fixture.whenStable();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const rootLabel = compiled.querySelector('.box-label')?.textContent?.trim();
    const childLabels = Array.from(compiled.querySelectorAll('.child-box')).map((label) => label.textContent?.trim());

    expect(compiled.querySelector('h1')?.textContent).toContain('Simple DOM View');
    expect(rootLabel).toBe('a');
    expect(childLabels).toEqual(['a1', 'a2']);
  });

  it('should drill into a clicked child box', async () => {
    TestBed.configureTestingModule({
      imports: [DataViewer],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            data: of({ dataset: 'data2', mode: 'simpledom' }),
          },
        },
      ],
    });

    const fixture = TestBed.createComponent(DataViewer);
    fixture.componentInstance.ngOnInit();
    await fixture.whenStable();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    compiled.querySelector<HTMLElement>('.child-box')?.click();
    fixture.detectChanges();

    const rootLabel = compiled.querySelector('.box-label')?.textContent?.trim();
    const childLabels = Array.from(compiled.querySelectorAll('.child-box')).map((label) => label.textContent?.trim());

    expect(rootLabel).toBe('a1');
    expect(childLabels).toEqual(['a11']);
  });

  describe('DataViewer image map', () => {
    beforeEach(() => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: async () => dataImageMapRoot,
      }));
    });

    it('should render svg polygons instead of child buttons', async () => {
      TestBed.configureTestingModule({
        imports: [DataViewer],
        providers: [
          provideRouter([]),
          {
            provide: ActivatedRoute,
            useValue: {
              data: of({ dataset: 'data2', mode: 'simpledom' }),
            },
          },
        ],
      });

      const fixture = TestBed.createComponent(DataViewer);
      fixture.componentInstance.ngOnInit();
      await fixture.whenStable();
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.querySelector('.box-label')?.textContent?.trim()).toBe('map-root');
      expect(compiled.querySelectorAll('.image-map-zone').length).toBe(2);
      expect(compiled.querySelectorAll('.child-box').length).toBe(0);
    });

    it('should drill into a clicked image zone', async () => {
      TestBed.configureTestingModule({
        imports: [DataViewer],
        providers: [
          provideRouter([]),
          {
            provide: ActivatedRoute,
            useValue: {
              data: of({ dataset: 'data2', mode: 'simpledom' }),
            },
          },
        ],
      });

      const fixture = TestBed.createComponent(DataViewer);
      fixture.componentInstance.ngOnInit();
      await fixture.whenStable();
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      const zone = compiled.querySelector('.image-map-zone');
      zone?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      fixture.detectChanges();

      expect(compiled.querySelector('.box-label')?.textContent?.trim()).toBe('Alpha');
      const childLabels = Array.from(compiled.querySelectorAll('.child-box')).map((label) => label.textContent?.trim());
      expect(childLabels).toEqual(['Alpha-leaf']);
    });
  });

  describe('UniqDomViewer', () => {
    it('should render the whole recursive tree at once', async () => {
      TestBed.configureTestingModule({
        imports: [UniqDomViewer],
        providers: [
          provideRouter([]),
          {
            provide: ActivatedRoute,
            useValue: {
              data: of({ dataset: 'data2', mode: 'uniqdom' }),
            },
          },
        ],
      });

      const fixture = TestBed.createComponent(UniqDomViewer);
      fixture.componentInstance.ngOnInit();
      await fixture.whenStable();
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      const ids = Array.from(compiled.querySelectorAll('.tree-node__label')).map((el) =>
        el.textContent?.trim(),
      );
      // Every node from data2 lives in the DOM: root + a1 + a11 + a2.
      expect(ids).toEqual(['a', 'a1', 'a11', 'a2']);

      // Only the root is on the zoom path initially.
      const big = Array.from(compiled.querySelectorAll('.tree-node--big')).map((el) =>
        el.getAttribute('aria-label'),
      );
      expect(big).toEqual(['a']);
    });

    it('should zoom into a clicked child without re-creating its DOM', async () => {
      TestBed.configureTestingModule({
        imports: [UniqDomViewer],
        providers: [
          provideRouter([]),
          {
            provide: ActivatedRoute,
            useValue: {
              data: of({ dataset: 'data2', mode: 'uniqdom' }),
            },
          },
        ],
      });

      const fixture = TestBed.createComponent(UniqDomViewer);
      fixture.componentInstance.ngOnInit();
      await fixture.whenStable();
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      const a1Before = compiled.querySelector<HTMLElement>('.tree-node[aria-label="a1"]');
      expect(a1Before).not.toBeNull();
      expect(a1Before!.classList.contains('tree-node--small')).toBe(true);

      a1Before!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      fixture.detectChanges();

      const a1After = compiled.querySelector<HTMLElement>('.tree-node[aria-label="a1"]');
      // Same DOM node, just toggled big/small classes — no re-render.
      expect(a1After).toBe(a1Before);
      expect(a1After!.classList.contains('tree-node--big')).toBe(true);
      expect(a1After!.classList.contains('tree-node--small')).toBe(false);

      // The sibling fades out instead of being removed.
      const a2 = compiled.querySelector<HTMLElement>('.tree-node[aria-label="a2"]');
      expect(a2).not.toBeNull();
      expect(a2!.classList.contains('tree-node--sibling-faded')).toBe(true);
    });

    it('should walk back up via the Back button', async () => {
      TestBed.configureTestingModule({
        imports: [UniqDomViewer],
        providers: [
          provideRouter([]),
          {
            provide: ActivatedRoute,
            useValue: {
              data: of({ dataset: 'data2', mode: 'uniqdom' }),
            },
          },
        ],
      });

      const fixture = TestBed.createComponent(UniqDomViewer);
      fixture.componentInstance.ngOnInit();
      await fixture.whenStable();
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      const a1 = compiled.querySelector<HTMLElement>('.tree-node[aria-label="a1"]');
      a1?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      fixture.detectChanges();
      expect(a1!.classList.contains('tree-node--big')).toBe(true);

      compiled.querySelector<HTMLElement>('.back-button')?.click();
      fixture.detectChanges();
      expect(a1!.classList.contains('tree-node--big')).toBe(false);
      expect(a1!.classList.contains('tree-node--small')).toBe(true);
    });

    it('should show image-map polygons and zoom into mapped child (uniqdom)', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: async () => dataImageMapRoot,
      }));

      TestBed.configureTestingModule({
        imports: [UniqDomViewer],
        providers: [
          provideRouter([]),
          {
            provide: ActivatedRoute,
            useValue: {
              data: of({ dataset: 'data3', mode: 'uniqdom' }),
            },
          },
        ],
      });

      const fixture = TestBed.createComponent(UniqDomViewer);
      fixture.componentInstance.ngOnInit();
      await fixture.whenStable();
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.querySelectorAll('.tree-node__image-map-zone').length).toBe(2);

      const zone = compiled.querySelector('.tree-node__image-map-zone');
      zone?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      fixture.detectChanges();

      const alphaBig = compiled.querySelector<HTMLElement>(
        '.tree-node.tree-node--leaf-big[aria-label="Alpha"]',
      );
      expect(alphaBig).not.toBeNull();
      /* Parent map-root keeps its polygons in the DOM (hidden ancestor map); only count zones on the current leaf's interactive map. */
      expect(
        compiled.querySelectorAll('.tree-node--leaf-big .tree-node__image-map--leaf .tree-node__image-map-zone')
          .length,
      ).toBe(0);
    });
  });
});
