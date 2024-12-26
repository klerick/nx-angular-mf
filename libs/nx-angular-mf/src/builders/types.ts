export type ConfigMf = {
  skipList: string[];
  externalList: string[];
  shared: SharedMap;
  sharedMappings: { key: string; path: string }[];
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
