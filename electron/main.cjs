const { app, BrowserWindow, ipcMain, nativeImage, Tray, screen, safeStorage } = require('electron');
const path = require('path');
const fs = require('fs');
const https = require('https');
const http = require('http');
const { execFile, spawn } = require('child_process');
const { getWebGLBundle } = require('./webglProfiles.cjs');

const PROFILE_SYNC_API = 'https://worker-setup-unrealvfx.unrealvfx.workers.dev';

let mainWindow;
let tray = null;

// ── Camoufox Config ──────────────────────────────────────────────────
const CAMOUFOX_VERSION = '135.0.1-beta.24';
const CAMOUFOX_TAG = `v${CAMOUFOX_VERSION}`;
const CAMOUFOX_ZIP = `camoufox-${CAMOUFOX_VERSION}-win.x86_64.zip`;
const CAMOUFOX_URL = `https://github.com/daijro/camoufox/releases/download/${CAMOUFOX_TAG}/${CAMOUFOX_ZIP}`;

function getCamoufoxDir() {
  return path.join(app.getPath('userData'), 'camoufox');
}
function getCamoufoxBinPath() {
  return path.join(getCamoufoxDir(), 'camoufox.exe');
}
function isCamoufoxInstalled() {
  return fs.existsSync(getCamoufoxBinPath());
}

function getAuthTokenFilePath() {
  return path.join(app.getPath('userData'), 'auth-token.json');
}

function loadAuthTokenFromDisk() {
  try {
    const file = getAuthTokenFilePath();
    if (!fs.existsSync(file)) return null;
    const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (raw.encrypted && raw.data) {
      if (!safeStorage.isEncryptionAvailable()) return null;
      const buf = Buffer.from(raw.data, 'base64');
      return safeStorage.decryptString(buf);
    }
    return typeof raw.data === 'string' ? raw.data : null;
  } catch (err) {
    console.warn('[Auth] Failed to load token from disk:', err.message || err);
    return null;
  }
}

function saveAuthTokenToDisk(token) {
  try {
    const file = getAuthTokenFilePath();
    if (safeStorage.isEncryptionAvailable()) {
      const enc = safeStorage.encryptString(token);
      fs.writeFileSync(file, JSON.stringify({ encrypted: true, data: enc.toString('base64') }), 'utf8');
    } else {
      fs.writeFileSync(file, JSON.stringify({ encrypted: false, data: token }), 'utf8');
    }
  } catch (err) {
    console.warn('[Auth] Failed to save token to disk:', err.message || err);
  }
}

function clearAuthTokenFromDisk() {
  try {
    const file = getAuthTokenFilePath();
    if (fs.existsSync(file)) fs.unlinkSync(file);
  } catch (err) {
    console.warn('[Auth] Failed to clear token from disk:', err.message || err);
  }
}

// ── Download ─────────────────────────────────────────────────────────
function followRedirects(url, callback) {
  const proto = url.startsWith('https') ? https : http;
  proto.get(url, { headers: { 'User-Agent': 'MultiBrowse/1.0' } }, (res) => {
    if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
      followRedirects(res.headers.location, callback);
    } else {
      callback(res);
    }
  }).on('error', (err) => callback(null, err));
}

function downloadCamoufox() {
  return new Promise((resolve, reject) => {
    const dir = getCamoufoxDir();
    const zipPath = path.join(dir, CAMOUFOX_ZIP);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    mainWindow?.webContents.send('camoufox-download-progress', {
      status: 'downloading', percent: 0, speed: '0 MB/s', downloaded: '0', total: '0'
    });

    followRedirects(CAMOUFOX_URL, (res, err) => {
      if (err || !res) {
        mainWindow?.webContents.send('camoufox-download-progress', { status: 'error', error: err?.message || 'Download failed' });
        return reject(err || new Error('Download failed'));
      }
      if (res.statusCode !== 200) {
        mainWindow?.webContents.send('camoufox-download-progress', { status: 'error', error: `HTTP ${res.statusCode}` });
        return reject(new Error(`HTTP ${res.statusCode}`));
      }

      const totalBytes = parseInt(res.headers['content-length'] || '0', 10);
      let downloadedBytes = 0, lastTime = Date.now(), lastBytes = 0;
      const file = fs.createWriteStream(zipPath);
      res.pipe(file);

      res.on('data', (chunk) => {
        downloadedBytes += chunk.length;
        const now = Date.now(), elapsed = (now - lastTime) / 1000;
        if (elapsed >= 0.4) {
          const speed = ((downloadedBytes - lastBytes) / elapsed / 1048576).toFixed(1);
          const percent = totalBytes > 0 ? Math.round((downloadedBytes / totalBytes) * 100) : 0;
          mainWindow?.webContents.send('camoufox-download-progress', {
            status: 'downloading', percent, speed: `${speed} MB/s`,
            downloaded: (downloadedBytes / 1048576).toFixed(1),
            total: (totalBytes / 1048576).toFixed(1),
          });
          lastTime = now; lastBytes = downloadedBytes;
        }
      });

      file.on('finish', () => {
        file.close();
        mainWindow?.webContents.send('camoufox-download-progress', { status: 'extracting', percent: 100 });
        extractZip(zipPath, dir).then(() => {
          try { fs.unlinkSync(zipPath); } catch {}
          mainWindow?.webContents.send('camoufox-download-progress', { status: 'done' });
          resolve();
        }).catch((e) => {
          mainWindow?.webContents.send('camoufox-download-progress', { status: 'error', error: e.message });
          reject(e);
        });
      });

      file.on('error', (e) => {
        try { fs.unlinkSync(zipPath); } catch {}
        mainWindow?.webContents.send('camoufox-download-progress', { status: 'error', error: e.message });
        reject(e);
      });
    });
  });
}

function extractZip(zipPath, destDir) {
  return new Promise((resolve, reject) => {
    const ps = spawn('powershell.exe', [
      '-NoProfile', '-Command',
      `Expand-Archive -Path '${zipPath}' -DestinationPath '${destDir}' -Force`
    ]);
    ps.on('close', (code) => code === 0 ? resolve() : reject(new Error(`Extract failed (${code})`)));
    ps.on('error', reject);
  });
}

// ── Real profile folder sync (zip -> R2 / R2 -> unzip) ───────────────
// Using PowerShell Compress-Archive / Expand-Archive because no zip library is installed.
function getSyncMetaPath(profileDir) {
  return path.join(profileDir, '.cloud_sync_meta.json');
}

function readLocalSyncMeta(profileDir) {
  try {
    const p = getSyncMetaPath(profileDir);
    if (!fs.existsSync(p)) return null;
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
}

function writeLocalSyncMeta(profileDir, meta) {
  try {
    fs.writeFileSync(getSyncMetaPath(profileDir), JSON.stringify(meta, null, 2), 'utf8');
  } catch {}
}

function zipProfileDir(profileDir, outZipPath) {
  return new Promise((resolve, reject) => {
    // Exclude our local sync meta and temp zip itself by zipping the folder contents only.
    const ps = spawn('powershell.exe', [
      '-NoProfile', '-Command',
      `if (Test-Path '${outZipPath}') { Remove-Item -Force '${outZipPath}' }; Compress-Archive -Path '${profileDir}\\*' -DestinationPath '${outZipPath}' -Force`
    ]);
    ps.on('close', (code) => code === 0 ? resolve() : reject(new Error(`Zip failed (${code})`)));
    ps.on('error', reject);
  });
}

async function fetchCloudProfileMeta(profileId, token) {
  const res = await fetch(`${PROFILE_SYNC_API}/profiles`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Cloud list failed (${res.status})`);
  const data = await res.json();
  const profiles = data.profiles || [];
  return profiles.find((p) => p.id === profileId) || null;
}

async function downloadCloudProfileArchive(profileId, token, outZipPath) {
  const res = await fetch(`${PROFILE_SYNC_API}/profiles/${profileId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Cloud download failed (${res.status})`);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(outZipPath, buf);
}

async function uploadCloudProfileArchive(profileId, profileName, token, zipPath) {
  const body = fs.readFileSync(zipPath);
  const res = await fetch(`${PROFILE_SYNC_API}/profiles/${profileId}?name=${encodeURIComponent(profileName)}&type=session`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/octet-stream',
    },
    body,
  });
  if (!res.ok) throw new Error(`Cloud upload failed (${res.status})`);
  return res.json().catch(() => ({}));
}

async function syncProfileDirFromCloudIfNewer(profileId, profileName, profileDir, token) {
  console.log(`[CloudSync] Download check for ${profileId} — token available: ${!!token}`);
  if (!token) return false;
  try {
    const cloudMeta = await fetchCloudProfileMeta(profileId, token);
    if (!cloudMeta) return false;

    const localMeta = readLocalSyncMeta(profileDir);
    const cloudTs = new Date(cloudMeta.last_synced_at || cloudMeta.created_at || 0).getTime();
    const localTs = localMeta?.last_synced_at ? new Date(localMeta.last_synced_at).getTime() : 0;

    // Also check if local profile has actual session data — if not, always download
    const localHasSession = hasSavedSession(profileDir);
    const localHasCookies = fs.existsSync(path.join(profileDir, 'cookies.sqlite'));

    if (localTs >= cloudTs && localTs !== 0 && localHasSession && localHasCookies) {
      console.log(`[CloudSync] Local profile ${profileId} is up-to-date; skipping download.`);
      return false;
    }

    if (!localHasSession || !localHasCookies) {
      console.log(`[CloudSync] Local profile ${profileId} missing session/cookies — forcing download.`);
    }

    const tmpZip = path.join(app.getPath('temp'), `multibrowse-${profileId}.zip`);
    await downloadCloudProfileArchive(profileId, token, tmpZip);

    // Replace local profile dir fully so cookies/session/history truly match cloud.
    try { fs.rmSync(profileDir, { recursive: true, force: true }); } catch {}
    fs.mkdirSync(profileDir, { recursive: true });
    await extractZip(tmpZip, profileDir);
    try { fs.unlinkSync(tmpZip); } catch {}

    writeLocalSyncMeta(profileDir, {
      profile_id: profileId,
      name: profileName,
      last_synced_at: cloudMeta.last_synced_at || new Date().toISOString(),
      source: 'cloud',
    });

    console.log(`[CloudSync] Downloaded newer cloud profile for ${profileId}`);
    return true;
  } catch (err) {
    console.warn('[CloudSync] Cloud download skipped:', err.message || err);
    return false;
  }
}

async function syncProfileDirToCloud(profileId, profileName, profileDir, token) {
  console.log(`[CloudSync] Upload start for ${profileId} — token available: ${!!token}`);
  if (!token) return false;
  try {
    const tmpZip = path.join(app.getPath('temp'), `multibrowse-${profileId}.zip`);
    await zipProfileDir(profileDir, tmpZip);
    await uploadCloudProfileArchive(profileId, profileName, token, tmpZip);
    try { fs.unlinkSync(tmpZip); } catch {}

    const nowIso = new Date().toISOString();
    writeLocalSyncMeta(profileDir, {
      profile_id: profileId,
      name: profileName,
      last_synced_at: nowIso,
      source: 'local',
    });

    console.log(`[CloudSync] Uploaded profile archive for ${profileId}`);
    return true;
  } catch (err) {
    console.warn('[CloudSync] Cloud upload skipped:', err.message || err);
    return false;
  }
}

// ── Build Camoufox CAMOU_CONFIG from profile fingerprint ─────────────
function jitter(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function deriveWindowMetrics(os, screenWidth, screenHeight) {
  const isMac = os === 'macOS' || os.includes('macOS');
  const isWindows = os === 'Windows' || os.includes('Windows');

  let availTop = 0;
  let availLeft = 0;
  let reservedBottom = 0;
  let reservedRight = 0;

  if (isMac) {
    availTop = jitter(24, 28);
    reservedBottom = jitter(56, 92);
    reservedRight = jitter(0, 6);
  } else if (isWindows) {
    availTop = 0;
    reservedBottom = jitter(40, 48);
    reservedRight = jitter(0, 8);
  } else {
    availTop = jitter(0, 28);
    reservedBottom = jitter(28, 52);
    reservedRight = jitter(0, 10);
  }

  const availWidth = clamp(screenWidth - availLeft - reservedRight, 320, screenWidth);
  const availHeight = clamp(screenHeight - availTop - reservedBottom, 240, screenHeight);

  const outerMarginX = jitter(12, Math.max(24, Math.floor(availWidth * 0.08)));
  const outerMarginY = jitter(18, Math.max(36, Math.floor(availHeight * 0.10)));

  const outerWidth = clamp(availWidth - outerMarginX, 320, availWidth);
  const outerHeight = clamp(availHeight - outerMarginY, 240, availHeight);

  const browserChromeTop = isMac ? jitter(72, 96) : jitter(78, 104);
  const browserChromeSides = isMac ? jitter(0, 8) : jitter(0, 16);

  const innerWidth = clamp(outerWidth - browserChromeSides, 320, outerWidth);
  const innerHeight = clamp(outerHeight - browserChromeTop, 240, outerHeight);

  const maxScreenX = Math.max(0, availWidth - outerWidth);
  const maxScreenY = Math.max(0, availHeight - outerHeight);
  const screenX = clamp(jitter(0, Math.max(0, maxScreenX)), 0, maxScreenX);
  const screenY = clamp(availTop + jitter(0, Math.max(0, maxScreenY)), availTop, availTop + maxScreenY);

  return {
    availWidth,
    availHeight,
    availTop,
    availLeft,
    outerWidth,
    outerHeight,
    innerWidth,
    innerHeight,
    screenX,
    screenY,
  };
}

function buildCamoufoxConfig(config) {
  const fp = config?.fingerprint || {};
  const proxy = config?.proxy || {};

  const camouConfig = {};

  camouConfig['disableTheming'] = true;

  if (fp.userAgent) camouConfig['navigator.userAgent'] = fp.userAgent;
  if (fp.hardwareConcurrency) camouConfig['navigator.hardwareConcurrency'] = fp.hardwareConcurrency;
  if (fp.deviceMemory) camouConfig['navigator.deviceMemory'] = fp.deviceMemory;
  if (fp.language) {
    const [lang, region] = fp.language.split('-');
    camouConfig['navigator.language'] = fp.language;
    camouConfig['navigator.languages'] = [fp.language, lang];
    camouConfig['locale:language'] = lang;
    if (region) camouConfig['locale:region'] = region;
    camouConfig['locale:all'] = `${fp.language}, ${lang}`;
  }

  const os = fp.os || '';
  if (os.includes('Windows')) {
    camouConfig['navigator.platform'] = 'Win32';
    camouConfig['navigator.oscpu'] = 'Windows NT 10.0; Win64; x64';
  } else if (os.includes('macOS')) {
    camouConfig['navigator.platform'] = 'MacIntel';
    camouConfig['navigator.oscpu'] = 'Intel Mac OS X 10.15';
  } else {
    camouConfig['navigator.platform'] = 'Linux x86_64';
    camouConfig['navigator.oscpu'] = 'Linux x86_64';
  }

  if (fp.screenResolution) {
    const [w, h] = fp.screenResolution.split('x').map(Number);
    if (w && h) {
      const geom = deriveWindowMetrics(os, w, h);
      camouConfig['screen.width'] = w;
      camouConfig['screen.height'] = h;
      camouConfig['screen.availWidth'] = geom.availWidth;
      camouConfig['screen.availHeight'] = geom.availHeight;
      camouConfig['screen.availTop'] = geom.availTop;
      camouConfig['screen.availLeft'] = geom.availLeft;
      camouConfig['screen.colorDepth'] = 24;
      camouConfig['screen.pixelDepth'] = 24;
    }
  }

  // ── WebGL — Full bundle spoofing ──
  // Camoufox requires the complete WebGL bundle (vendor + renderer + parameters +
  // extensions + shader precision) to override WebGL reporting. Setting only
  // vendor/renderer without the full bundle makes Camoufox ignore the spoofing.
  if (fp.webglVendor && fp.webglRenderer) {
    const bundle = getWebGLBundle(fp.webglVendor, fp.webglRenderer);
    camouConfig['webGl:vendor'] = bundle.vendor;
    camouConfig['webGl:renderer'] = bundle.renderer;
    camouConfig['webGl:supportedExtensions'] = bundle.webGlSupportedExtensions;
    camouConfig['webGl2:supportedExtensions'] = bundle.webGl2SupportedExtensions;
    camouConfig['webGl:contextAttributes'] = bundle.webGlContextAttributes;
    camouConfig['webGl2:contextAttributes'] = bundle.webGl2ContextAttributes;
    camouConfig['webGl:parameters'] = bundle.webGlParameters;
    camouConfig['webGl2:parameters'] = bundle.webGl2Parameters;
    camouConfig['webGl:shaderPrecisionFormats'] = bundle.webGlShaderPrecisionFormats;
    camouConfig['webGl2:shaderPrecisionFormats'] = bundle.webGl2ShaderPrecisionFormats;
    camouConfig['webGl:parameters:blockIfNotDefined'] = false;
    camouConfig['webGl2:parameters:blockIfNotDefined'] = false;
    camouConfig['webGl:shaderPrecisionFormats:blockIfNotDefined'] = false;
    camouConfig['webGl2:shaderPrecisionFormats:blockIfNotDefined'] = false;
  }

  if (fp.webrtcMode === 'disabled') {
    camouConfig['webRtc:ipAddress'] = '';
  } else if (fp.webrtcMode === 'altered') {
    camouConfig['webRtc:localAddress'] = '192.168.1.' + (Math.floor(Math.random() * 254) + 1);
  }

  if (fp.timezone) {
    camouConfig['timezone'] = fp.timezone;
  }

  if (fp.canvasNoise) {
    camouConfig['canvas:aaOffset'] = Math.floor(Math.random() * 101) - 50;
    camouConfig['canvas:aaCapOffset'] = true;
  }

  if (fp.audioNoise) {
    const sampleRates = [44100, 48000, 96000];
    camouConfig['AudioContext:sampleRate'] = sampleRates[Math.floor(Math.random() * sampleRates.length)];
    camouConfig['AudioContext:outputLatency'] = parseFloat((0.001 + Math.random() * 0.029).toFixed(6));
    const channelCounts = [2, 2, 2, 6, 8];
    camouConfig['AudioContext:maxChannelCount'] = channelCounts[Math.floor(Math.random() * channelCounts.length)];
    camouConfig['mediaDevices:enabled'] = true;
    camouConfig['mediaDevices:micros'] = Math.floor(Math.random() * 3) + 1;
    camouConfig['mediaDevices:webcams'] = 1;
    camouConfig['mediaDevices:speakers'] = Math.floor(Math.random() * 2) + 1;
  }

  if (os === 'Windows' || os.includes('Windows')) {
    camouConfig['fonts'] = [
      'Arial', 'Arial Black', 'Calibri', 'Cambria', 'Cambria Math', 'Candara',
      'Comic Sans MS', 'Consolas', 'Constantia', 'Corbel', 'Courier New',
      'Ebrima', 'Franklin Gothic Medium', 'Gabriola', 'Gadugi', 'Georgia',
      'Impact', 'Ink Free', 'Javanese Text', 'Leelawadee UI', 'Lucida Console',
      'Lucida Sans Unicode', 'Malgun Gothic', 'Marlett', 'Microsoft Himalaya',
      'Microsoft JhengHei', 'Microsoft New Tai Lue', 'Microsoft PhagsPa',
      'Microsoft Sans Serif', 'Microsoft Tai Le', 'Microsoft YaHei',
      'Microsoft Yi Baiti', 'Mongolian Baiti', 'MS Gothic', 'MV Boli',
      'Myanmar Text', 'Nirmala UI', 'Palatino Linotype', 'Segoe MDL2 Assets',
      'Segoe Print', 'Segoe Script', 'Segoe UI', 'Segoe UI Emoji',
      'Segoe UI Historic', 'Segoe UI Symbol', 'SimSun', 'Sitka',
      'Sylfaen', 'Symbol', 'Tahoma', 'Times New Roman', 'Trebuchet MS',
      'Verdana', 'Webdings', 'Wingdings', 'Yu Gothic',
    ];
  } else if (os === 'macOS' || os.includes('macOS')) {
    camouConfig['fonts'] = [
      'American Typewriter', 'Andale Mono', 'Arial', 'Arial Black',
      'Arial Narrow', 'Arial Rounded MT Bold', 'Arial Unicode MS', 'Avenir',
      'Avenir Next', 'Avenir Next Condensed', 'Baskerville', 'Big Caslon',
      'Bodoni 72', 'Bradley Hand', 'Brush Script MT', 'Chalkboard',
      'Chalkboard SE', 'Chalkduster', 'Charter', 'Cochin', 'Comic Sans MS',
      'Copperplate', 'Courier', 'Courier New', 'DIN Alternate', 'DIN Condensed',
      'Didot', 'Futura', 'Geneva', 'Georgia', 'Gill Sans', 'Helvetica',
      'Helvetica Neue', 'Herculanum', 'Hoefler Text', 'Impact', 'Lucida Grande',
      'Luminari', 'Marker Felt', 'Menlo', 'Monaco', 'Noteworthy', 'Optima',
      'PT Mono', 'PT Sans', 'PT Serif', 'Palatino', 'Papyrus', 'Phosphate',
      'Rockwell', 'Savoye LET', 'Skia', 'Snell Roundhand', 'Tahoma',
      'Times', 'Times New Roman', 'Trebuchet MS', 'Verdana', 'Zapfino',
    ];
  } else {
    camouConfig['fonts'] = [
      'Arial', 'Courier New', 'Georgia', 'Times New Roman', 'Trebuchet MS',
      'Verdana', 'DejaVu Sans', 'DejaVu Sans Mono', 'DejaVu Serif',
      'Liberation Mono', 'Liberation Sans', 'Liberation Serif',
      'Noto Sans', 'Noto Serif',
    ];
  }

  if (fp.userAgent) {
    camouConfig['headers.User-Agent'] = fp.userAgent;
  }
  if (fp.language) {
    camouConfig['headers.Accept-Language'] = `${fp.language},${fp.language.split('-')[0]};q=0.9,en;q=0.8`;
  }

  const browserVersion = fp.browserVersion || '';
  const browserName = browserVersion.split(' ')[0] || '';
  const isFirefox = browserName === 'Firefox';
  const isChromium = ['Chrome', 'Edge', 'Brave', 'Opera', 'Vivaldi', 'Arc'].includes(browserName);
  const isWebKit = browserName === 'Safari';

  if (isChromium) {
    camouConfig['navigator.buildID'] = '';
    camouConfig['navigator.productSub'] = '20030107';
    camouConfig['navigator.vendor'] = 'Google Inc.';
    camouConfig['navigator.product'] = 'Gecko';
    camouConfig['navigator.oscpu'] = '';
  } else if (isWebKit) {
    camouConfig['navigator.buildID'] = '';
    camouConfig['navigator.productSub'] = '20030107';
    camouConfig['navigator.vendor'] = 'Apple Computer, Inc.';
    camouConfig['navigator.product'] = 'Gecko';
    camouConfig['navigator.oscpu'] = '';
  } else if (isFirefox) {
    camouConfig['navigator.buildID'] = '20181001000000';
    camouConfig['navigator.productSub'] = '20100101';
    camouConfig['navigator.vendor'] = '';
    camouConfig['navigator.product'] = 'Gecko';
  }

  return camouConfig;
}

function setCamouConfigFile(profileDir, env, configObj) {
  // Write config to a JSON file — avoids env var chunking issues with nested objects
  const configPath = path.join(profileDir, '.camou_config.json');
  fs.writeFileSync(configPath, JSON.stringify(configObj, null, 2), 'utf8');
  
  // Camoufox reads config from CAMOU_CONFIG env var.
  // Try file path first, fall back to inline JSON, then chunked env vars.
  // Different Camoufox versions may use different methods.
  
  // Method 1: Single CAMOU_CONFIG with full JSON (works if under OS env limit)
  const json = JSON.stringify(configObj);
  if (json.length < 30000) {
    env['CAMOU_CONFIG'] = json;
  } else {
    // Method 2: Chunked env vars for large configs
    const MAX_CHUNK = 30000;
    for (let i = 0; i < json.length; i += MAX_CHUNK) {
      env[`CAMOU_CONFIG_${Math.floor(i / MAX_CHUNK) + 1}`] = json.slice(i, i + MAX_CHUNK);
    }
  }
}

function hasSavedSession(profileDir) {
  const candidates = [
    path.join(profileDir, 'sessionstore.jsonlz4'),
    path.join(profileDir, 'sessionstore-backups', 'recovery.jsonlz4'),
    path.join(profileDir, 'sessionstore-backups', 'recovery.baklz4'),
    path.join(profileDir, 'sessionstore-backups', 'previous.jsonlz4'),
  ];
  return candidates.some((file) => fs.existsSync(file));
}

function writeUserJs(profileDir, config) {
  const proxy = config?.proxy || {};
  const urls = config?.startupUrls || [];
  const restorePreviousSession = hasSavedSession(profileDir);

  const prefs = [
    '// Cache & session',
    'user_pref("browser.cache.disk.enable", true);',
    'user_pref("browser.cache.memory.enable", true);',
    'user_pref("browser.cache.disk.capacity", 512000);',
    'user_pref("browser.sessionhistory.max_entries", 50);',
    'user_pref("browser.sessionhistory.max_total_viewers", 8);',
    'user_pref("browser.sessionstore.resume_from_crash", true);',
    'user_pref("browser.sessionstore.max_resumed_crashes", -1);',
    'user_pref("browser.sessionstore.resume_session_once", false);',
    '',
    '// Cookie & login persistence — keep cookies, logins, and site data across sessions',
    'user_pref("network.cookie.lifetimePolicy", 0);',
    'user_pref("privacy.sanitize.sanitizeOnShutdown", false);',
    'user_pref("privacy.clearOnShutdown.cookies", false);',
    'user_pref("privacy.clearOnShutdown.sessions", false);',
    'user_pref("privacy.clearOnShutdown.offlineApps", false);',
    'user_pref("privacy.clearOnShutdown.siteSettings", false);',
    'user_pref("privacy.clearOnShutdown.cache", false);',
    'user_pref("privacy.clearOnShutdown.history", false);',
    'user_pref("privacy.clearOnShutdown.formdata", false);',
    'user_pref("privacy.clearOnShutdown_v2.cookiesAndStorage", false);',
    'user_pref("privacy.clearOnShutdown_v2.cache", false);',
    'user_pref("privacy.clearOnShutdown_v2.historyFormDataAndDownloads", false);',
    'user_pref("signon.rememberSignons", true);',
    'user_pref("signon.autofillForms", true);',
    '',
    '// General',
    'user_pref("browser.shell.checkDefaultBrowser", false);',
    'user_pref("datareporting.policy.dataSubmissionEnabled", false);',
    'user_pref("toolkit.telemetry.enabled", false);',
    'user_pref("browser.startup.homepage_override.mstone", "ignore");',
    '',
    '// Disable Firefox RFP / built-in fingerprinting protection so Camoufox config can control spoofing',
    'user_pref("privacy.resistFingerprinting", false);',
    'user_pref("privacy.resistFingerprinting.letterboxing", false);',
    'user_pref("privacy.fingerprintingProtection", false);',
    '',
    '// Enable WebGL explicitly (Camoufox disables it by default)',
    'user_pref("webgl.disabled", false);',
    'user_pref("webgl.enable-webgl2", true);',
    'user_pref("webgl.enable-debug-renderer-info", true);',
    '',
    '// Full browser UI — tabs, toolbar, new tab button',
    'user_pref("browser.tabs.warnOnClose", false);',
    'user_pref("browser.tabs.warnOnOpen", false);',
    'user_pref("browser.newtabpage.enabled", true);',
    'user_pref("browser.toolbars.bookmarks.visibility", "always");',
    'user_pref("toolkit.legacyUserProfileCustomizations.stylesheets", true);',
    '',
    '// Search — address bar keyword search via Google',
    'user_pref("keyword.enabled", true);',
    'user_pref("browser.urlbar.suggest.searches", true);',
    'user_pref("browser.search.suggest.enabled", true);',
    'user_pref("browser.urlbar.showSearchSuggestionsFirst", true);',
    'user_pref("browser.search.separatePrivateDefault", false);',
    'user_pref("browser.search.region", "US");',
    'user_pref("browser.search.isUS", true);',
    'user_pref("browser.urlbar.update2.engineAliasRefresh", true);',
    'user_pref("browser.urlbar.shortcuts.bookmarks", true);',
    'user_pref("browser.urlbar.shortcuts.tabs", true);',
    'user_pref("browser.urlbar.shortcuts.history", true);',
  ];

  prefs.push('');
  prefs.push('// Startup behavior — always restore previous session if session data exists');
  prefs.push('// This ensures tabs, logins, and cookies survive across launches and devices');
  if (restorePreviousSession) {
    // Session data exists (local or downloaded from cloud) — restore it
    prefs.push('user_pref("browser.startup.page", 3);');
    // Also set homepage for when user opens a new window
    if (urls.length > 0) {
      const homepageValue = urls.join('|');
      prefs.push(`user_pref("browser.startup.homepage", "${homepageValue.replace(/"/g, '\\"')}");`);
    }
  } else if (urls.length > 0) {
    // First-ever launch — no session data yet, open startup URLs
    const homepageValue = urls.join('|');
    prefs.push('user_pref("browser.startup.page", 1);');
    prefs.push(`user_pref("browser.startup.homepage", "${homepageValue.replace(/"/g, '\\"')}");`);
  } else {
    prefs.push('user_pref("browser.startup.page", 1);');
  }
  // Always enable session store so next launch can restore
  prefs.push('user_pref("browser.sessionstore.enabled", true);');
  prefs.push('user_pref("browser.sessionstore.privacy_level", 0);');
  prefs.push('user_pref("browser.sessionstore.interval", 10000);');

  if (proxy.type && proxy.type !== 'none' && proxy.host) {
    prefs.push('');
    prefs.push('// Proxy');
    prefs.push('user_pref("network.proxy.type", 1);');
    if (proxy.type === 'socks5') {
      prefs.push(`user_pref("network.proxy.socks", "${proxy.host}");`);
      prefs.push(`user_pref("network.proxy.socks_port", ${parseInt(proxy.port) || 1080});`);
      prefs.push('user_pref("network.proxy.socks_version", 5);');
      prefs.push('user_pref("network.proxy.socks_remote_dns", true);');
    } else {
      prefs.push(`user_pref("network.proxy.http", "${proxy.host}");`);
      prefs.push(`user_pref("network.proxy.http_port", ${parseInt(proxy.port) || 8080});`);
      prefs.push(`user_pref("network.proxy.ssl", "${proxy.host}");`);
      prefs.push(`user_pref("network.proxy.ssl_port", ${parseInt(proxy.port) || 8080});`);
    }
  }

  if (config?.fingerprint?.webrtcMode === 'disabled') {
    prefs.push('user_pref("media.peerconnection.enabled", false);');
  } else if (config?.fingerprint?.webrtcMode === 'altered') {
    prefs.push('user_pref("media.peerconnection.ice.default_address_only", true);');
    prefs.push('user_pref("media.peerconnection.ice.proxy_only_if_behind_proxy", true);');
  }

  // WebGL vendor/renderer override via Firefox prefs
  // This directly patches what WEBGL_debug_renderer_info reports,
  // as a reliable fallback regardless of whether CAMOU_CONFIG is processed.
  const fp = config?.fingerprint || {};
  if (fp.webglRenderer) {
    prefs.push('');
    prefs.push('// WebGL override — spoof UNMASKED_VENDOR/RENDERER_WEBGL');
    const safeRenderer = String(fp.webglRenderer).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    const safeVendor = String(fp.webglVendor || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    prefs.push(`user_pref("webgl.renderer-string-override", "${safeRenderer}");`);
    prefs.push(`user_pref("webgl.vendor-string-override", "${safeVendor}");`);
  }

  // Allow unsigned extensions (for our WebGL spoof injection extension)
  prefs.push('');
  prefs.push('// Allow unsigned extensions for WebGL spoofing');
  prefs.push('user_pref("xpinstall.signatures.required", false);');
  prefs.push('user_pref("extensions.experiments.enabled", true);');

  fs.writeFileSync(path.join(profileDir, 'user.js'), prefs.join('\n'), 'utf8');

  // Write WebGL spoof extension into profile
  writeWebGLSpoofExtension(profileDir, config);

  writePoliciesJson(config);
}

// ── WebGL Spoof Extension ────────────────────────────────────────────
// Injects a content script at document_start that patches getParameter()
// for ALL four WebGL params: VENDOR(7936), RENDERER(7937),
// UNMASKED_VENDOR(37445), UNMASKED_RENDERER(37446).
// This is the only reliable way to spoof gl.getParameter(gl.RENDERER)
// since Firefox has no pref for it — only UNMASKED values have prefs.
function writeWebGLSpoofExtension(profileDir, config) {
  const fp = config?.fingerprint || {};
  if (!fp.webglRenderer && !fp.webglVendor) return;

  const extId = 'webgl-spoof@multibrowse';
  const extDir = path.join(profileDir, 'webgl-spoof-ext');
  if (!fs.existsSync(extDir)) fs.mkdirSync(extDir, { recursive: true });

  const spoofedRenderer = fp.webglRenderer || '';
  const spoofedVendor = fp.webglVendor || '';

  // manifest.json — content script runs at document_start on all pages
  const manifest = {
    manifest_version: 2,
    name: 'WebGL Spoof',
    version: '1.0',
    description: 'MultiBrowse WebGL fingerprint override',
    browser_specific_settings: {
      gecko: {
        id: extId,
        strict_min_version: '100.0',
      },
    },
    content_scripts: [
      {
        matches: ['<all_urls>'],
        js: ['inject.js'],
        run_at: 'document_start',
        all_frames: true,
      },
    ],
    permissions: [],
  };

  fs.writeFileSync(path.join(extDir, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');

  // inject.js — content script that injects a <script> tag into the page context.
  // Content scripts run in an isolated world; only a real <script> tag
  // can patch the page's WebGLRenderingContext.prototype.
  const escapedRenderer = spoofedRenderer.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '');
  const escapedVendor = spoofedVendor.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '');

  const injectJs = `
(function() {
  var s = document.createElement('script');
  s.textContent = '(' + function(R, V) {
    var G = WebGLRenderingContext;
    var origGet = G.prototype.getParameter;
    G.prototype.getParameter = function(p) {
      if (p === 7937 || p === 37446) return R;
      if (p === 7936 || p === 37445) return V;
      return origGet.call(this, p);
    };
    if (typeof WebGL2RenderingContext !== 'undefined') {
      var origGet2 = WebGL2RenderingContext.prototype.getParameter;
      WebGL2RenderingContext.prototype.getParameter = function(p) {
        if (p === 7937 || p === 37446) return R;
        if (p === 7936 || p === 37445) return V;
        return origGet2.call(this, p);
      };
    }
  }.toString() + ')(' + JSON.stringify('${escapedRenderer}') + ',' + JSON.stringify('${escapedVendor}') + ')';
  (document.head || document.documentElement).prepend(s);
  s.remove();
})();
`.trim();

  fs.writeFileSync(path.join(extDir, 'inject.js'), injectJs, 'utf8');

  // Install: write a pointer file in <profile>/extensions/<id>
  // The file content = absolute path to the extension directory.
  // Firefox reads this on startup and loads the extension from that path.
  const extensionsDir = path.join(profileDir, 'extensions');
  if (!fs.existsSync(extensionsDir)) fs.mkdirSync(extensionsDir, { recursive: true });
  fs.writeFileSync(path.join(extensionsDir, extId), extDir, 'utf8');

  console.log(`[MultiBrowse] WebGL spoof extension installed: ${spoofedVendor} / ${spoofedRenderer}`);
}

function writePoliciesJson(config) {
  const binDir = path.dirname(getCamoufoxBinPath());
  const distDir = path.join(binDir, 'distribution');
  if (!fs.existsSync(distDir)) fs.mkdirSync(distDir, { recursive: true });

  const policies = {
    policies: {
      SearchEngines: {
        Default: 'Google',
        PreventInstalls: false,
        Add: [
          {
            Name: 'Google',
            URLTemplate: 'https://www.google.com/search?q={searchTerms}',
            Method: 'GET',
            IconURL: 'https://www.google.com/favicon.ico',
            Alias: '@google',
            Description: 'Google Search',
            SuggestURLTemplate: 'https://www.google.com/complete/search?client=firefox&q={searchTerms}',
          },
          {
            Name: 'DuckDuckGo',
            URLTemplate: 'https://duckduckgo.com/?q={searchTerms}',
            Method: 'GET',
            IconURL: 'https://duckduckgo.com/favicon.ico',
            Alias: '@ddg',
            Description: 'DuckDuckGo Search',
          },
          {
            Name: 'Bing',
            URLTemplate: 'https://www.bing.com/search?q={searchTerms}',
            Method: 'GET',
            IconURL: 'https://www.bing.com/favicon.ico',
            Alias: '@bing',
            Description: 'Bing Search',
          },
        ],
      },
      OverrideFirstRunPage: '',
      OverridePostUpdatePage: '',
      DontCheckDefaultBrowser: true,
      NoDefaultBookmarks: true,
    },
  };

  fs.writeFileSync(
    path.join(distDir, 'policies.json'),
    JSON.stringify(policies, null, 2),
    'utf8'
  );
}

function writeUserChrome(profileDir, config) {
  const chromeDir = path.join(profileDir, 'chrome');
  if (!fs.existsSync(chromeDir)) fs.mkdirSync(chromeDir, { recursive: true });

  const profileName = config?.name || 'Profile';
  const profileColor = config?.color || '#e8d44d';
  const numMatch = profileName.match(/(\d+)/);
  const shortLabel = numMatch ? `P${numMatch[1]}` : profileName.charAt(0).toUpperCase();
  const safeProfileName = String(profileName)
    .replaceAll('"', '')
    .replaceAll('\\', '')
    .replaceAll('\n', ' ')
    .replaceAll('\r', ' ')
    .trim();

  const css = `
@namespace url("http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul");

:root {
  --mb-profile-color: ${profileColor};
  --mb-profile-bg: ${profileColor}22;
  --mb-profile-bg-soft: ${profileColor}15;
}

#TabsToolbar-customization-target::before {
  content: "${shortLabel}" !important;
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  min-width: 30px !important;
  height: 26px !important;
  margin: 3px 6px 3px 4px !important;
  padding: 0 6px !important;
  border-radius: 6px !important;
  background: var(--mb-profile-bg) !important;
  color: var(--mb-profile-color) !important;
  font-size: 11px !important;
  font-weight: 700 !important;
  font-family: system-ui, -apple-system, sans-serif !important;
  letter-spacing: 0.5px !important;
  line-height: 1 !important;
  flex-shrink: 0 !important;
  -moz-box-ordinal-group: 0 !important;
  order: -999 !important;
}

#nav-bar-customization-target::before {
  content: "${shortLabel}  ${safeProfileName}" !important;
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  min-width: max-content !important;
  height: 24px !important;
  margin: 0 8px 0 4px !important;
  padding: 0 8px !important;
  border-radius: 6px !important;
  background: var(--mb-profile-bg-soft) !important;
  color: var(--mb-profile-color) !important;
  font-size: 10px !important;
  font-weight: 600 !important;
  font-family: system-ui, -apple-system, sans-serif !important;
  letter-spacing: 0.3px !important;
  line-height: 1 !important;
  opacity: 0.9 !important;
  flex-shrink: 0 !important;
  -moz-box-ordinal-group: 0 !important;
  order: -999 !important;
}
`;

  fs.writeFileSync(path.join(chromeDir, 'userChrome.css'), css, 'utf8');
}

async function getTimezoneFromProxyIP(proxyHost) {
  if (!proxyHost) return null;
  try {
    const ip = proxyHost.match(/^\d+\.\d+\.\d+\.\d+$/) ? proxyHost : proxyHost;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(`http://ip-api.com/json/${ip}?fields=status,timezone`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) return null;
    const data = await res.json();
    if (data.status === 'success' && data.timezone) {
      console.log(`[MultiBrowse] Proxy IP ${ip} → timezone: ${data.timezone}`);
      return data.timezone;
    }
  } catch (err) {
    console.warn('[MultiBrowse] Proxy geo lookup failed:', err.message);
  }
  return null;
}

// ── Launch Camoufox ──────────────────────────────────────────────────
const activeProfiles = new Map();

async function launchCamoufox(profileId, config) {
  if (!isCamoufoxInstalled()) {
    await downloadCamoufox();
  }

  const binPath = getCamoufoxBinPath();
  if (!fs.existsSync(binPath)) throw new Error('Camoufox binary not found');

  const profileDir = path.join(getCamoufoxDir(), 'profiles', profileId);
  if (!fs.existsSync(profileDir)) fs.mkdirSync(profileDir, { recursive: true });

  await syncProfileDirFromCloudIfNewer(profileId, config?.name || 'Profile', profileDir, authToken);

  writeUserChrome(profileDir, config);

  const proxy = config?.proxy || {};
  if (proxy.type && proxy.type !== 'none' && proxy.host) {
    const proxyTz = await getTimezoneFromProxyIP(proxy.host);
    if (proxyTz && config.fingerprint) {
      console.log(`[MultiBrowse] Overriding timezone from proxy geo: ${config.fingerprint.timezone} → ${proxyTz}`);
      config.fingerprint.timezone = proxyTz;
    }
  }

  writeUserJs(profileDir, config);

  const display = screen.getPrimaryDisplay();
  const workArea = display?.workAreaSize || { width: 1440, height: 900 };
  const realWidth = Math.max(900, workArea.width);
  const realHeight = Math.max(700, workArea.height);

  const args = [
    '-profile', profileDir,
    '-no-remote',
    '-width', String(realWidth),
    '-height', String(realHeight),
  ];

  const env = { ...process.env };

  if (config?.fingerprint?.timezone) env.TZ = config.fingerprint.timezone;

  const camouConfig = buildCamoufoxConfig(config);
  setCamouConfigFile(profileDir, env, camouConfig);

  console.log('[MultiBrowse] Launching Camoufox with config:', JSON.stringify(camouConfig, null, 2));

  const proc = execFile(binPath, args, { detached: true, env }, (err) => {
    if (err && err.code !== null) console.log(`Camoufox exited for ${profileId}:`, err.message);

    // Immediately notify renderer that the browser closed — button goes back to Start
    activeProfiles.delete(profileId);
    mainWindow?.webContents.send('camoufox-profile-stopped', profileId);

    // Upload session data to cloud in the background (don't block the UI)
    syncProfileDirToCloud(profileId, config?.name || 'Profile', profileDir, authToken)
      .catch((uploadErr) => {
        console.warn('[CloudSync] Post-close upload failed:', uploadErr?.message || uploadErr);
      });
  });

  activeProfiles.set(profileId, { proc, config, startedAt: Date.now() });
  return true;
}

// ── Icon ─────────────────────────────────────────────────────────────
function getIconPath() {
  const candidates = [
    path.join(__dirname, '../build/icon.ico'),
    path.join(__dirname, '../public/icon.png'),
    path.join(process.resourcesPath || '', 'icon.ico'),
    path.join(path.dirname(app.getPath('exe')), 'resources', 'icon.ico'),
    path.join(path.dirname(app.getPath('exe')), 'icon.ico'),
  ];
  for (const p of candidates) {
    try { if (p && fs.existsSync(p)) return p; } catch {}
  }
  return null;
}

// ── Window ───────────────────────────────────────────────────────────
function createWindow() {
  const iconPath = getIconPath();
  const opts = {
    width: 1280, height: 800, minWidth: 1024, minHeight: 600,
    frame: false, titleBarStyle: 'hidden', backgroundColor: '#0a0a0f', show: false,
    webPreferences: { nodeIntegration: false, contextIsolation: true, preload: path.join(__dirname, 'preload.cjs') },
  };
  if (iconPath) opts.icon = iconPath;
  mainWindow = new BrowserWindow(opts);
  mainWindow.once('ready-to-show', () => mainWindow.show());

  if (iconPath) {
    try {
      tray = new Tray(nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 }));
      tray.setToolTip('MultiBrowse');
      tray.on('click', () => { if (mainWindow) { if (mainWindow.isMinimized()) mainWindow.restore(); mainWindow.focus(); } });
    } catch {}
  }
  if (iconPath && process.platform === 'win32') {
    try { mainWindow.setIcon(nativeImage.createFromPath(iconPath)); } catch {}
  }

  if (process.env.NODE_ENV === 'development') mainWindow.loadURL('http://localhost:5173');
  else mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  mainWindow.on('closed', () => { mainWindow = null; });
}

// ── Single instance lock ─────────────────────────────────────────────
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(createWindow);
}

app.on('window-all-closed', () => { if (tray) tray.destroy(); if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });

// ── IPC ──────────────────────────────────────────────────────────────
ipcMain.on('window-minimize', () => mainWindow?.minimize());
ipcMain.on('window-maximize', () => { if (mainWindow?.isMaximized()) mainWindow.unmaximize(); else mainWindow?.maximize(); });
ipcMain.on('window-close', () => mainWindow?.close());

let authToken = null;

authToken = loadAuthTokenFromDisk();

ipcMain.handle('auth-set-token', (_, token) => {
  authToken = token;
  if (token) saveAuthTokenToDisk(token);
});
ipcMain.handle('auth-get-token', () => authToken || loadAuthTokenFromDisk());
ipcMain.handle('auth-clear-token', () => {
  authToken = null;
  clearAuthTokenFromDisk();
});
ipcMain.handle('camoufox-check-installed', () => isCamoufoxInstalled());

ipcMain.handle('camoufox-launch', async (_, profileId, config) => {
  try { await launchCamoufox(profileId, config); return { success: true }; }
  catch (err) { return { success: false, error: err.message }; }
});

ipcMain.handle('camoufox-stop', async (_, profileId) => {
  const entry = activeProfiles.get(profileId);
  if (entry?.proc) {
    try { process.kill(-entry.proc.pid); } catch {}
    try { entry.proc.kill(); } catch {}
  }
  activeProfiles.delete(profileId);
  // Notify renderer immediately — the execFile callback will also fire
  // but activeProfiles.delete is idempotent and the renderer ignores
  // duplicate 'ready' status updates
  mainWindow?.webContents.send('camoufox-profile-stopped', profileId);
  return true;
});

ipcMain.handle('camoufox-list-active', () => Array.from(activeProfiles.keys()));
ipcMain.handle('camoufox-download', async () => {
  try { await downloadCamoufox(); return { success: true }; }
  catch (err) { return { success: false, error: err.message }; }
});

ipcMain.on('app-quit', () => app.quit());
