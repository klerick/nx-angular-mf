import type { Context, NextResolve } from './types';
import {
  checkIfFileProtocol,
  checkIfNodeProtocol,
  DeferredPromise,
  resolveModulePath,
} from './custom-loader-utils';
import { getResultImportMap, IMPORT_MAP_CONFIG_NAME } from '../helpers/init-import-map-utils';
import { pathToFileURL } from 'url';
// @ts-expect-error should be esm
import type { ImportMap } from '@jspm/import-map';
import process from 'node:process';
import { join } from 'path';

export const DEPLOY_URL = 'DEPLOY_URL';

const deferredInit = new DeferredPromise<ImportMap>();

const fakeRootPath = pathToFileURL(
  join(process.cwd(), '../browser', '/')
).toString();

async function initImportMap(deployHost: string) {
  const deployUrl = new URL(IMPORT_MAP_CONFIG_NAME, deployHost);
  const importMapConfig = await fetch(deployUrl)
    .then((r) => r.json())
    .catch((err) => {
      const newError = new Error(
        `Fetch "${IMPORT_MAP_CONFIG_NAME}" from "${deployHost}" failed`,
        { cause: err }
      );
      throw newError;
    });

  const resultImportMap = await getResultImportMap(importMapConfig);
  const importMapModule = await import('@jspm/import-map').then(
    (r) => r.ImportMap
  );

  const importMap = new importMapModule({
    map: resultImportMap,
    mapUrl: deployUrl,
    rootUrl: pathToFileURL(process.cwd()).toString(),
  });
  deferredInit.resolve(importMap);
}

async function initialize({ port }: { port: MessagePort }) {
  port.onmessage = async (event) => {
    if (event.data.kind === DEPLOY_URL) {
      initImportMap(event.data.result);
    }
  };
}

async function resolve(
  specifier: string,
  context: Context,
  nextResolve: NextResolve
) {
  const { parentURL } = context;

  const importMap = await deferredInit;

  const result = resolveModulePath(importMap, specifier, parentURL);

  if (!result) {
    return nextResolve(specifier, context, nextResolve);
  }

  if (checkIfNodeProtocol(result) || checkIfFileProtocol(result)) {
    return nextResolve(result, context, nextResolve);
  }

  if (!result.startsWith('http')) {
    return nextResolve(result, context, nextResolve);
  }
  const specifierUrl = new URL(specifier, fakeRootPath);
  return {
    url: specifierUrl.toString(),
    shortCircuit: true,
  };
}

async function load(url: string, context: Context, defaultLoad: NextResolve) {
  url = url.split('?').at(0);
  const { parentURL } = context;
  const specifier = url.replace(fakeRootPath, '');
  const importMap = await deferredInit;

  const resolveUrl = resolveModulePath(importMap, specifier, parentURL);

  if (resolveUrl.startsWith('http')) {
    const response = await fetch(resolveUrl).then((r) => r.text());
    return {
      format: 'module',
      source: 'var ngServerMode = true;\n' + response,
      shortCircuit: true,
    };
  }
  return defaultLoad(url, context, defaultLoad);
}

export { initialize, resolve, load };
