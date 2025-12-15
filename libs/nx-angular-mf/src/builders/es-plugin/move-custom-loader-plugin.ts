import { join } from 'node:path';
import { Plugin, PluginBuild } from 'esbuild';
import { CUSTOM_LOADER_NAME } from '../custom-loader/constants';

export function moveCustomLoaderPlugin(): Plugin {
  const pathToCustomLoaderFolder = join(__dirname, '../custom-loader');
  return {
    name: 'moveCustomLoaderPlugin',
    setup(build: PluginBuild) {
      if (build.initialOptions.platform !== 'node') return;
      const customLoaderName = CUSTOM_LOADER_NAME;
      build.initialOptions.entryPoints = {
        ...build.initialOptions.entryPoints,
        [customLoaderName]: customLoaderName,
      };
      build.onResolve(
        { filter: new RegExp('^' + customLoaderName) },
        ({ kind, path }) => {
          if (kind === 'import-statement') {
            return {
              path: join(pathToCustomLoaderFolder, 'custom-loader.js'),
            };

          }
          return {
            path: path,
            namespace: customLoaderName,
          };
        }
      );
      build.onLoad({ filter: /./, namespace: customLoaderName }, () => {
        return {
          contents: `
            import * as customLoader from "custom-loader";
            const {
              initialize,
              resolve,
              load
            } = customLoader;
            export {
              initialize,
              resolve,
              load
            }
          `,
          loader: 'js',
        };
      });
    },
  }
}
