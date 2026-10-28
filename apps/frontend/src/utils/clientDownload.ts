export type ClientPlatform = 'mac-arm64' | 'mac-x64' | 'win';

export const CLIENT_FILES: Record<ClientPlatform, string> = {
  'mac-arm64': '/downloads/mammoth-agent-mac-arm64.dmg',
  'mac-x64': '/downloads/mammoth-agent-mac-x64.dmg',
  win: '/downloads/mammoth-agent-win.exe',
};

export type ClientPlatformOption = {
  id: ClientPlatform;
  /** 卡片主标题 */
  title: string;
  /** 卡片副标题：芯片 / 系统 + 安装包类型 */
  sub: string;
};

/** 顺序即弹窗里的展示顺序：Apple 芯片 Mac、Intel 芯片 Mac、Windows。 */
export const CLIENT_PLATFORM_OPTIONS: ClientPlatformOption[] = [
  { id: 'mac-arm64', title: 'Apple 芯片 Mac', sub: 'M1 / M2 / M3 / M4 · .dmg' },
  { id: 'mac-x64', title: 'Intel 芯片 Mac', sub: 'Intel 处理器 · .dmg' },
  { id: 'win', title: 'Windows', sub: 'Windows 10 / 11 · .exe' },
];

/** 只判断操作系统，不猜芯片（浏览器拿不到可靠的 CPU 型号）。 */
export function detectClientOs(): 'mac' | 'win' | 'other' {
  if (typeof navigator === 'undefined') return 'other';
  const ua = navigator.userAgent || '';
  const platform = navigator.platform || '';
  if (/Mac|iPhone|iPad/i.test(ua) || /Mac/i.test(platform)) return 'mac';
  if (/Win/i.test(ua) || /Win/i.test(platform)) return 'win';
  return 'other';
}

export function clientDownloadUrl(platform: ClientPlatform) {
  return `${CLIENT_FILES[platform]}?v=${Date.now()}`;
}