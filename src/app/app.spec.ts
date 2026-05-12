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

  it('should list the data routes', () => {
    TestBed.configureTestingModule({
      imports: [DataIndex],
      providers: [provideRouter([])],
    });

    const fixture = TestBed.createComponent(DataIndex);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const routes = Array.from(compiled.querySelectorAll('.route-card')).map((link) => link.getAttribute('href'));
    expect(routes).toEqual(['/data2', '/data3']);
  });

  it('should render only the current node and one child level', async () => {
    TestBed.configureTestingModule({
      imports: [DataViewer],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            data: of({ dataset: 'data2' }),
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

    expect(compiled.querySelector('h1')?.textContent).toContain('Box Tree View');
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
            data: of({ dataset: 'data2' }),
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
});
