import { getSystemPath, normalize } from '@angular-devkit/core';
import { workspaceRoot } from 'nx/src/utils/workspace-root';

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

export const workspaceRootPath = getSystemPath(normalize(workspaceRoot));
