import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { App, DataIndex, DataViewer } from './app';

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
    expect(routes).toEqual(['/simpledom', '/domtransition']);
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
});
