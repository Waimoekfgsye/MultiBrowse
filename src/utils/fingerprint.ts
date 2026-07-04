import type { Fingerprint } from '../types';
import { getTimezoneForLocale } from './localeTimezoneMap';

const OS_OPTIONS = ['Windows', 'macOS', 'Linux'];

const OS_VERSIONS: Record<string, string[]> = {
  'Windows': ['Windows 11 24H2', 'Windows 11 23H2', 'Windows 11 22H2', 'Windows 10 22H2', 'Windows 10 21H2'],
  'macOS': ['macOS 15 Sequoia', 'macOS 14 Sonoma', 'macOS 13 Ventura', 'macOS 12 Monterey'],
  'Linux': ['Ubuntu 24.04', 'Ubuntu 22.04', 'Fedora 40', 'Fedora 39', 'Debian 12', 'Arch Linux'],
};

const BROWSER_VERSIONS: Record<string, string[]> = {
  'macOS': [
    'Firefox 152',
  ],
  'Windows': [
    'Firefox 152',
  ],
  'Linux': [
    'Firefox 152',
  ],
};

function getBrowserFamily(browserVersion: string): 'firefox' | 'chromium' | 'webkit' {
  const name = browserVersion.split(' ')[0];
  if (name === 'Firefox') return 'firefox';
  if (name === 'Safari') return 'webkit';
  return 'chromium';
}

function isExperimentalBrowser(browserVersion: string): boolean {
  return getBrowserFamily(browserVersion) !== 'firefox';
}

const MAC_RESOLUTIONS = ['2560x1600', '2880x1800', '3024x1964', '3456x2234', '5120x2880', '1920x1200', '2560x1440', '1440x900'];
const PC_RESOLUTIONS = ['1920x1080', '2560x1440', '3840x2160', '1366x768', '1536x864', '1680x1050', '1600x900', '3440x1440'];
const SCREEN_RESOLUTIONS = [...PC_RESOLUTIONS, ...MAC_RESOLUTIONS];

const LANGUAGES = [
  'en-US', 'en-GB', 'en-AU', 'en-CA', 'de-DE', 'fr-FR', 'es-ES', 'it-IT',
  'pt-BR', 'pt-PT', 'nl-NL', 'ru-RU', 'ja-JP', 'ko-KR', 'zh-CN', 'zh-TW',
  'ar-SA', 'hi-IN', 'tr-TR', 'pl-PL', 'sv-SE', 'da-DK', 'nb-NO', 'fi-FI',
  'th-TH', 'vi-VN', 'id-ID', 'ms-MY', 'cs-CZ', 'uk-UA',
];

const TIMEZONES = [
  'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
  'America/Toronto', 'America/Sao_Paulo', 'America/Mexico_City',
  'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Europe/Madrid',
  'Europe/Rome', 'Europe/Amsterdam', 'Europe/Moscow', 'Europe/Istanbul', 'Europe/Warsaw',
  'Asia/Tokyo', 'Asia/Seoul', 'Asia/Shanghai', 'Asia/Hong_Kong',
  'Asia/Singapore', 'Asia/Dubai', 'Asia/Kolkata', 'Asia/Bangkok', 'Asia/Jakarta',
  'Australia/Sydney', 'Australia/Melbourne', 'Pacific/Auckland',
  'Africa/Cairo', 'Africa/Johannesburg',
];

const WEBGL_MAC: { vendor: string; renderer: string }[] = [
  { vendor: 'Apple Inc.', renderer: 'Apple M1' },
  { vendor: 'Apple Inc.', renderer: 'Apple M1 Pro' },
  { vendor: 'Apple Inc.', renderer: 'Apple M1 Max' },
  { vendor: 'Apple Inc.', renderer: 'Apple M2' },
  { vendor: 'Apple Inc.', renderer: 'Apple M2 Pro' },
  { vendor: 'Apple Inc.', renderer: 'Apple M2 Max' },
  { vendor: 'Apple Inc.', renderer: 'Apple M3' },
  { vendor: 'Apple Inc.', renderer: 'Apple M3 Pro' },
  { vendor: 'Apple Inc.', renderer: 'Apple M4' },
  { vendor: 'Apple Inc.', renderer: 'Apple M4 Pro' },
  { vendor: 'ATI Technologies Inc.', renderer: 'AMD Radeon Pro 5500M OpenGL Engine' },
];

const WEBGL_WINDOWS: { vendor: string; renderer: string }[] = [
  { vendor: 'Google Inc. (NVIDIA)', renderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 4090 Direct3D11 vs_5_0 ps_5_0)' },
  { vendor: 'Google Inc. (NVIDIA)', renderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 4080 Direct3D11 vs_5_0 ps_5_0)' },
  { vendor: 'Google Inc. (NVIDIA)', renderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 4070 Ti Direct3D11 vs_5_0 ps_5_0)' },
  { vendor: 'Google Inc. (NVIDIA)', renderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 4070 Direct3D11 vs_5_0 ps_5_0)' },
  { vendor: 'Google Inc. (NVIDIA)', renderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 4060 Direct3D11 vs_5_0 ps_5_0)' },
  { vendor: 'Google Inc. (NVIDIA)', renderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3080 Direct3D11 vs_5_0 ps_5_0)' },
  { vendor: 'Google Inc. (NVIDIA)', renderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3070 Direct3D11 vs_5_0 ps_5_0)' },
  { vendor: 'Google Inc. (NVIDIA)', renderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0 ps_5_0)' },
  { vendor: 'Google Inc. (AMD)', renderer: 'ANGLE (AMD, AMD Radeon RX 7900 XTX Direct3D11 vs_5_0 ps_5_0)' },
  { vendor: 'Google Inc. (AMD)', renderer: 'ANGLE (AMD, AMD Radeon RX 7800 XT Direct3D11 vs_5_0 ps_5_0)' },
  { vendor: 'Google Inc. (AMD)', renderer: 'ANGLE (AMD, AMD Radeon RX 6800 XT Direct3D11 vs_5_0 ps_5_0)' },
  { vendor: 'Google Inc. (AMD)', renderer: 'ANGLE (AMD, AMD Radeon RX 6700 XT Direct3D11 vs_5_0 ps_5_0)' },
  { vendor: 'Google Inc. (Intel)', renderer: 'ANGLE (Intel, Intel Arc A770 Direct3D11 vs_5_0 ps_5_0)' },
  { vendor: 'Google Inc. (Intel)', renderer: 'ANGLE (Intel, Intel UHD Graphics 770 Direct3D11 vs_5_0 ps_5_0)' },
  { vendor: 'Google Inc. (Intel)', renderer: 'ANGLE (Intel, Intel Iris Xe Graphics Direct3D11 vs_5_0 ps_5_0)' },
];

const WEBGL_LINUX: { vendor: string; renderer: string }[] = [
  { vendor: 'NVIDIA Corporation', renderer: 'NVIDIA GeForce RTX 4080/PCIe/SSE2' },
  { vendor: 'NVIDIA Corporation', renderer: 'NVIDIA GeForce RTX 3070/PCIe/SSE2' },
  { vendor: 'ATI Technologies Inc.', renderer: 'AMD Radeon RX 7900 XTX' },
  { vendor: 'ATI Technologies Inc.', renderer: 'AMD Radeon RX 6800 XT' },
  { vendor: 'X.Org', renderer: 'AMD Radeon RX 7900 XTX (radeonsi, navi31, LLVM 15.0.7)' },
  { vendor: 'Intel Inc.', renderer: 'Intel(R) UHD Graphics 770' },
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getOSCategory(os: string): 'macOS' | 'Windows' | 'Linux' {
  if (os === 'macOS') return 'macOS';
  if (os === 'Windows') return 'Windows';
  return 'Linux';
}

function buildUserAgent(os: string, browser: string): string {
  const cat = getOSCategory(os);
  const bName = browser.split(' ')[0];
  const bVer = browser.replace(/^[^\d]+/, '').split(' ')[0];

  let osPart = '';
  if (cat === 'macOS') osPart = 'Macintosh; Intel Mac OS X 10_15_7';
  else if (cat === 'Windows') osPart = 'Windows NT 10.0; Win64; x64';
  else osPart = 'X11; Linux x86_64';

  if (bName === 'Chrome' || bName === 'Brave' || bName === 'Arc' || bName === 'Vivaldi' || bName === 'Opera') {
    return `Mozilla/5.0 (${osPart}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${bVer || '131'}.0.0.0 Safari/537.36`;
  } else if (bName === 'Edge') {
    return `Mozilla/5.0 (${osPart}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${bVer}.0.0.0 Safari/537.36 Edg/${bVer}.0.0.0`;
  } else if (bName === 'Firefox') {
    return `Mozilla/5.0 (${osPart}; rv:${bVer}.0) Gecko/20100101 Firefox/${bVer}.0`;
  } else if (bName === 'Safari') {
    return `Mozilla/5.0 (${osPart}) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/${bVer} Safari/605.1.15`;
  }
  return `Mozilla/5.0 (${osPart}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36`;
}

function generateFingerprint(os?: string): Fingerprint {
  const selectedOS = os || pick(OS_OPTIONS);
  const cat = getOSCategory(selectedOS);
  const browsers = BROWSER_VERSIONS[cat] || BROWSER_VERSIONS['Windows'];
  const browserVersion = pick(browsers);
  const resolutions = cat === 'macOS' ? MAC_RESOLUTIONS : PC_RESOLUTIONS;

  let webgl: { vendor: string; renderer: string };
  if (cat === 'macOS') webgl = pick(WEBGL_MAC);
  else if (cat === 'Windows') webgl = pick(WEBGL_WINDOWS);
  else webgl = pick(WEBGL_LINUX);

  const hwConcurrency = cat === 'macOS' ? pick([8, 10, 12, 16, 24]) : pick([4, 6, 8, 12, 16, 24, 32]);
  const devMemory = pick([4, 8, 16, 32, 64]);
  const versions = OS_VERSIONS[cat] || OS_VERSIONS['Windows'];
  const osVersion = pick(versions);
  const language = pick(LANGUAGES);
  const timezone = getTimezoneForLocale(language);

  return {
    os: selectedOS,
    osVersion,
    browserVersion,
    screenResolution: pick(resolutions),
    language,
    timezone,
    webglVendor: webgl.vendor,
    webglRenderer: webgl.renderer,
    hardwareConcurrency: hwConcurrency,
    deviceMemory: devMemory,
    canvasNoise: Math.random() > 0.3,
    audioNoise: Math.random() > 0.3,
    webrtcMode: pick(['real', 'disabled', 'altered'] as const),
    userAgent: buildUserAgent(selectedOS, browserVersion),
  };
}

function regenerateForOS(os: string, _existing: Fingerprint): Fingerprint {
  return generateFingerprint(os);
}

export {
  generateFingerprint,
  regenerateForOS,
  getOSCategory,
  getBrowserFamily,
  isExperimentalBrowser,
  OS_OPTIONS,
  OS_VERSIONS,
  BROWSER_VERSIONS,
  SCREEN_RESOLUTIONS,
  MAC_RESOLUTIONS,
  PC_RESOLUTIONS,
  LANGUAGES,
  TIMEZONES,
  WEBGL_MAC,
  WEBGL_WINDOWS,
  WEBGL_LINUX
};
