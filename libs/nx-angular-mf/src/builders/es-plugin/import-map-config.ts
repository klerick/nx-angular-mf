import { Plugin, PluginBuild } from 'esbuild';
import { sep } from 'path';
import { ConfigMf } from '../types';
import { getDataForImportMap, IMPORT_MAP_CONFIG_NAME } from '../helpers';

export function importMapConfigPlugin(config: ConfigMf): Plugin {
  return {
    name: 'importMapConfig',
    setup(build: PluginBuild) {
      if (build.initialOptions.platform === 'node') return;
      const name = IMPORT_MAP_CONFIG_NAME.split('.').at(0);
      build.initialOptions.entryPoints = {
        ...build.initialOptions.entryPoints,
        [name]: name,
      };

      build.onResolve({ filter: new RegExp('^' + name) }, ({ kind, path }) => {
        if (kind !== 'entry-point') {
          return null;
        }
        return {
          path: path,
          namespace: name,
        };
      });

      build.onLoad({ filter: /./, namespace: name }, () => {
        return {
          contents: `{}`,
          loader: 'json',
        };
      });

      build.onEnd((result) => {
        const importMapResult = result.outputFiles.find(
          (i) => i.path.includes(name) && !i.path.endsWith('.map')
        );
        importMapResult.contents = new TextEncoder().encode(
          JSON.stringify(getDataForImportMap(config))
        );

        const pathsArray = importMapResult.path.split(sep);
        pathsArray[pathsArray.length - 1] = `${name}.json`;
        importMapResult.path = pathsArray.join(sep);
      });
    },
  };
}
