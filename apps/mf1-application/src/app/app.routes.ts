import { Route } from '@angular/router';
import { NxWelcomeComponent } from './nx-welcome.component';

export const appRoutes: Route[] = [
  {
    path: '',
    component: NxWelcomeComponent,
  },
  {
    path: 'first',
    loadChildren: () => import('./remote/first').then((r) => r.firstRoutes),
  },
];
