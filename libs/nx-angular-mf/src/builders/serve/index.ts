import {
  BuilderContext,
  createBuilder,
  targetFromTargetString,
} from '@angular-devkit/architect';
import { normalizeOptions } from '@angular-devkit/build-angular/src/builders/dev-server/options';
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
  prepareConfig, reloadDevServer
} from '../helpers';
import { entryPointForExtendDependencies, importMapConfigPlugin } from '../es-plugin';
import { register } from 'node:module';
import { CACHE_FILE, CLEAR_REMOTE, IMPORT_MAP } from '../custom-loader/constants';
import { OutputFileRecord } from '../types';
import process from 'node:process';
import { loadEsmModule } from '../custom-loader/custom-loader-utils';
// @ts-expect-error need only type
import { ViteDevServer } from 'vite';

const { port1, port2 } = new MessageChannel();

const fileFromEsBuild = new Map<string, OutputFileRecord>();

function getBuilderAction(
  mapShareObject: Map<string, { packageName: string; entryPoint: string }>,
  ssr: boolean
) {
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
      if (!ssr || result.kind !== 1) {
        yield result;
        continue;
      }
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
      yield result;
    }
  };
}

async function handleUpdate() {
  const server = await loadEsmModule<typeof import('vite')>('vite').then(
    (r) => r.default['serverFromPatch']
  );
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

  const {mf: defaultOptionsMfe, ...defaultOptions} = options;

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

  const esPluginPromise = optionsMfe.esPlugins.map((item) =>
    loadModule<Plugin>(item, targetOptions.tsConfig, context.logger)
  );
  const esPlugins = await Promise.all(esPluginPromise);

  const resultEsBuild = [
    ...esPlugins,
    importMapConfigPlugin(optionsMfe, true),
    entryPointForExtendDependencies(optionsMfe)
  ]

  const extensions = {
    middleware: [],
    buildPlugins: resultEsBuild,
  };

  const mainTransform = await indexHtml(optionsMfe, true);


  const transforms = {
    indexHtml: async (input: string) => {
      const mainTransformResult = await mainTransform(addLinkForReload(input));
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
    getBuilderAction(mapShareObject, !!targetOptions['ssr']),
    context,
    transforms,
    extensions
  );
  for await (const output of runServer) {
    if (targetOptions['ssr'] && !serverFromPatch) {
      const serverFromPatch = await loadEsmModule<typeof import('vite')>(
        'vite'
      ).then((r) => r.default['serverFromPatch']);
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
