import { getOSCategory } from './fingerprint';

const C = '#8888a0';

export function WindowsIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M3 5.5L10 4.5V11.5H3V5.5Z" fill={C} />
      <path d="M11 4.3L21 3V11.5H11V4.3Z" fill={C} />
      <path d="M3 12.5H10V19.5L3 18.5V12.5Z" fill={C} />
      <path d="M11 12.5H21V21L11 19.7V12.5Z" fill={C} />
    </svg>
  );
}

export function AppleIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M18.71 19.5C17.88 20.74 17 21.95 15.66 21.97C14.32 22 13.89 21.18 12.37 21.18C10.84 21.18 10.37 21.95 9.1 22C7.79 22.05 6.8 20.68 5.96 19.47C4.25 16.94 2.94 12.45 4.7 9.39C5.57 7.87 7.13 6.91 8.82 6.88C10.1 6.86 11.32 7.75 12.11 7.75C12.89 7.75 14.37 6.68 15.92 6.84C16.57 6.87 18.39 7.1 19.56 8.82C19.47 8.88 17.39 10.1 17.41 12.63C17.44 15.65 20.06 16.66 20.09 16.67C20.06 16.74 19.67 18.11 18.71 19.5ZM13 3.5C13.73 2.67 14.94 2.04 15.94 2C16.07 3.17 15.6 4.35 14.9 5.19C14.21 6.04 13.07 6.7 11.95 6.61C11.8 5.46 12.36 4.26 13 3.5Z" fill={C} />
    </svg>
  );
}

export function LinuxIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M12 2C8.96 2 6.5 5.69 6.5 10.2C6.5 12.12 6.97 13.88 7.75 15.28C6.68 15.89 5.77 16.85 5.38 18H3V20H6C6.08 20.68 6.28 21.32 6.58 21.9L8.18 21.1C8.07 20.77 8 20.4 8 20C8 19.03 8.35 18.14 8.93 17.45C9.87 17.79 10.9 18 12 18C13.1 18 14.13 17.79 15.07 17.45C15.65 18.14 16 19.03 16 20C16 20.4 15.93 20.77 15.82 21.1L17.42 21.9C17.72 21.32 17.92 20.68 18 20H21V18H18.62C18.23 16.85 17.32 15.89 16.25 15.28C17.03 13.88 17.5 12.12 17.5 10.2C17.5 5.69 15.04 2 12 2ZM9.5 9C10.33 9 11 9.67 11 10.5C11 11.33 10.33 12 9.5 12C8.67 12 8 11.33 8 10.5C8 9.67 8.67 9 9.5 9ZM14.5 9C15.33 9 16 9.67 16 10.5C16 11.33 15.33 12 14.5 12C13.67 12 13 11.33 13 10.5C13 9.67 13.67 9 14.5 9ZM10 14H14C14 15.1 13.1 16 12 16C10.9 16 10 15.1 10 14Z" fill={C} />
    </svg>
  );
}

export function ChromeIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke={C} strokeWidth="2" fill="none" />
      <circle cx="12" cy="12" r="4" fill={C} />
    </svg>
  );
}

export function FirefoxIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke={C} strokeWidth="2" fill="none" />
      <path d="M12 6C15.31 6 18 8.69 18 12C18 15.31 15.31 18 12 18" stroke={C} strokeWidth="2" fill="none" />
    </svg>
  );
}

export function SafariIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke={C} strokeWidth="2" fill="none" />
      <path d="M12 6L14 12L12 18L10 12L12 6Z" fill={C} />
    </svg>
  );
}

export function EdgeIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM12 20C7.59 20 4 16.41 4 12C4 7.59 7.59 4 12 4C16.41 4 20 7.59 20 12C20 16.41 16.41 20 12 20Z" fill={C} />
    </svg>
  );
}

export function getOSIconComponent(os: string, size = 14) {
  const cat = getOSCategory(os);
  if (cat === 'macOS') return <AppleIcon size={size} />;
  if (cat === 'Windows') return <WindowsIcon size={size} />;
  return <LinuxIcon size={size} />;
}

export function getBrowserIconComponent(browser: string, size = 14) {
  if (browser.includes('Chrome')) return <ChromeIcon size={size} />;
  if (browser.includes('Firefox')) return <FirefoxIcon size={size} />;
  if (browser.includes('Safari')) return <SafariIcon size={size} />;
  if (browser.includes('Edge')) return <EdgeIcon size={size} />;
  return <ChromeIcon size={size} />;
}

export function getOSLabel(os: string): string {
  return os;
}

export function getOSDescription(os: string): string {
  const cat = getOSCategory(os);
  if (cat === 'macOS') return 'Apple Silicon / Intel • Safari, Chrome, Firefox';
  if (cat === 'Windows') return 'NVIDIA / AMD / Intel GPU • Chrome, Firefox, Edge';
  return 'Mesa / NVIDIA / AMD GPU • Chrome, Firefox';
}
