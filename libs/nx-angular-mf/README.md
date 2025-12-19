# @klerick/nx-angular-mf

Custom Angular Builder for Microfrontend Architecture using Native ESM and Import Maps.

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [How It Works](#how-it-works)
- [Build Process](#build-process)
- [Deploy Flow](#deploy-flow)
- [Import Maps](#import-maps)
- [Installation](#installation)
- [Configuration](#configuration)
- [Usage Examples](#usage-examples)
- [SSR Support](#ssr-support)

## Overview

This builder enables Angular microfrontend architecture using native ES modules and [Import Maps](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/script/type/importmap). Unlike Webpack Module Federation, this approach uses browser-native module resolution without runtime overhead.

### Key Features

- **Native ESM** - No Webpack runtime, pure ES modules
- **Import Maps** - Browser-native module resolution
- **Shared Dependencies** - Single instance of Angular, RxJS, etc.
- **SSR Support** - Full server-side rendering with custom loaders
- **CDN Ready** - Designed for CDN deployment

## Architecture

### System Overview (Without SSR)

```
┌─────────────────────────────────────────────────────────────────────┐
│                              CDN                                     │
│                                                                      │
│  ┌─────────────────────┐      ┌─────────────────────┐              │
│  │   Host Application   │      │   MF1 Application   │              │
│  │                      │      │                      │              │
│  │  - main.js           │      │  - FirstRemoteRoute.js│             │
│  │  - index.html        │      │  - SecondRemoteRoute.js│            │
│  │  - _angular_core.js  │      │  - import-map-config.json│          │
│  │  - _angular_router.js│      │                      │              │
│  │  - _rxjs.js          │      └─────────────────────┘              │
│  │  - import-map-config.json│                                        │
│  └─────────────────────┘                                            │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                            Browser                                   │
│                                                                      │
│  1. Load index.html from Host                                       │
│  2. Parse Import Map                                                │
│  3. Load main.js                                                    │
│  4. When navigating to MF route:                                    │
│     - Import Map resolves 'mf1/FirstRemoteRoute'                    │
│     - Browser fetches from MF1 CDN URL                              │
│     - MF1 uses shared deps from Host (via Import Map)               │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### Component Diagram

```
┌──────────────────────────────────────────────────────────────────┐
│                        Host Application                           │
│                                                                   │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────────────┐  │
│  │   Router    │───▶│   Routes    │───▶│  loadModule()       │  │
│  └─────────────┘    └─────────────┘    │  'mf1/FirstRoute'   │  │
│                                         └──────────┬──────────┘  │
│                                                     │             │
│  ┌─────────────────────────────────────────────────┼───────────┐ │
│  │                    Import Map                    │           │ │
│  │                                                  ▼           │ │
│  │  "imports": {                                               │ │
│  │    "@angular/core": "/host/_angular_core.js",               │ │
│  │    "mf1/FirstRoute": "https://cdn/mf1/FirstRemoteRoute.js"  │ │
│  │  }                                                          │ │
│  └─────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
                                    │
                                    │ HTTP Request
                                    ▼
┌──────────────────────────────────────────────────────────────────┐
│                      MF1 Application (CDN)                        │
│                                                                   │
│  ┌─────────────────────┐                                         │
│  │ FirstRemoteRoute.js │                                         │
│  │                     │                                         │
│  │ import { Component }│──────┐                                  │
│  │ from '@angular/core'│      │                                  │
│  │                     │      │ Resolved via Host's Import Map   │
│  └─────────────────────┘      │ to: /host/_angular_core.js       │
│                               │                                   │
│                               ▼                                   │
│                    Uses SHARED @angular/core                      │
│                    (same instance as Host)                        │
└──────────────────────────────────────────────────────────────────┘
```

## How It Works

### 1. Shared Dependencies as Entry Points

The builder extracts shared dependencies (Angular, RxJS, etc.) as separate entry points:

```
Input:                          Output:
@angular/core          →        _angular_core.js
@angular/router        →        _angular_router.js
rxjs                   →        rxjs.js
```

Each dependency becomes a standalone ES module that can be shared across all applications.

### 2. Import Map Generation

During build, an `import-map-config.json` is generated:

```json
{
  "imports": {
    "@angular/core": "https://cdn.example.com/_angular_core-HASH.js",
    "@angular/router": "https://cdn.example.com/_angular_router-HASH.js",
    "rxjs": "https://cdn.example.com/rxjs-HASH.js"
  },
  "exposes": {
    "FirstRemoteRoute": "./FirstRemoteRoute-HASH.js"
  },
  "remoteEntry": {}
}
```

### 3. HTML Transformation

The builder transforms `index.html` to:
1. Inject `<script type="importmap">` before module scripts
2. Fix `<link rel="modulepreload">` URLs
3. Move module scripts after import map

```html
<body>
  <app-root></app-root>

  <!-- Import Map (injected by builder) -->
  <script type="importmap">
  {
    "imports": {
      "@angular/core": "https://cdn.example.com/_angular_core.js",
      "mf1/FirstRemoteRoute": "https://mf1.cdn.com/FirstRemoteRoute.js"
    }
  }
  </script>

  <!-- Modulepreload for faster loading -->
  <link rel="modulepreload" href="https://cdn.example.com/_angular_core.js">

  <!-- Application entry point -->
  <script type="module" src="main.js"></script>
</body>
```

## Build Process

### MF Application Build

```
┌─────────────────────────────────────────────────────────────────┐
│                    MF Build Process                              │
│                                                                  │
│  Input:                                                          │
│  ┌──────────────────┐                                           │
│  │ mf.exposes:      │                                           │
│  │   FirstRoute     │                                           │
│  │   SecondRoute    │                                           │
│  │                  │                                           │
│  │ mf.externalList: │                                           │
│  │   @angular/core  │                                           │
│  │   @angular/router│                                           │
│  └────────┬─────────┘                                           │
│           │                                                      │
│           ▼                                                      │
│  ┌──────────────────┐                                           │
│  │  esbuild         │                                           │
│  │  + plugins       │                                           │
│  └────────┬─────────┘                                           │
│           │                                                      │
│           ▼                                                      │
│  Output:                                                         │
│  ┌──────────────────┐                                           │
│  │ dist/browser/    │                                           │
│  │  ├─ FirstRemoteRoute-HASH.js   (exposed module)             │
│  │  ├─ SecondRemoteRoute-HASH.js  (exposed module)             │
│  │  ├─ _angular_core-HASH.js      (shared dep)                 │
│  │  ├─ _angular_router-HASH.js    (shared dep)                 │
│  │  ├─ import-map-config.json     (metadata)                   │
│  │  └─ index.html                                               │
│  └──────────────────┘                                           │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Host Application Build

```
┌─────────────────────────────────────────────────────────────────┐
│                   Host Build Process                             │
│                                                                  │
│  Input:                                                          │
│  ┌──────────────────┐                                           │
│  │ mf.remoteEntry:  │                                           │
│  │   mf1: https://..│                                           │
│  │                  │                                           │
│  │ mf.externalList: │                                           │
│  │   @angular/core  │                                           │
│  │   @angular/router│                                           │
│  └────────┬─────────┘                                           │
│           │                                                      │
│           ▼                                                      │
│  ┌──────────────────────────────────────────────────┐           │
│  │  1. Build application                            │           │
│  │  2. Build shared dependencies as entry points    │           │
│  │  3. Fetch import-map-config.json from each MF    │           │
│  │  4. Merge into final import map                  │           │
│  │  5. Transform index.html                         │           │
│  └────────┬─────────────────────────────────────────┘           │
│           │                                                      │
│           ▼                                                      │
│  Output:                                                         │
│  ┌──────────────────┐                                           │
│  │ dist/browser/    │                                           │
│  │  ├─ main-HASH.js                                            │
│  │  ├─ _angular_core-HASH.js                                   │
│  │  ├─ _angular_router-HASH.js                                 │
│  │  ├─ import-map-config.json                                  │
│  │  └─ index.html (with merged import map)                     │
│  └──────────────────┘                                           │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Deploy Flow

### Recommended CDN Deployment

```
Step 1: Build & Deploy MF
─────────────────────────

  Developer          CI/CD              CDN (MF1)
      │                │                    │
      │  git push      │                    │
      │───────────────▶│                    │
      │                │                    │
      │                │  nx build mf1      │
      │                │  (production)      │
      │                │                    │
      │                │  Deploy artifacts  │
      │                │───────────────────▶│
      │                │                    │
      │                │    ┌───────────────┴───────────────┐
      │                │    │  https://mf1.cdn.com/         │
      │                │    │  ├─ FirstRemoteRoute-ABC.js   │
      │                │    │  ├─ import-map-config.json    │
      │                │    │  └─ ...                       │
      │                │    └───────────────────────────────┘


Step 2: Build & Deploy Host
───────────────────────────

  Developer          CI/CD              CDN (Host)
      │                │                    │
      │  git push      │                    │
      │───────────────▶│                    │
      │                │                    │
      │                │  1. nx build host  │
      │                │                    │
      │                │  2. Fetch MF1's    │
      │                │     import-map-config.json
      │                │     from CDN       │
      │                │                    │
      │                │  3. Merge import   │
      │                │     maps           │
      │                │                    │
      │                │  4. Deploy         │
      │                │───────────────────▶│
      │                │                    │
      │                │    ┌───────────────┴───────────────┐
      │                │    │  https://host.cdn.com/        │
      │                │    │  ├─ index.html                │
      │                │    │  │   (contains merged         │
      │                │    │  │    import map)             │
      │                │    │  ├─ main-XYZ.js               │
      │                │    │  ├─ _angular_core-XYZ.js      │
      │                │    │  └─ ...                       │
      │                │    └───────────────────────────────┘
```

### Import Map Merging

When Host builds, it fetches `import-map-config.json` from each remote:

```
Host's import-map-config.json:
{
  "imports": {
    "@angular/core": "https://host.cdn.com/_angular_core-XYZ.js"
  }
}

+

MF1's import-map-config.json (fetched from CDN):
{
  "imports": { ... },
  "exposes": {
    "FirstRemoteRoute": "./FirstRemoteRoute-ABC.js"
  }
}

=

Final Import Map in index.html:
{
  "imports": {
    "@angular/core": "https://host.cdn.com/_angular_core-XYZ.js",
    "mf1/FirstRemoteRoute": "https://mf1.cdn.com/FirstRemoteRoute-ABC.js"
  },
  "scopes": {
    "https://mf1.cdn.com/": {
      "@angular/core": "https://host.cdn.com/_angular_core-XYZ.js"
    }
  }
}
```

### Why Scopes?

Scopes ensure that when MF1's code imports `@angular/core`, it resolves to the **Host's version**, not its own:

```javascript
// Inside FirstRemoteRoute-ABC.js (on mf1.cdn.com)
import { Component } from '@angular/core';

// Browser sees the scope "https://mf1.cdn.com/"
// Resolves @angular/core to https://host.cdn.com/_angular_core-XYZ.js
// Result: SHARED singleton Angular instance
```

## Import Maps

### Structure

```json
{
  "imports": {
    // Global mappings - used by default
    "@angular/core": "https://cdn.com/_angular_core.js",
    "mf1/FirstRoute": "https://mf1.cdn.com/FirstRoute.js"
  },
  "scopes": {
    // Scoped mappings - used when importing from specific URLs
    "https://mf1.cdn.com/": {
      "@angular/core": "https://cdn.com/_angular_core.js"
    }
  }
}
```

### Resolution Flow

```
Code Location                Import Statement           Resolved URL
─────────────────────────────────────────────────────────────────────
Host (cdn.com)              @angular/core         →   cdn.com/_angular_core.js
MF1 (mf1.cdn.com)           @angular/core         →   cdn.com/_angular_core.js (via scope)
Host (cdn.com)              mf1/FirstRoute        →   mf1.cdn.com/FirstRoute.js
```

## Installation

```bash
npm install @klerick/nx-angular-mf
```

### Prerequisites

- Node.js v20+
- Angular v21+
- NX v20+

## Configuration

### project.json

```json
{
  "name": "my-app",
  "targets": {
    "build": {
      "executor": "@klerick/nx-angular-mf:build",
      "options": {
        "outputPath": "dist/apps/my-app",
        "index": "apps/my-app/src/index.html",
        "browser": "apps/my-app/src/main.ts",
        "mf": {
          "externalList": "build-external-list.json",
          "skipList": "build-skip-list.json",
          "exposes": {
            "MyComponent": "./src/app/my-component/index.ts"
          },
          "remoteEntry": {
            "mf1": "https://mf1.cdn.com/"
          },
          "deployUrlEnvName": "DEPLOY_URL"
        }
      }
    },
    "serve": {
      "executor": "@klerick/nx-angular-mf:serve",
      "options": {
        "port": 4200
      }
    }
  }
}
```

### Configuration Options

| Option | Type | Description |
|--------|------|-------------|
| `externalList` | `string \| string[]` | Dependencies to treat as external (loaded via import map) |
| `skipList` | `string \| string[]` | Dependencies to exclude from processing |
| `exposes` | `Record<string, string>` | Modules to expose for remote consumption |
| `remoteEntry` | `Record<string, string>` | Remote application URLs |
| `esPlugins` | `string[]` | Custom esbuild plugins |
| `indexHtmlTransformer` | `string` | Custom HTML transformer |
| `deployUrlEnvName` | `string` | Environment variable for deploy URL |

### External List Example

`build-external-list.json`:
```json
[
  "@angular/core",
  "@angular/common",
  "@angular/router",
  "@angular/forms",
  "@angular/platform-browser",
  "rxjs"
]
```

## Usage Examples

### Loading Remote Routes

```typescript
import { Route } from '@angular/router';
import { loadModule } from '@klerick/nx-angular-mf/loadModule';

export const routes: Route[] = [
  {
    path: '',
    loadComponent: () => import('./home.component').then(m => m.HomeComponent)
  },
  {
    path: 'remote',
    loadChildren: () =>
      loadModule<{ routes: Route[] }>('mf1/FirstRemoteRoute')
        .then(m => m.routes)
  }
];
```

### Loading Remote Components

```typescript
import { Component, ViewContainerRef, inject } from '@angular/core';
import { loadModule } from '@klerick/nx-angular-mf/loadModule';

@Component({
  selector: 'app-container',
  template: '<ng-container #container></ng-container>'
})
export class ContainerComponent {
  private vcr = inject(ViewContainerRef);

  async loadRemote() {
    const { RemoteComponent } = await loadModule('mf1/RemoteComponent');
    this.vcr.createComponent(RemoteComponent);
  }
}
```

## SSR Support

### Why So Few Files in `/server`?

After building with SSR, the `/server` folder contains only:

```
dist/apps/host-application/
├── browser/                          # Browser bundle
│   ├── _angular_core-HASH.js         # Shared dependencies
│   ├── _angular_router-HASH.js
│   ├── _angular_common-HASH.js
│   ├── rxjs-HASH.js
│   ├── main-HASH.js
│   ├── import-map-config.json
│   └── index.html
│
└── server/                           # Server bundle
    ├── server.ssr.mjs                # Entry point (bootstrap)
    ├── server.mjs                    # Express/Fastify server
    ├── main.server.mjs               # Angular SSR app
    ├── custom-loader.mjs             # Node.js loader hooks
    ├── angular-app-manifest.mjs
    └── index.server.html
```

**Why no `_angular_core.js` in server folder?**

The server uses Node.js [custom loader hooks](https://nodejs.org/api/module.html#customization-hooks) to load shared dependencies from the `/browser` folder at runtime. This avoids duplicating large files and ensures the same code runs on both client and server.

### How SSR Works

```
┌────────────────────────────────────────────────────────────────────────┐
│                          SSR Flow                                       │
│                                                                         │
│  1. Node.js starts with custom loader                                  │
│     node --import ./server.ssr.mjs                                     │
│                                                                         │
│  2. server.ssr.mjs registers custom-loader.mjs                         │
│     ┌─────────────────────────────────────────────────────────────┐   │
│     │  import { register } from 'module';                         │   │
│     │  register('./custom-loader.mjs', { ... });                  │   │
│     │  port.postMessage({ kind: 'DEPLOY_URL', result: '...' });   │   │
│     │  import('./server.mjs');                                     │   │
│     └─────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  3. Custom loader fetches import-map-config.json                       │
│     GET http://localhost:4200/import-map-config.json                   │
│                                                                         │
│  4. When server imports '@angular/core':                               │
│     ┌─────────────────────────────────────────────────────────────┐   │
│     │  resolve('@angular/core')                                   │   │
│     │      ↓                                                      │   │
│     │  Import Map: "@angular/core" → "http://host/_angular_core.js" │   │
│     │      ↓                                                      │   │
│     │  load() fetches content via HTTP                            │   │
│     │      ↓                                                      │   │
│     │  Returns: { format: 'module', source: '...' }               │   │
│     └─────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  5. Server renders HTML with shared Angular instance                   │
│                                                                         │
└────────────────────────────────────────────────────────────────────────┘
```

### Custom Loader Architecture

Node.js doesn't natively support Import Maps. The custom loader provides three hooks:

```
┌──────────────────────────────────────────────────────────────────┐
│                    Node.js Loader Hooks                           │
│                                                                   │
│  ┌─────────────┐                                                 │
│  │ initialize  │  Receives DEPLOY_URL via MessagePort            │
│  │             │  Fetches import-map-config.json                 │
│  └──────┬──────┘                                                 │
│         │                                                         │
│         ▼                                                         │
│  ┌─────────────┐                                                 │
│  │  resolve    │  Maps specifiers using Import Map               │
│  │             │                                                  │
│  │  '@angular/core'  →  'http://host/_angular_core.js'          │
│  │  'mf1/Route'      →  'http://mf1/_Route.js'                  │
│  └──────┬──────┘                                                 │
│         │                                                         │
│         ▼                                                         │
│  ┌─────────────┐                                                 │
│  │    load     │  Fetches HTTP URLs and returns source           │
│  │             │                                                  │
│  │  fetch('http://host/_angular_core.js')                        │
│  │  return { format: 'module', source: content }                 │
│  └─────────────┘                                                 │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
```

### Production vs Development

**Production:**
```
┌──────────────────────────────────────────────────────────────────┐
│                    Production SSR                                 │
│                                                                   │
│  Server (Node.js)              CDN / Static Server               │
│  ┌────────────────┐            ┌────────────────────┐           │
│  │ server.ssr.mjs │──fetch────▶│ /browser/          │           │
│  │                │            │  _angular_core.js  │           │
│  │ custom-loader  │            │  _angular_router.js│           │
│  │                │            │  import-map-config │           │
│  └────────────────┘            └────────────────────┘           │
│                                                                   │
│  Loads shared deps from CDN at runtime                           │
│  Same files served to both browser and server                    │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
```

**Development (with Vite):**
```
┌──────────────────────────────────────────────────────────────────┐
│                    Development SSR                                │
│                                                                   │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │                   Vite Dev Server                           │  │
│  │                                                             │  │
│  │  Browser Request          SSR Request                       │  │
│  │       │                        │                            │  │
│  │       ▼                        ▼                            │  │
│  │  Vite transforms          Custom Loader                     │  │
│  │  ES modules on-the-fly    intercepts imports                │  │
│  │                                │                            │  │
│  │       │                        │                            │  │
│  │       ▼                        ▼                            │  │
│  │  ┌───────────────────────────────────────────────────┐     │  │
│  │  │              In-Memory File Cache                  │     │  │
│  │  │   (shared between browser and SSR)                 │     │  │
│  │  └───────────────────────────────────────────────────┘     │  │
│  │                                                             │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                   │
│  patch-vite-dev-server.ts adds PREF prefix to bypass Vite        │
│  custom-loader-serve.ts handles SSR module resolution            │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
```

### Key Implementation Details

1. **`server.ssr.mjs`** - Bootstrap entry:
   ```javascript
   import { register } from 'module';
   const { port1, port2 } = new MessageChannel();
   register('./custom-loader.mjs', { data: { port: port2 }, transferList: [port2] });
   port1.postMessage({ kind: 'DEPLOY_URL', result: 'http://localhost:4200/' });
   import('./server.mjs');
   ```

2. **`custom-loader.mjs`** - Module resolution:
   - `initialize()` - receives DEPLOY_URL, fetches import-map-config.json
   - `resolve()` - maps bare specifiers to URLs via Import Map
   - `load()` - fetches HTTP URLs and returns ESM source

3. **`ngServerMode` flag**:
   ```javascript
   // Injected before each module loaded via HTTP
   var ngServerMode = true;
   // ... module source code
   ```
   This tells Angular the code is running in SSR context.

### Remote MF Loading in SSR

When server needs to render a remote microfrontend route:

```
┌──────────────────────────────────────────────────────────────────┐
│                Remote MF SSR Resolution                           │
│                                                                   │
│  1. Server imports 'mf1/FirstRemoteRoute'                        │
│                                                                   │
│  2. Custom loader resolves via Import Map:                       │
│     'mf1/FirstRemoteRoute' → 'http://mf1.cdn.com/FirstRoute.js'  │
│                                                                   │
│  3. Loader checks scope in Import Map:                           │
│     scope: 'http://mf1.cdn.com/' exists                          │
│                                                                   │
│  4. Fetches MF1's import-map-config.json                         │
│     GET http://mf1.cdn.com/import-map-config.json                │
│                                                                   │
│  5. Merges MF1's dependencies with host scope:                   │
│     If MF1 has different '@angular/core' URL,                    │
│     it's added to scope for that origin                          │
│                                                                   │
│  6. Fetches and returns FirstRemoteRoute.js                      │
│     with ngServerMode = true injected                            │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
```

### SSR Configuration

```json
{
  "build": {
    "executor": "@klerick/nx-angular-mf:build",
    "options": {
      "server": "apps/my-app/src/main.server.ts",
      "ssr": {
        "entry": "apps/my-app/src/server.ts"
      },
      "outputMode": "server"
    }
  }
}
```

### Benefits of This Approach

| Benefit | Description |
|---------|-------------|
| **No Duplication** | Shared deps stored once in `/browser`, loaded at runtime |
| **Same Code** | Identical modules run on client and server |
| **Dynamic Loading** | Remote MFs fetched on-demand during SSR |
| **CDN Ready** | Server can load from any HTTP endpoint |
| **Hot Reload** | Dev server shares cache between browser and SSR |

## Important Notes

### Version Compatibility

All applications sharing dependencies **must use compatible versions**:

```
✅ Host: @angular/core@21.0.0
   MF1:  @angular/core@21.0.0  (same hash, same file)

❌ Host: @angular/core@21.0.0 (without zone.js)
   MF1:  @angular/core@21.0.0 (with zone.js)
   → Different builds, different hashes!
```

### Zone.js Consideration

Angular 21+ supports zoneless mode. All apps must use the same mode:

```json
// All apps must match:
"polyfills": []           // zoneless
// OR
"polyfills": ["zone.js"]  // with zone.js
```

Different zone.js configurations produce different builds of `@angular/core`.

## License

MIT
