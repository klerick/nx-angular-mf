import { Plugin, PluginBuild } from 'esbuild';

import { ConfigMf } from '../types';
import { getMapName } from '../helpers';


export function entryPointForExtendDependencies(config: ConfigMf): Plugin {
  return {
    name: 'entryPointForExtendDependencies',
    setup(build: PluginBuild) {
      const mapShareObject = getMapName(config.shared, config.sharedMappings);

      const result = [...mapShareObject.entries()].reduce(
        (acum, [key, value]) => {
          acum[key] = value.entryPoint;
          return acum;
        },
        { }
      );

      delete build.initialOptions.define.ngServerMode;
      build.initialOptions.splitting = false;

      if (build.initialOptions.platform !== 'browser') return;

      build.onEnd((resultBuild) => {
        if (!resultBuild.metafile) return;
        config.outPutFileNames = Object.keys(
          resultBuild.metafile.outputs
        ).filter((r) => !r.endsWith('.map'));
      });
      build.initialOptions.entryPoints = {
        ...build.initialOptions.entryPoints,
        ...result,
      };
    },
  };
}
