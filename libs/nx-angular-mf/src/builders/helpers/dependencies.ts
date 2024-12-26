import { normalize } from '@angular-devkit/core';
import { readJsonFile, workspaceRoot } from '@nx/devkit';
import { join } from 'path';
import path from 'path';
import fs from 'fs';

import {
  findRootTsConfigJson,
  getRootPackageJson,
  workspaceRootPath,
} from './utils';
import { ConfigMf, SharedMap, MapPackage } from '../types';

export function externalMap(external: string[]) {
  const shared: SharedMap = {};
  const dep = getRootPackageJson()['dependencies'];
  for (const [name, version] of Object.entries<string>(dep)) {
    if (!external.includes(name)) continue;
    shared[name] = {
      singleton: true,
      strictVersion: true,
      requiredVersion: version,
    };
  }

  return shared;
}

export function getFullShare(
  sharedObject: SharedMap,
  skipList: string[] = []
): SharedMap {
  for (const key in sharedObject) {
    sharedObject[key].version = sharedObject[key].requiredVersion.replace(
      /^\D*/,
      ''
    );

    const libPackageJson = findDepPackageJson(
      key,
      join(workspaceRootPath, 'package.json')
    );

    if (!libPackageJson) {
      console.error('Could not find folder containing dep ' + key);
      continue;
    }

    const secondariesArray = readConfiguredSecondaries(
      readJsonFile(libPackageJson),
      skipList
    );
    if (!secondariesArray) continue;

    for (const items of secondariesArray) {
      if (skipList.includes(items)) continue;
      sharedObject[items] = sharedObject[key];
    }
  }

  return sharedObject;
}

export function findDepPackageJson(
  packageName: string,
  projectRoot: string
): string | null {
  const mainPkgName = getPkgFolder(packageName);

  let mainPkgPath = path.join(projectRoot, 'node_modules', mainPkgName);
  let mainPkgJsonPath = path.join(mainPkgPath, 'package.json');

  let directory = projectRoot;

  while (path.dirname(directory) !== directory) {
    if (fs.existsSync(mainPkgJsonPath)) {
      break;
    }

    directory = normalize(path.dirname(directory));

    mainPkgPath = path.join(directory, 'node_modules', mainPkgName);
    mainPkgJsonPath = path.join(mainPkgPath, 'package.json');
  }

  if (!fs.existsSync(mainPkgJsonPath)) {
    console.warn(
      'No package.json found for ' + packageName + ' in ' + mainPkgPath
    );

    return null;
  }
  return mainPkgJsonPath;
}

function getPkgFolder(packageName: string) {
  const parts = packageName.split('/');

  let folder = parts[0];

  if (folder.startsWith('@')) {
    folder += '/' + parts[1];
  }

  return folder;
}

export function readConfiguredSecondaries(
  packageJson: Record<string, any>,
  skipList: string[] = []
): string[] | null {
  const exports = packageJson['exports'] as Record<
    string,
    Record<string, string>
  >;

  if (!exports) {
    return null;
  }

  const keys = Object.keys(exports).filter(
    (key) =>
      key != '.' &&
      key != './' &&
      key != './package.json' &&
      !key.endsWith('*') &&
      (exports[key]['default'] || typeof exports[key] === 'string')
  );

  const result = [];

  for (const key of keys) {
    const secondaryName = path.join(packageJson.name, key).replace(/\\/g, '/');
    if (skipList.includes(secondaryName)) continue;
    const entry = getDefaultEntry(exports, key);

    if (typeof entry !== 'string') {
      console.log('No entry point found for ' + secondaryName);
      continue;
    }

    if (
      entry?.endsWith('.css') ||
      entry?.endsWith('.scss') ||
      entry?.endsWith('.less')
    ) {
      continue;
    }
    result.push(secondaryName);
  }

  return result;
}

function getDefaultEntry(
  exports: Record<string, Record<string, string>>,
  key: string
) {
  let entry: any = '';
  if (typeof exports[key] === 'string') {
    entry = exports[key] as unknown as string;
  } else {
    entry = exports[key]?.['default'];

    if (typeof entry === 'object') {
      entry = entry['default'];
    }
  }
  return entry;
}

export function getSharedMappings() {
  const tsConfig = findRootTsConfigJson();
  const mappings = tsConfig?.compilerOptions?.paths;
  const result = [];
  if (!mappings) {
    return result;
  }

  for (const key in mappings) {
    const libPath = normalize(join(workspaceRoot, mappings[key][0]));

    result.push({
      key,
      path: libPath,
    });
  }
  return result;
}

export function getMapName(
  sharedObject: ConfigMf['shared'],
  sharedMappings: ConfigMf['sharedMappings']
): MapPackage {
  const sharedMappingsMap = sharedMappings.reduce((acum, { key, path }) => {
    return acum.set(key.replace(/[^A-Za-z0-9]/g, '_'), {
      packageName: key,
      entryPoint: path,
    });
  }, new Map<string, { packageName: string; entryPoint: string }>());

  return Object.entries(sharedObject)
    .map(([packageName]) => getPackageInfo(packageName, workspaceRootPath))
    .filter((pi) => !!pi)
    .reduce((acum, pi) => {
      return acum.set(pi.packageName.replace(/[^A-Za-z0-9]/g, '_'), {
        packageName: pi.packageName,
        entryPoint: pi.entryPoint,
      });
    }, sharedMappingsMap);
}

export function getPackageInfo(
  packageName: string,
  directory: string
): {
  packageName: string;
  entryPoint: string;
  version: string;
  esm: boolean;
} | null {
  const mainPkgName = getPkgFolder(packageName);
  const mainPkgJsonPath = findDepPackageJson(packageName, directory);

  if (!mainPkgJsonPath) {
    return null;
  }

  const mainPkgPath = path.dirname(mainPkgJsonPath);
  const mainPkgJson = readJsonFile(mainPkgJsonPath);

  const version = mainPkgJson['version'] as string;
  const esm = mainPkgJson['type'] === 'module';

  if (!version) {
    console.warn('No version found for ' + packageName);
    return null;
  }

  let relSecondaryPath = path.relative(mainPkgName, packageName);
  if (!relSecondaryPath) {
    relSecondaryPath = '.';
  } else {
    relSecondaryPath = './' + relSecondaryPath.replace(/\\/g, '/');
  }

  if (packageName.startsWith('@angular/common/locales')) {
    return {
      entryPoint: packageName,
      packageName,
      version,
      esm,
    };
  }

  let cand = mainPkgJson?.exports?.[relSecondaryPath];

  if (typeof cand === 'string') {
    return {
      entryPoint: path.join(mainPkgPath, cand),
      packageName,
      version,
      esm,
    };
  }

  cand = mainPkgJson?.exports?.[relSecondaryPath]?.import;

  if (typeof cand === 'object') {
    if (cand.module) {
      cand = cand.module;
    } else if (cand.import) {
      cand = cand.import;
    } else if (cand.default) {
      cand = cand.default;
    } else {
      cand = null;
    }
  }

  if (cand) {
    if (typeof cand === 'object') {
      if (cand.module) {
        cand = cand.module;
      } else if (cand.import) {
        cand = cand.import;
      } else if (cand.default) {
        cand = cand.default;
      } else {
        cand = null;
      }
    }

    return {
      entryPoint: path.join(mainPkgPath, cand),
      packageName,
      version,
      esm,
    };
  }

  cand = mainPkgJson?.exports?.[relSecondaryPath]?.module;

  if (typeof cand === 'object') {
    if (cand.module) {
      cand = cand.module;
    } else if (cand.import) {
      cand = cand.import;
    } else if (cand.default) {
      cand = cand.default;
    } else {
      cand = null;
    }
  }

  if (cand) {
    return {
      entryPoint: path.join(mainPkgPath, cand),
      packageName,
      version,
      esm,
    };
  }

  cand = mainPkgJson?.exports?.[relSecondaryPath]?.default;
  if (cand) {
    if (typeof cand === 'object') {
      if (cand.module) {
        cand = cand.module;
      } else if (cand.import) {
        cand = cand.import;
      } else if (cand.default) {
        cand = cand.default;
      } else {
        cand = null;
      }
    }

    return {
      entryPoint: path.join(mainPkgPath, cand),
      packageName,
      version,
      esm,
    };
  }

  cand = mainPkgJson['module'];

  if (cand && relSecondaryPath === '.') {
    return {
      entryPoint: path.join(mainPkgPath, cand),
      packageName,
      version,
      esm: true,
    };
  }

  const secondaryPgkPath = path.join(mainPkgPath, relSecondaryPath);
  const secondaryPgkJsonPath = path.join(secondaryPgkPath, 'package.json');
  let secondaryPgkJson: {
    module: string;
    main: string;
  } | null = null;
  if (fs.existsSync(secondaryPgkJsonPath)) {
    secondaryPgkJson = readJsonFile(secondaryPgkJsonPath);
  }

  if (secondaryPgkJson && secondaryPgkJson.module) {
    return {
      entryPoint: path.join(secondaryPgkPath, secondaryPgkJson.module),
      packageName,
      version,
      esm: true,
    };
  }

  cand = path.join(secondaryPgkPath, 'index.mjs');
  if (fs.existsSync(cand)) {
    return {
      entryPoint: cand,
      packageName,
      version,
      esm: true,
    };
  }

  if (secondaryPgkJson && secondaryPgkJson.main) {
    return {
      entryPoint: path.join(secondaryPgkPath, secondaryPgkJson.main),
      packageName,
      version,
      esm,
    };
  }

  cand = path.join(secondaryPgkPath, 'index.js');
  if (fs.existsSync(cand)) {
    return {
      entryPoint: cand,
      packageName,
      version,
      esm,
    };
  }

  console.warn('No entry point found for ' + packageName);
  console.warn(
    "If you don't need this package, skip it in your federation.config.js or consider moving it into depDependencies in your package.json"
  );

  return null;
}
