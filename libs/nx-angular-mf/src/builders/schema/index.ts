export type SchemaMf = {
  mf?: {
    skipList?: string | string[];
    externalList?: string | string[];
    esPlugins?: string[];
    indexHtmlTransformer?: string;
    exposes?: Record<string, string>;
    remoteEntry?: Record<string, string>;
  };
};
