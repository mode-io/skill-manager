export const SUPPORTED_PLATFORMS = new Set(["darwin", "linux"]);

export function isSupportedPlatform(platform) {
  return SUPPORTED_PLATFORMS.has(platform);
}

export function assertSupportedPlatform(platform = process.platform) {
  if (!isSupportedPlatform(platform)) {
    throw new Error(`Unsupported desktop platform: ${platform}`);
  }
}
