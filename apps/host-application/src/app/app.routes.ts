import { Route } from '@angular/router';
import { loadModule } from '@klerick/nx-angular-mf/loadModule';

export const appRoutes: Route[] = [
  {
    path: '',
    loadComponent: () =>
      import('./nx-welcome.component').then((r) => r.NxWelcomeComponent),
  },
  {
    path: 'first',
    loadChildren: () =>
      loadModule<{ firstRoutes: Route[] }>('firstRemote/FirstRemoteRoute').then(
        (r) => r.firstRoutes
      ),
  },
];
