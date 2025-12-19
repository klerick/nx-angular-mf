import {
  BuilderContext,
  createBuilder,
  targetFromTargetString,
} from '@angular-devkit/architect';
import {
  serveWithVite,
  buildApplicationInternal,
} from '@angular/build/private';
import { Plugin } from 'esbuild';

import { ServeExecutorSchema } from './schema';
import { BuildExecutorSchema } from '../build/schema';
import {
  addLinkForReload,
  deepMergeObject,
  getMapName,
  getPathForRegister,
  indexHtml,
  loadModule,
  patchBuilderContext,
  prepareConfig,
  reloadDevServer,
} from '../helpers';
import {
  entryPointForExtendDependencies,
  importMapConfigPlugin,
} from '../es-plugin';
import { register } from 'node:module';
import {
  CACHE_FILE,
  CLEAR_REMOTE,
  IMPORT_MAP,
} from '../custom-loader/constants';
import { ConfigMf, OutputFileRecord } from '../types';
import process from 'node:process';
import { loadEsmModule } from '../custom-loader/custom-loader-utils';
import { ViteDevServer } from 'vite';
import { join, dirname } from 'node:path';
import { Module } from 'node:module';

const { port1, port2 } = new MessageChannel();

const fileFromEsBuild = new Map<string, OutputFileRecord>();
const exposedFilesCache = new Map<string, Uint8Array>();
/**
 * WORKAROUND #1: Bypass package.json exports to access internal Angular APIs
 *
 * Angular 21 changed package.json exports to restrict access to internal modules.
 * We need `normalizeOptions` from '@angular/build/src/builders/dev-server/options'
 * which is not exposed in public exports. This workaround uses direct file path
 * to bypass the exports restrictions.
 *
 * @see https://github.com/angular/angular-cli - Angular 21 breaking changes
 */
const angularBuildPackagePath = require.resolve('@angular/build/package.json');
const normalizeOptionsPath = join(
  dirname(angularBuildPackagePath),
  'src/builders/dev-server/options.js'
);

const { normalizeOptions } = require(normalizeOptionsPath);

/**
 * WORKAROUND #2: Patch Module._load to intercept require('vite')
 *
 * Angular 21 changed from ESM dynamic import to CommonJS require for vite:
 * - Angular 20: `await loadEsmModule('vite')` - worked with ESM loader hooks
 * - Angular 21: `require('vite')` wrapped in Promise - bypasses ESM loader hooks
 *
 * This prevents our custom loader from intercepting vite imports, which breaks
 * the critical customNodeImportPlugin that handles external dependencies in SSR.
 *
 * We must patch Module._load to return our patched vite instead of the original,
 * ensuring customNodeImportPlugin is injected into Vite config for proper SSR
 * handling of micro-frontend external dependencies via Import Maps.
 *
 * @see https://github.com/vitejs/vite/discussions/19101 - Vite SSR external modules
 */
// @ts-expect-error - Module._load is private Node.js internal API not in @types/node
const originalLoad = Module._load;
const patchPath = join(__dirname, '../custom-loader/patch-vite-dev-server.js');
const realVitePath = require.resolve('vite');
// @ts-expect-error - Module._load is private Node.js internal API not in @types/node
Module._load = function (request: string, parent: any, isMain: boolean) {
  if (request === 'vite') {
    // If import is FROM THE PATCH itself - return real vite to avoid infinite recursion
    if (
      parent &&
      parent.filename &&
      parent.filename.includes('patch-vite-dev-server')
    ) {
      return originalLoad.call(this, realVitePath, parent, isMain);
    }
    // Otherwise (from Angular etc.) - return patched vite
    return originalLoad.call(this, patchPath, parent, isMain);
  }
  return originalLoad.call(this, request, parent, isMain);
};

function getBuilderAction(
  mapShareObject: Map<string, { packageName: string; entryPoint: string }>,
  exposes: Record<string, string>,
  ssr: boolean
) {
  const exposesKeys = Object.keys(exposes);

  return async function* (options, context, pluginsOrExtensions) {
    let extensions;
    if (pluginsOrExtensions && Array.isArray(pluginsOrExtensions)) {
      extensions = {
        codePlugins: pluginsOrExtensions,
      };
    } else {
      extensions = pluginsOrExtensions;
    }

    for await (const result of buildApplicationInternal(
      options,
      context,
      extensions
    )) {
      if (result.kind !== 1) {
        yield result;
        continue;
      }

      // Cache exposed modules (always, regardless of SSR)
      for (const [key, file] of Object.entries(result.files)) {
        if (key.endsWith('.js.map')) continue;
        const name = key.split('.').at(0);

        if (file.origin === 'memory' && exposesKeys.includes(name)) {
          exposedFilesCache.set(name, file.contents);
        }
      }

      // Cache shared dependencies (only for SSR)
      if (ssr) {
        let needUpdate = false;
        for (const [key, file] of Object.entries(result.files)) {
          if (key.endsWith('.js.map')) continue;
          const name = key.split('.').at(0);
          const shareObject = mapShareObject.get(name);

          if (file.origin === 'memory' && shareObject) {
            const prevVersion = fileFromEsBuild.get(name);
            if (!needUpdate) {
              needUpdate = prevVersion && prevVersion.hash !== file.hash;
            }

            fileFromEsBuild.set(name, {
              contents: file.contents,
              size: file.contents.byteLength,
              packageName: shareObject.packageName,
              mapName: name,
              hash: file.hash,
            });
          }
        }
        if (needUpdate) {
          process.nextTick(handleUpdate);
        }
        port1.postMessage({ kind: CACHE_FILE, result: fileFromEsBuild });
      }

      yield result;
    }
  };
}

async function handleUpdate() {
  const server = await loadEsmModule<
    typeof import('vite') & { default: { serverFromPatch: ViteDevServer } }
  >('vite').then((r) => r.default.serverFromPatch);
  port1.postMessage({
    kind: CLEAR_REMOTE,
  });
  await reloadDevServer(server);
}

export async function* runBuilder(
  options: ServeExecutorSchema,
  context: BuilderContext
) {
  context.logger.info('Run serve mf');

  const { mf: defaultOptionsMfe, ...defaultOptions } = options;

  const buildTarget = targetFromTargetString(options.buildTarget);
  const targetOptions = (await context.getTargetOptions(
    buildTarget
  )) as unknown as BuildExecutorSchema;

  const resultMfeOptions = deepMergeObject(
    targetOptions['mf'] || {},
    defaultOptionsMfe || {}
  );

  const optionsMfe = await prepareConfig(
    resultMfeOptions,
    targetOptions,
    context
  );

  if (!optionsMfe.deployUrl) {
    const deployUrl = new URL('http://localhost');
    deployUrl.port = options.port.toString();
    deployUrl.hostname = options.host;
    deployUrl.protocol = options.ssl ? 'https' : 'http';
    optionsMfe.deployUrl = deployUrl.toString();
  }

  const mapShareObject = getMapName(
    optionsMfe.shared,
    optionsMfe.sharedMappings
  );

  const externalDependencies = [...mapShareObject.values()].map(
    (i) => i.packageName
  );
  patchBuilderContext(context, buildTarget, externalDependencies);

  const normalizeOuterOptions = await normalizeOptions(
    context,
    context.target.project,
    defaultOptions
  );

  type FunctionEsPlugin = (config: ConfigMf) => Promise<Plugin>;

  const esPluginPromise = optionsMfe.esPlugins.map((item) => {
    return loadModule<Plugin | FunctionEsPlugin>(
      item,
      targetOptions.tsConfig,
      context.logger
    ).then((r) => (typeof r === 'function' ? r(optionsMfe) : r));
  });
  const esPlugins = await Promise.all(esPluginPromise);

  const resultEsBuild = [
    ...esPlugins,
    importMapConfigPlugin(optionsMfe, true),
    entryPointForExtendDependencies(optionsMfe),
  ];

  const extensions = {
    middleware: [
      // Middleware to serve compiled exposed modules directly, bypassing Vite HMR transform
      (req, res, next) => {
        const url = req.url?.split('?')[0];
        if (!url) return next();

        const fileName = url.startsWith('/') ? url.slice(1) : url;
        const moduleName = fileName.replace(/\.js$/, '');

        const cachedFile = exposedFilesCache.get(moduleName);
        if (cachedFile) {
          res.setHeader('Content-Type', 'application/javascript');
          res.setHeader('Cache-Control', 'no-cache');
          res.end(Buffer.from(cachedFile));
          return;
        }

        next();
      },
    ],
    buildPlugins: resultEsBuild,
  };

  const mainTransform = await indexHtml(optionsMfe, true);

  const transforms = {
    indexHtml: async (input: string) => {
      const mainTransformResult = await mainTransform(
        targetOptions['ssr'] ? addLinkForReload(input) : input
      );
      return optionsMfe.indexHtmlTransformer(mainTransformResult);
    },
  };

  if (targetOptions['ssr']) {
    const { parentUrl, fileName } = getPathForRegister('custom-loader-serve');
    register(fileName, {
      parentURL: parentUrl,
      data: { port: port2 },
      transferList: [port2],
    });

    port1.postMessage({
      kind: IMPORT_MAP,
      result: {
        importMap: optionsMfe.allImportMap,
        rootUrlHost: optionsMfe.deployUrl,
      },
    });
  }
  let serverFromPatch: ViteDevServer;
  const runServer = serveWithVite(
    normalizeOuterOptions,
    '@angular-devkit/build-angular:application',
    getBuilderAction(mapShareObject, optionsMfe.exposes, !!targetOptions['ssr']),
    context,
    transforms,
    extensions
  );
  for await (const output of runServer) {
    if (targetOptions['ssr'] && !serverFromPatch) {
      const serverFromPatch = await loadEsmModule<
        typeof import('vite') & { default: { serverFromPatch: ViteDevServer } }
      >('vite').then((r) => r.default.serverFromPatch);

      serverFromPatch.ws.on('reload:manual', async () => {
        await reloadDevServer(serverFromPatch);
        serverFromPatch.ws.send({
          type: 'full-reload',
          path: '*',
        });
        context.logger.info('Page reload sent to client(s).');
        port1.postMessage({
          kind: CLEAR_REMOTE,
        });
      });
    }
    yield output;
  }
}

export default createBuilder(runBuilder);
