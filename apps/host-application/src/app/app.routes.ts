import { Route } from '@angular/router';

export const appRoutes: Route[] = [{
  path: '',
  loadComponent: () => import('./nx-welcome.component').then(r => r.NxWelcomeComponent)
}];
