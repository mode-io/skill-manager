const EXTERNAL_PROTOCOLS = new Set(["http:", "https:"]);

export function shouldOpenExternal(url, backendOrigin) {
  try {
    const target = new URL(url);
    return target.origin !== backendOrigin && EXTERNAL_PROTOCOLS.has(target.protocol);
  } catch {
    return false;
  }
}
