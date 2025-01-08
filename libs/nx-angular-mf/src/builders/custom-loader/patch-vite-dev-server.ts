// @ts-expect-error fix import
import { createServer as createServerVite, InlineConfig } from 'vite';
// @ts-expect-error fix import
import { Plugin, normalizePath as normalizePathVite, ViteDevServer} from 'vite'

export const PREF = 'http://';
const external = [];

export let serverFromPatch: ViteDevServer;

function createServer(inlineConfig: InlineConfig) {
  if (
    inlineConfig.optimizeDeps &&
    Array.isArray(inlineConfig.optimizeDeps.exclude)
  ) {
    external.push(...inlineConfig.optimizeDeps.exclude);
  }
  inlineConfig.plugins = [customNodeImportPlugin(), ...inlineConfig.plugins];

  return createServerVite(inlineConfig).then((server) => {
    serverFromPatch = server;
    return server;
  });
}

function normalizePath(path: string) {
  return normalizePathVite(path);
}

function customNodeImportPlugin(): Plugin {
  return {
    enforce: 'pre',
    name: 'vite:custom-node-import',
    async transform(code, id) {
      const regex = new RegExp(
        `(["'])(${external.join('|').replace('*/main.server.mjs|', '')})\\1`,
        'g'
      );
      return code.replace(regex, (match, p1, p2) => {
        return `${p1}${PREF}${p2}${p1}`;
      });
    },
  };
}

export { createServer, normalizePath };
