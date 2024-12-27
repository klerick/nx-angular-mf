export type ConfigMf = {
  skipList: string[];
  externalList: string[];
  shared: SharedMap;
  sharedMappings: { key: string; path: string }[];
  outPutFileNames: string[];
  esPlugins: string[];
  deployUrl: string;
  allImportMap: Record<string, unknown>;
  indexHtmlTransformer: (input: string) => Promise<string>;
  exposes: Record<string, string>;
  remoteEntry: Record<string, string>;
};

export type ShareOptions = {
  singleton: boolean;
  strictVersion: boolean;
  requiredVersion: string;
  version?: string;
  includeSecondaries?: boolean;
};

export type SharedMap = Record<string, ShareOptions>;

export type MapPackage = Map<
  string,
  { packageName: string; entryPoint: string }
>;

export type DataForImportMap = {
  imports: Record<string, string>;
  exposes: Record<string, string>;
  remoteEntry: Record<string, string>;
};
