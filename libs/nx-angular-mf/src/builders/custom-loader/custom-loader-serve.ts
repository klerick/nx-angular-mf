import { Context, DefaultLoad, NextResolve } from './types';


export async function initialize({ port }: { port: MessagePort }) {
  port.onmessage = async (event) => {};
}

export async function resolve(
  specifierInput: string,
  context: Context,
  nextResolve: NextResolve
) {
  nextResolve(specifierInput, context, nextResolve);
}

export async function load(
  url: string,
  context: Context,
  defaultLoad: DefaultLoad
) {
  return defaultLoad(url, context, defaultLoad);
}
