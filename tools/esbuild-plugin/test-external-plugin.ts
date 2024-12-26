import { Plugin, PluginBuild } from 'esbuild';

const TestExternalPlugin: Plugin = {
  name: 'testExternalPlugin',
  setup(build: PluginBuild) {
    build.initialOptions.minifyIdentifiers = false;
    build.initialOptions.keepNames = true;
  },
};

export default TestExternalPlugin;
