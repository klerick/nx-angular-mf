import { getSystemPath, normalize } from '@angular-devkit/core';
import { workspaceRoot, readJsonFile } from '@nx/devkit';
import { join, sep } from 'path';
import { ConfigMf, DataForImportMap } from '../types';
import { getMapName } from './dependencies';
import { existsSync } from 'fs';
import { pathToFileURL } from 'node:url';
import { PREF } from '../custom-loader/patch-vite-dev-server';

export const workspaceRootPath = getSystemPath(normalize(workspaceRoot));

export function getRootPackageJson() {
  return readJsonFile(join(workspaceRootPath, 'package.json'));
}

export function findRootTsConfigJson() {
  return readJsonFile(join(workspaceRootPath, 'tsconfig.base.json'));
}

export function deepMergeObject(targetObject = {}, sourceObject = {}) {
  const copyTargetObject = JSON.parse(JSON.stringify(targetObject));
  const copySourceObject = JSON.parse(JSON.stringify(sourceObject));

  Object.keys(copySourceObject).forEach((key) => {
    if (
      typeof copySourceObject[key] === 'object' &&
      !Array.isArray(copySourceObject[key])
    ) {
      copyTargetObject[key] = deepMergeObject(
        copyTargetObject[key],
        copySourceObject[key]
      );
    } else if (
      Array.isArray(copyTargetObject[key]) &&
      Array.isArray(copySourceObject[key])
    ) {
      copyTargetObject[key] = [
        ...copyTargetObject[key],
        ...copySourceObject[key],
      ];
    } else {
      copyTargetObject[key] = copySourceObject[key];
    }
  });

  return copyTargetObject;
}

export function getDataForImportMap(
  mfeConfig: ConfigMf,
  isDev = false
): DataForImportMap {
  const mapShareObject = getMapName(mfeConfig.shared, mfeConfig.sharedMappings);
  return {
    imports: [...mapShareObject.entries()].reduce((acum, [key, val]) => {
      const resultName =
        mfeConfig.outPutFileNames.find((i) => i.startsWith(key)) || key + '.js';

      if (isDev) {
        acum[PREF + val.packageName] = `${mfeConfig.deployUrl}${resultName}`;
      }
      acum[val.packageName] = `${mfeConfig.deployUrl}${resultName}`;

      return acum;
    }, {}),
    exposes: Object.entries(mfeConfig.exposes).reduce((acum, [key, val]) => {
      const resultName =
        mfeConfig.outPutFileNames.find((i) => i.startsWith(key)) || key + '.js';
      acum[key] = './' + resultName;
      return acum;
    }, {}),
    remoteEntry: mfeConfig.remoteEntry,
  };
}

export function getPathForRegister(
  path: 'custom-loader' | 'custom-loader-serve'
) {
  const fileName = path + '.js';
  const pathToFile = join(__dirname, '..', 'custom-loader', fileName);
  if (!existsSync(pathToFile)) {
    throw new Error(`File ${fileName} not found`);
  }

  return {
    parentUrl: pathToFileURL(pathToFile),
    fileName: `.${sep}${fileName}`,
  };
}
