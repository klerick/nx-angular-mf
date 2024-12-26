import { getSystemPath, normalize } from '@angular-devkit/core';
import { workspaceRoot, readJsonFile } from '@nx/devkit';
import { join } from 'path';
import { ConfigMf, DataForImportMap } from '../types';
import { getMapName } from './dependencies';

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
): DataForImportMap {
  const mapShareObject = getMapName(mfeConfig.shared, mfeConfig.sharedMappings);
  return {
    imports: [...mapShareObject.entries()].reduce((acum, [key, val]) => {

      acum[val.packageName] = key + '.js';

      return acum;
    }, {}),
  };
}
