export async function loadModule<T = any>(url: string): Promise<T> {
  return import(/* @vite-ignore */ url);
}
