import { Routes } from '@angular/router';
import { DataIndex, DataViewer } from './app';

export const routes: Routes = [
  {
    path: '',
    component: DataIndex,
    title: 'Boxzoom datasets',
  },
  {
    path: 'data2',
    component: DataViewer,
    data: { dataset: 'data2' },
    title: 'Data 2',
  },
  {
    path: 'data3',
    component: DataViewer,
    data: { dataset: 'data3' },
    title: 'Data 3',
  },
  {
    path: '**',
    redirectTo: '',
  },
];
