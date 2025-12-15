import type { ImportMap } from '@jspm/import-map';
import resolver from 'enhanced-resolve';

export function loadEsmModule<T>(modulePath: string | URL): Promise<T> {
  return new Function('modulePath', `return import(modulePath);`)(
    modulePath
  ) as Promise<T>;
}

export const checkIfNodeProtocol = (modulePath: string) => {
  if (!modulePath) return false;
  const { protocol = '' } = new URL(modulePath);
  return protocol === 'node:';
};
export const checkIfFileProtocol = (modulePath: string) => {
  if (!modulePath) return false;
  const { protocol = '' } = new URL(modulePath);
  return protocol === 'file:';
};

export const resolveModulePath = (
  importMap: ImportMap,
  specifier: string,
  parentURL: string
): string | null => {
  try {
    return importMap.resolve(specifier, parentURL);
  } catch {
    return null;
  }
};

const myResolver = resolver.create({
  conditionNames: ['import', 'node', 'default'],
});

export function asyncCustomResolve(specifier: string) {
  return new Promise<string>((resolve, reject) => {
    myResolver(__dirname, specifier, (err, res) => {
      if (err || !res) return reject(err);
      resolve(res);
    });
  });
}

export class DeferredPromise<T> {
  [Symbol.toStringTag]!: 'Promise';

  private _promise: Promise<T>;
  private _resolve!: (value: T | PromiseLike<T>) => void;
  private _reject!: (reason?: any) => void;
  private _finally!: (
    onfinally?: (() => void) | undefined | null
  ) => Promise<T>;
  private _state: 'pending' | 'fulfilled' | 'rejected' = 'pending';

  public get state(): 'pending' | 'fulfilled' | 'rejected' {
    return this._state;
  }

  constructor() {
    this._promise = new Promise<T>((resolve, reject) => {
      this._resolve = resolve;
      this._reject = reject;
    });
  }

  public then<TResult1, TResult2>(
    onfulfilled?: (value: T) => TResult1 | PromiseLike<TResult1>,
    onrejected?: (reason: any) => TResult2 | PromiseLike<TResult2>
  ): Promise<TResult1 | TResult2> {
    return this._promise.then(onfulfilled, onrejected);
  }

  public catch<TResult>(
    onrejected?: (reason: any) => TResult | PromiseLike<TResult>
  ): Promise<T | TResult> {
    return this._promise.catch(onrejected);
  }

  public resolve(value: T | PromiseLike<T>): void {
    this._resolve(value);
    this._state = 'fulfilled';
  }

  public reject(reason?: any): void {
    this._reject(reason);
    this._state = 'rejected';
  }
}
