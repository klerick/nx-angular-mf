export type Context = {
  parentURL?: string;
};

export type NextResolve = (
  specifier: string,
  context: Context,
  nextResolve: NextResolve
) => Promise<string | unknown>;

export type DefaultLoad = (
  specifier: string,
  context: Context,
  defaultLoad: DefaultLoad
) => Promise<string | unknown>;
