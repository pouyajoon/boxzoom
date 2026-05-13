import { Routes } from '@angular/router';
import { DataIndex } from './data-index';
import { DataViewer } from './data-viewer';
import { UniqDomViewer } from './uniqdom-viewer';

export const routes: Routes = [
  {
    path: '',
    component: DataIndex,
    data: { mode: 'root' },
    title: 'Boxzoom viewers',
  },
  {
    path: 'simpledom',
    component: DataIndex,
    data: { mode: 'simpledom' },
    title: 'Simple DOM datasets',
  },
  {
    path: 'simpledom/data2',
    component: DataViewer,
    data: { dataset: 'data2', mode: 'simpledom' },
    title: 'Simple DOM Data 2',
  },
  {
    path: 'simpledom/data3',
    component: DataViewer,
    data: { dataset: 'data3', mode: 'simpledom' },
    title: 'Simple DOM Data 3',
  },
  {
    path: 'domtransition',
    component: DataIndex,
    data: { mode: 'domtransition' },
    title: 'DOM transition datasets',
  },
  {
    path: 'domtransition/data3',
    component: DataViewer,
    data: { dataset: 'data3', mode: 'domtransition' },
    title: 'DOM Transition Data 3',
  },
  {
    path: 'uniqdom',
    component: DataIndex,
    data: { mode: 'uniqdom' },
    title: 'Uniq DOM datasets',
  },
  {
    path: 'uniqdom/data2',
    component: UniqDomViewer,
    data: { dataset: 'data2', mode: 'uniqdom' },
    title: 'Uniq DOM Data 2',
  },
  {
    path: 'uniqdom/data3',
    component: UniqDomViewer,
    data: { dataset: 'data3', mode: 'uniqdom' },
    title: 'Uniq DOM Data 3',
  },
  {
    path: '**',
    redirectTo: '',
  },
];
