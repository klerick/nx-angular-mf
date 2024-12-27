// @ts-expect-error only for types
import { ImportMap, IImportMap } from '@jspm/import-map';
import { pathToFileURL } from 'url';
import {
  loadEsmModule,
  DeferredPromise,
  checkIfNodeProtocol,
  checkIfFileProtocol,
  resolveModulePath,
  asyncCustomResolve,
} from './custom-loader-utils';

import { Context, DefaultLoad, NextResolve } from './types';
import { CACHE_FILE, CLEAR_REMOTE, IMPORT_MAP } from './constants';
import { join } from 'path';
import { PREF } from './patch-vite-dev-server';
import { OutputFileRecord } from '../types';
import { getResultImportMap, IMPORT_MAP_CONFIG_NAME } from '../helpers';

const fakeRootPath = pathToFileURL('tmp/file/').href;
const mapUrlDeferred = new DeferredPromise<{
  importMap: IImportMap;
  rootUrlHost: string;
}>();

const cacheFilesDeferred = new DeferredPromise<Map<string, OutputFileRecord>>();
const importMapModulePromise = loadEsmModule<{
  ImportMap: new (...args: any[]) => ImportMap;
}>('@jspm/import-map').then((r) => r.ImportMap);

let start = false;
let importMap: ImportMap;

let cacheFiles: Map<string, OutputFileRecord> = new Map<
  string,
  OutputFileRecord
>();
const packageNameToImportNameMap = new Map<string, string>();

const remotePackages = new Map<string, string>();

async function getImportMap() {
  if (importMap) return importMap;

  const ImportMap = await importMapModulePromise;
  const { importMap: importMapJson, rootUrlHost } = await mapUrlDeferred;

  importMap = new ImportMap({
    map: importMapJson,
    mapUrl: rootUrlHost,
  });
}

async function getCacheFiles() {
  await cacheFilesDeferred;
  return cacheFiles;
}

export async function initialize({ port }: { port: MessagePort }) {
  port.onmessage = async (event) => {
    switch (event.data.kind) {
      case IMPORT_MAP:
        mapUrlDeferred.resolve(event.data.result);
        break;
      case CACHE_FILE:
        cacheFiles = event.data.result;
        for (const value of cacheFiles.values()) {
          packageNameToImportNameMap.set(value.packageName, value.mapName);
        }
        cacheFilesDeferred.resolve(event.data.result);
        break;
      case CLEAR_REMOTE:
        remotePackages.clear();
        break;
    }
  };
}

export async function resolve(
  specifierInput: string,
  context: Context,
  nextResolve: NextResolve
) {
  const { parentURL } = context;
  const specifier = specifierInput.replace(PREF, '');
  if (
    specifier.startsWith('vite') &&
    (parentURL.indexOf('@angular/build') > -1 ||
      parentURL.indexOf('custom-loader-utils') > -1)
  ) {
    return nextResolve(
      join(__dirname, 'patch-vite-dev-server.js'),
      context,
      nextResolve
    );
  }

  if (!start && parentURL.indexOf('vite/dist/node') > -1) {
    start = true;
  }

  if (!start) return nextResolve(specifier, context, nextResolve);

  if (
    parentURL.indexOf('@angular/compiler-cli') > -1 ||
    parentURL.indexOf('@angular/build') > -1
  ) {
    return nextResolve(specifier, context, nextResolve);
  }

  const importMap = await getImportMap();
  const importMapName = packageNameToImportNameMap.get(specifier);
  const resolveUrl = resolveModulePath(importMap, specifier, parentURL);

  if (checkIfNodeProtocol(resolveUrl) || checkIfFileProtocol(resolveUrl)) {
    return nextResolve(specifier, context, nextResolve);
  }

  if (!importMapName && !resolveUrl) {
    try {
      const fileUrl = await asyncCustomResolve(specifier);
      const pathToFile = pathToFileURL(fileUrl);
      const pathName = new URL(parentURL).pathname;
      const resultFromImport = Object.entries(importMap.toJSON().imports).find(
        ([key, val]) => val.endsWith(pathName)
      );
      if (resultFromImport) {
        context.parentURL = resultFromImport[0].replace(PREF, '');
      }
      return nextResolve(pathToFile.toString(), context, nextResolve);
    } catch (e) {
      return nextResolve(specifier, context, nextResolve);
    }
  }

  const cacheFiles = await getCacheFiles();

  const dataFromCache = cacheFiles.get(importMapName);

  const specifierUrl = new URL(specifier, fakeRootPath);
  if (dataFromCache && dataFromCache.hash) {
    specifierUrl.searchParams.set('v', dataFromCache.hash);
  }
  if (!importMapName && resolveUrl) {
    let tmp = remotePackages.get(specifier);
    if (!remotePackages.has(specifier)) {
      tmp = Date.now().toString();
      remotePackages.set(specifier, tmp);
    }
    specifierUrl.searchParams.set('v', tmp);
  }

  return {
    url: specifierUrl.toString(),
    shortCircuit: true,
  };
}

export async function load(
  url: string,
  context: Context,
  defaultLoad: DefaultLoad
) {
  url = url.split('?').at(0);

  const specifier = url.replace(fakeRootPath, '');

  const importMapName = packageNameToImportNameMap.get(specifier);
  const { parentURL } = context;

  if (importMapName) {
    const cacheFiles = await getCacheFiles();
    const hasCache = cacheFiles.get(importMapName);
    if (hasCache) {
      const content = `
      var ngServerMode = true;
      ${new TextDecoder().decode(hasCache.contents)}
      `;

      return {
        format: 'module',
        source: content,
        shortCircuit: true,
      };
    }
  }
  const importMap = await getImportMap();
  const resolveUrl = resolveModulePath(importMap, specifier, parentURL);
  if (!resolveUrl) return defaultLoad(url, context, defaultLoad);
  const originalUrl = new URL(resolveUrl);
  if (importMap.scopes[originalUrl.origin + '/']) {
    try {
      const importJson = await fetch(
        new URL(IMPORT_MAP_CONFIG_NAME, originalUrl.origin).toString()
      ).then((r) => r.json());
      const importMapScope = await getResultImportMap(importJson);
      for (const [key, value] of Object.entries<string>(
        importMapScope.imports
      )) {
        if (!value.endsWith(importMap.imports[key])) {
          importMap.set(key, `${value}`, originalUrl.origin);
        }
      }
      const response = await fetch(originalUrl).then((r) => r.text());
      const content = `
      var ngServerMode = true;
      ${response}
      `;

      return {
        format: 'module',
        source: content,
        shortCircuit: true,
      };
    } catch (e) {
      console.error('Load scope dep', e);
      return defaultLoad(url, context, defaultLoad);
    }
  }

  return defaultLoad(url, context, defaultLoad);
}
