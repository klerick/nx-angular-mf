import { Context, DefaultLoad, NextResolve } from './types';
import { join } from 'path';

export async function initialize({ port }: { port: MessagePort }) {
  port.onmessage = async (event) => {};
}

export async function resolve(
  specifier: string,
  context: Context,
  nextResolve: NextResolve
) {
  const { parentURL } = context;
  if (
    specifier.startsWith('vite') &&
    parentURL.indexOf('@angular/build') > -1
  ) {
    return nextResolve(
      join(__dirname, 'patch-vite-dev-server.js'),
      context,
      nextResolve
    );
  }

  return nextResolve(specifier, context, nextResolve);
}

export async function load(
  url: string,
  context: Context,
  defaultLoad: DefaultLoad
) {
  return defaultLoad(url, context, defaultLoad);
}
