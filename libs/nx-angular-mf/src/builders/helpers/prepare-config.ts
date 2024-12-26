import { BuilderContext } from '@angular-devkit/architect';
import { join } from 'path';
import fsPromise from 'fs/promises';

import { SchemaMf } from '../schema';
import { BuildExecutorSchema } from '../build/schema';
import { ConfigMf } from '../types';
import { workspaceRootPath } from './utils';
import { externalMap, getFullShare, getSharedMappings } from './dependencies';

export async function prepareConfig(
  defaultOptions: SchemaMf['mf'],
  buildOptions: BuildExecutorSchema,
  context: BuilderContext
): Promise<ConfigMf> {
  const skipList: ConfigMf['skipList'] = [];
  const externalList: ConfigMf['externalList'] = [];

  if (defaultOptions.skipList) {
    skipList.push(...(await checkIsFileOrArray(defaultOptions.skipList)));
  }

  if (defaultOptions.externalList) {
    externalList.push(...(await checkIsFileOrArray(defaultOptions.externalList)));
  }

  const externalMapObject = externalMap(externalList);
  const shareObject = getFullShare(externalMapObject, skipList);

  return {
    skipList: skipList,
    externalList: externalList,
    shared: shareObject,
    sharedMappings: getSharedMappings().filter(
      (i) => !skipList.includes(i.key)
    ),
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
