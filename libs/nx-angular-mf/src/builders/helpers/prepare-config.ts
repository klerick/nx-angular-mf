import { BuilderContext } from '@angular-devkit/architect';
import { join } from 'path';
import fsPromise from 'fs/promises';

import { SchemaMf } from '../schema';
import { BuildExecutorSchema } from '../build/schema';
import { ConfigMf } from '../types';
import { workspaceRootPath } from './utils';
import { externalMap, getFullShare, getSharedMappings } from './dependencies';
import { loadModule } from './load-module';

export async function prepareConfig(
  defaultOptions: SchemaMf['mf'],
  buildOptions: BuildExecutorSchema,
  context: BuilderContext
): Promise<ConfigMf> {
  const skipList: ConfigMf['skipList'] = [];
  const externalList: ConfigMf['externalList'] = [];
  const esPlugins: ConfigMf['esPlugins'] = [];
  const remoteEntry: ConfigMf['remoteEntry'] = defaultOptions.remoteEntry || {};
  const exposes: ConfigMf['exposes'] = {};

  let indexHtmlTransformer = (input: string) => Promise.resolve(input);

  if (defaultOptions.skipList) {
    skipList.push(...(await checkIsFileOrArray(defaultOptions.skipList)));
  }

  if (defaultOptions.externalList) {
    externalList.push(...(await checkIsFileOrArray(defaultOptions.externalList)));
  }

  const externalMapObject = externalMap(externalList);
  const shareObject = getFullShare(externalMapObject, skipList);

  if (defaultOptions.esPlugins && Array.isArray(defaultOptions.esPlugins)) {
    const tmpEsPlugins = [];
    for (const pathToPlugin of defaultOptions.esPlugins) {
      const fullPathToPlugin = join(workspaceRootPath, pathToPlugin);
      const result = await fsPromise.lstat(fullPathToPlugin);
      if (!result.isFile()) {
        throw new Error(`Invalid plugin path: ${result}`);
      }

      tmpEsPlugins.push(pathToPlugin);
    }
    esPlugins.push(...tmpEsPlugins);
  }

  if (defaultOptions.indexHtmlTransformer) {
    indexHtmlTransformer = await loadModule(
      join(workspaceRootPath, defaultOptions.indexHtmlTransformer),
      join(workspaceRootPath, `${buildOptions['tsConfig']}`),
      context.logger
    );
  }

  return {
    skipList: skipList,
    externalList: externalList,
    shared: shareObject,
    sharedMappings: getSharedMappings().filter(
      (i) => !skipList.includes(i.key)
    ),
    outPutFileNames: [],
    esPlugins,
    allImportMap: {},
    indexHtmlTransformer,
    remoteEntry,
    exposes
  };
}

async function checkIsFileOrArray(
  skipList: string[] | string
): Promise<string[]> {

  if (Array.isArray(skipList)) {
    return skipList;
  } else {
    try {
      const listListPath = join(workspaceRootPath, skipList);

      const result = await fsPromise.lstat(listListPath);

      if (result.isFile()) {
        const skipListFromFile = JSON.parse(
          await fsPromise.readFile(listListPath, 'utf8')
        ) as string[];

        return Array.isArray(skipListFromFile)
          ? skipListFromFile
          : [skipListFromFile];
      }
    } catch (err) {
      throw new Error(`Invalid path: ${skipList}`);
    }
  }
}
