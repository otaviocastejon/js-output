/** Pathname only — drop query string so secrets in `?…` never echo on the wire. */
export function requestPath(url: string | undefined): string | undefined {
  if (url === undefined) return undefined;
  const q = url.indexOf('?');
  return q === -1 ? url : url.slice(0, q);
}
