import { Plugin, PluginBuild } from 'esbuild';
import { DEPLOY_URL } from '../custom-loader/custom-loader';
import { CUSTOM_LOADER_NAME } from './move-custom-loader-plugin';


export function serverSSRPlugin(deployUrl: string): Plugin {
  return {
    name: 'serverSSRPlugin',
    setup(build: PluginBuild) {
      if (build.initialOptions.platform !== 'node') return;
      const serverSrrName = 'server.ssr';

      build.initialOptions.entryPoints = {
        ...build.initialOptions.entryPoints,
        [serverSrrName]: serverSrrName,
      };
      build.initialOptions.external = [
        ...build.initialOptions.external,
        './server.mjs',
      ];
      build.onResolve(
        { filter: new RegExp('^' + serverSrrName) },
        ({ kind, path }) => {
          if (kind !== 'entry-point') {
            return null;
          }
          return {
            path: path,
            namespace: serverSrrName,
          };
        }
      );
      build.onLoad({ filter: /./, namespace: serverSrrName }, () => {
        return {
          contents: `
            import {register} from "node:module";
            const { port1, port2 } = new MessageChannel();
            register('./${CUSTOM_LOADER_NAME}.mjs', {
              parentURL: import.meta.url,
              data: { port: port2 },
              transferList: [port2],
            });
            port1.postMessage({ kind: '${DEPLOY_URL}', result: '${deployUrl}' });
            import('./server.mjs')
          `,
          loader: 'js',
        };
      });
    },
  };
}
