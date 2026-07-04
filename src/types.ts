export interface ProxyConfig {
  type: 'none' | 'http' | 'https' | 'socks5';
  host: string;
  port: string;
  username: string;
  password: string;
}

export interface Fingerprint {
  os: string;
  osVersion: string;
  browserVersion: string;
  screenResolution: string;
  language: string;
  timezone: string;
  webglVendor: string;
  webglRenderer: string;
  hardwareConcurrency: number;
  deviceMemory: number;
  canvasNoise: boolean;
  audioNoise: boolean;
  webrtcMode: 'real' | 'disabled' | 'altered';
  userAgent: string;
}

export interface BrowserProfile {
  id: string;
  name: string;
  group: string;
  status: 'ready' | 'running' | 'error';
  createdAt: string;
  lastUsed: string;
  proxy: ProxyConfig;
  fingerprint: Fingerprint;
  notes: string;
  color: string;
  locked?: boolean;
  lockPin?: string;
}

export interface ProfileGroup {
  id: string;
  name: string;
  color: string;
  profileIds: string[];
}

export type ModalType = 'editor' | 'import' | 'export' | 'delete' | null;
export type ViewType = 'profiles' | 'groups' | 'proxies';

export interface Toast {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
}

export interface CamoufoxDownloadProgress {
  status: 'idle' | 'downloading' | 'extracting' | 'done' | 'error';
  percent?: number;
  speed?: string;
  downloaded?: string;
  total?: string;
  error?: string;
}

export interface ElectronAPI {
  windowMinimize: () => void;
  windowMaximize: () => void;
  windowClose: () => void;
  auth: {
    setToken: (token: string) => void;
    getToken: () => string | null;
    clearToken: () => void;
  };
  camoufox: {
    checkInstalled: () => Promise<boolean>;
    launch: (profileId: string, config: any) => Promise<{ success: boolean; error?: string }>;
    stop: (profileId: string) => Promise<boolean>;
    listActive: () => Promise<string[]>;
    download: () => Promise<void>;
    onDownloadProgress: (callback: (data: CamoufoxDownloadProgress) => void) => void;
    onProfileStopped: (callback: (profileId: string) => void) => void;
  };
  quit: () => void;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}
