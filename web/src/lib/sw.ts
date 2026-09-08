export const SW_MESSAGE_TYPE = {
    SKIP_WAITING: 'SKIP_WAITING',
    CLEAR_CACHE: 'CLEAR_CACHE',
    CACHE_CLEARED: 'CACHE_CLEARED',
} as const;

export type SwMessageType = (typeof SW_MESSAGE_TYPE)[keyof typeof SW_MESSAGE_TYPE];

// Keep in sync with `web/public/sw.js`
export const DEEPRELAY_CACHE_PREFIX = 'deeprelay-';
// Font cache is version-independent and should persist across updates
export const DEEPRELAY_FONT_CACHE_NAME = 'deeprelay-font';

export function isDeepRelayCacheName(name: string) {
    return name.startsWith(DEEPRELAY_CACHE_PREFIX);
}

export function isFontCacheName(name: string) {
    return name === DEEPRELAY_FONT_CACHE_NAME;
}


