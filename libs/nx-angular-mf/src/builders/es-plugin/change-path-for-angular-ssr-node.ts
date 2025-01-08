import { Plugin, PluginBuild } from 'esbuild';


export function changePathForAngularSsrNode(): Plugin {
  return {
    name: 'log-plugin',
    setup(build: PluginBuild) {
      if (build.initialOptions.entryPoints['server']) {
        build.onResolve({ filter: /./ }, (data) => {
          const { path } = data;
          if (path === '@angular/ssr/node') {
            return {
              path: require.resolve('@angular/ssr/node', {
                paths: [process.cwd()],
              }),
            };
          }
          return null;
        });
      }
    },
  }
}
