# Custom Angular Builder for Microfrontend Architecture

This repository contains a custom builder for Angular projects designed to simplify the development and production of microfrontend applications using native esm module. 
The builder integrates with [NX](https://nx.dev/) to provide seamless support for development, testing, and deployment of Angular microfrontends.

## Features

- **Microfrontend Support**: Built-in support of native esm module with dynamic imports them.
- **Server-Side Rendering (SSR)**: Improved SSR compatibility, including custom module loaders and import maps.
- **Customizable Build Process**: Flexible options for managing dependencies and extending build configurations.
- **Dev Server Enhancements**:
  - Incremental hydration support.
  - Dynamic `importmap` generation.
  - Automatic dependency resolution and rebuilds.
- **Seamless NX Integration**: Fully compatible with NX workspace for streamlined project management.

### Prerequisites

- Node.js (v19 or higher)
- Angular CLI (v19 or higher)
- NX CLI (latest version)

### Installation

Clone this repository and install the dependencies:

```bash
npm install @klerick/nx-angular-mf
 ```
### Usage

Update your project.json or angular.json file to use the custom builder:

```json
{
  "name": "mf1-application",
  ...
  "targets": {
    "build": {
      "executor": "@klerick/nx-angular-mf:build",
      "options": {
        ...,
        "mf": {}
      }
    },
    "serve": {
      "executor": "@klerick/nx-angular-mf:serve",
      "options": {
        ...,
        "mf": {}
      }
    }
  }
}
```
### Configuration Options `mf: {}`
This section explains the configuration options for the custom builder. 
The type is structured as follows:

```typescript
type mf = {
  skipList?: string | string[];
  externalList?: string | string[];
  esPlugins?: string[];
  indexHtmlTransformer?: string;
  exposes?: Record<string, string>;
  remoteEntry?: Record<string, string>;
  deployUrlEnvName?: string;
}
```
- ```skipList``` - A list of dependencies of path to json file to be excluded from processing during the build process.
- ```externalList``` -  A list of dependencies of path to json file hat should be treated as external and not bundled with the application. These are loaded dynamically at runtime.
- ```esPlugins``` - An array of path to custom plugins to extend or modify the esbuild bundler behavior during the build process.
- ```indexHtmlTransformer``` - Path to a custom transformer script for modifying index.html during the build process. This allows advanced customizations like injecting additional tags or modifying existing ones.
- ```exposes``` - A map of module names to file paths that define which modules will be exposed by the application for remote use in a microfrontend architecture.
- ```remoteEntry``` - A map defining remote entry points for other microfrontend applications to consume. This is typically used to declare where other remote applications can be accessed.
- ```deployUrlEnvName``` - The name of an environment variable that specifies the deployUrl for the application. If this variable is set, it overrides the deployUrl configured elsewhere.

### Example Configuration
Here’s an example of how the configuration might look in practice:
```json
{
  "skipList": ["dependency-to-skip"] // or 'dependency-to-skip.json',
  "externalList": ["@angular/core", "@angular/platform-browser"], // or 'external-list-dependency.json',
  "esPlugins": ["path/to/esbuild/plugin1.ts", "path/to/esbuild/plugin2.ts"],
  "indexHtmlTransformer": "path/to/transform-index.ts",
  "exposes": {
    "./ComponentA": "./src/component-a.ts"
  },
  "remoteEntry": {
    "remoteApp": "https://remoteapp.example.com/remoteEntry.js"
  },
  "deployUrlEnvName": "MY_APP_DEPLOY_URL"
}

```
This configuration excludes a dependency from processing, treats Angular core modules as external, includes custom plugins, modifies index.html, exposes a component, specifies a remote entry, and supports deployment via an environment variable.

### Import dinamic remote module

```typescript

import { loadModule } from '@klerick/nx-angular-mf/loadModule';

export const appRoutes: Route[] = [
  {
    path: 'some-url',
    loadChildren: () =>
      loadModule<{ firstRoutes: Route[] }>('remoteApp/ComponentA').then(
        (r) => r.firstRoutes
      ),
  },
];
```

Or you can load dynamic components

```typescript
import {
  DestroyRef,
  Directive,
  ExperimentalPendingTasks,
  inject,
  ViewContainerRef,
} from '@angular/core';
import { loadModule } from '@klerick/nx-angular-mf/loadModule';

@Directive({
  selector: '[appDynamic]',
  standalone: true,
})
export class DynamicDirective {
  private viewContainerRef = inject(ViewContainerRef);
  
  ngOnInit(): void {
    this.render();
  }

  private async render() {

    const component = await loadModule<{ firstRoutes: Route[] }>('remoteApp/ComponentA').then(
      ({ DynamicComponent }) => ComponentA
    );
    if (this.destroyed) return;

    const ref = this.viewContainerRef.createComponent(component);
    ref.changeDetectorRef.detectChanges();
  }
}

```


### Contribution

Contributions are welcome! Please submit a pull request or open an issue to suggest improvements or report bugs.

### License 

This project is licensed under the MIT License. See the [LICENSE](../../LICENSE) file for details.
