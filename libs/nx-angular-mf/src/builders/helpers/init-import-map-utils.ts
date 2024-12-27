export const IMPORT_MAP_CONFIG_NAME = 'import-map-config.json';

export function addToPathName(currentPathname, addPathname) {
  return [
    ...currentPathname.split('/').filter((i) => !!i),
    ...addPathname.split('/').filter((i) => !!i),
  ].join('/');
}

export async function fetchImportMap(host: string) {
  const urlHost = new URL(host);
  const pathName = addToPathName(urlHost.pathname, IMPORT_MAP_CONFIG_NAME);
  const url = new URL(pathName, urlHost.origin).toString();
  try {
    const r = await fetch(url);
    return await r.json();
  } catch (e) {
    console.log(url);
    throw e;
  }
}

export async function getResultImportMap(mainImportMap) {
  const resultImportMap = {
    imports: mainImportMap['imports'],
    scopes: {},
  };

  if (
    mainImportMap['remoteEntry'] &&
    typeof mainImportMap['remoteEntry'] === 'object'
  ) {
    const resultPromise = Object.entries<string>(
      mainImportMap['remoteEntry']
    ).map(([key, value]) => {
      return fetchImportMap(value).then((r) => {
        return {
          imports: Object.entries<string>(r.exposes).reduce((acum, [k, v]) => {
            const UrlRemote = new URL(value);

            acum[`${key}/${k}`] = new URL(
              addToPathName(UrlRemote.pathname, v),
              UrlRemote.origin
            ).toString();
            return acum;
          }, {}),
          scopes: {
            [value]: Object.entries(r.imports)
              .filter(([k, v]) => {
                if (!resultImportMap['imports'][k]) {
                  return true;
                }
                const path = resultImportMap['imports'][k];
                // @ts-expect-error should be using as string function
                return !path.endsWith(v.split('/').at(-1));
              })
              .reduce((acum, [k, v]) => {
                acum[k] = v;
                return acum;
              }, {}),
          },
        };
      });
    });

    const result = await Promise.all(resultPromise);
    for (const resultItem of result) {
      resultImportMap['imports'] = {
        ...resultImportMap['imports'],
        ...resultItem['imports'],
      };
      resultImportMap['scopes'] = {
        ...resultImportMap['scopes'],
        ...resultItem['scopes'],
      };
    }
  }
  return resultImportMap;
}
