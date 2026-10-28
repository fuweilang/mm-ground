/**
 * Permission catalog (ground) — mirrors Octop PERMISSIONS + portal.* keys.
 * Source of truth for chip UI / RolePermission validation (phase1).
 * Keep in sync with Octop/src/octop/infra/users/permissions.py
 */

export type PermissionCategory =
  | 'nav'
  | 'settings'
  | 'control'
  | 'admin'
  | 'portal_admin'
  | 'portal_console';

export interface PermissionDef {
  key: string;
  category: PermissionCategory;
  labelZh: string;
  labelEn: string;
  page?: string;
  pageZh?: string;
  pageEn?: string;
}

function p(
  key: string,
  category: PermissionCategory,
  labelZh: string,
  labelEn: string,
  extra: Partial<Pick<PermissionDef, 'page' | 'pageZh' | 'pageEn'>> = {},
): PermissionDef {
  return { key, category, labelZh, labelEn, ...extra };
}

/** Octop module keys (same set as PERMISSIONS in permissions.py) */
export const OCTOP_PERMISSIONS: PermissionDef[] = [
  p('experts', 'nav', '专家', 'Experts'),
  p('tasks', 'nav', '定时任务', 'Scheduled Tasks'),
  p('token_usage', 'nav', 'Token 统计', 'Token usage'),

  p('skills', 'settings', '技能', 'Skills', {
    page: 'personalization',
    pageZh: '个性化',
    pageEn: 'Personalization',
  }),
  p('subagents', 'settings', '子智能体', 'Subagents', {
    page: 'personalization',
    pageZh: '个性化',
    pageEn: 'Personalization',
  }),
  p('tools', 'settings', '工具', 'Tools', {
    page: 'personalization',
    pageZh: '个性化',
    pageEn: 'Personalization',
  }),
  p('agent_plugins', 'settings', '插件', 'Plugins', {
    page: 'personalization',
    pageZh: '个性化',
    pageEn: 'Personalization',
  }),
  p('mbti', 'settings', 'MBTI', 'MBTI', {
    page: 'personalization',
    pageZh: '个性化',
    pageEn: 'Personalization',
  }),
  p('memory', 'settings', '记忆', 'Memory', {
    page: 'personalization',
    pageZh: '个性化',
    pageEn: 'Personalization',
  }),
  p('channels', 'settings', '通道', 'Channels'),
  p('connectors', 'settings', '连接器', 'Connectors'),
  p('skill_packages', 'settings', '技能包', 'Skill Packages'),
  p('knowledge_bases', 'settings', '知识库', 'Knowledge Base'),

  p('terminal', 'control', '工作台/终端', 'Workbench / Terminal'),
  p('browser', 'control', '工作台/浏览器', 'Workbench / Browser'),
  p('desktop', 'control', '远程桌面', 'Remote Desktop'),
  p('mobile', 'control', '远程手机', 'Remote Phone'),

  p('users', 'admin', '用户管理', 'User management', {
    page: 'users',
    pageZh: '用户',
    pageEn: 'Users',
  }),
  p('sso', 'admin', '单点登录', 'Single sign-on', {
    page: 'users',
    pageZh: '用户',
    pageEn: 'Users',
  }),
  p('providers', 'admin', '云端', 'Cloud', {
    page: 'models',
    pageZh: '模型',
    pageEn: 'Models',
  }),
  p('ollama_models', 'admin', 'Ollama', 'Ollama', {
    page: 'models',
    pageZh: '模型',
    pageEn: 'Models',
  }),
  p('onnx_models', 'admin', 'ONNX', 'ONNX', {
    page: 'models',
    pageZh: '模型',
    pageEn: 'Models',
  }),
  p('storage_backends', 'admin', '存储', 'Storage'),
  p('plugins', 'admin', '已安装', 'Installed', {
    page: 'plugins',
    pageZh: '插件',
    pageEn: 'Plugins',
  }),
  p('security', 'admin', '防护策略', 'Policy', {
    page: 'security',
    pageZh: '安全防护',
    pageEn: 'Security',
  }),
  p('admin_console', 'admin', '审计日志', 'Audit log', {
    page: 'security',
    pageZh: '安全防护',
    pageEn: 'Security',
  }),
  p('envs', 'admin', '环境变量', 'Environment', {
    page: 'advanced',
    pageZh: '应用设置',
    pageEn: 'App settings',
  }),
  p('search', 'admin', '搜索引擎', 'Search engines', {
    page: 'models',
    pageZh: '模型',
    pageEn: 'Models',
  }),
  p('knowledge_settings', 'admin', '知识库设置', 'Knowledge-base settings', {
    page: 'advanced',
    pageZh: '应用设置',
    pageEn: 'App settings',
  }),
  p('voice', 'admin', '语音模型', 'Voice models', {
    page: 'models',
    pageZh: '模型',
    pageEn: 'Models',
  }),
  p('observability', 'admin', '可观测', 'Observability', {
    page: 'advanced',
    pageZh: '应用设置',
    pageEn: 'App settings',
  }),
  p('backup', 'admin', '备份与恢复', 'Backup & restore', {
    page: 'advanced',
    pageZh: '应用设置',
    pageEn: 'App settings',
  }),
  p('tls', 'admin', 'HTTPS', 'HTTPS', {
    page: 'advanced',
    pageZh: '应用设置',
    pageEn: 'App settings',
  }),
  p('update', 'admin', '应用更新', 'Updates', {
    page: 'advanced',
    pageZh: '应用设置',
    pageEn: 'App settings',
  }),
  p('captcha', 'admin', '登录验证码', 'Login captcha', {
    page: 'advanced',
    pageZh: '应用设置',
    pageEn: 'App settings',
  }),
];

/** Portal keys (ground /admin + /console) — not in Octop PERMISSIONS */
export const PORTAL_PERMISSIONS: PermissionDef[] = [
  p('portal.admin.access', 'portal_admin', '进入总后台', 'Access admin'),
  p('portal.admin.users', 'portal_admin', '用户管理', 'Manage users'),
  p('portal.admin.enterprises', 'portal_admin', '企业管理', 'Manage enterprises'),
  p('portal.admin.roles.read', 'portal_admin', '查看角色', 'Read roles'),
  p('portal.admin.roles.write', 'portal_admin', '编辑角色', 'Write roles'),
  p('portal.console.access', 'portal_console', '进入企业控制台', 'Access console'),
  p('portal.console.members', 'portal_console', '成员管理', 'Manage members'),
  p('portal.console.settings', 'portal_console', '企业设置', 'Console settings'),
];

export const PERMISSION_CATALOG: PermissionDef[] = [
  ...OCTOP_PERMISSIONS,
  ...PORTAL_PERMISSIONS,
];

export const ALL_PERMISSION_KEYS: ReadonlySet<string> = new Set(
  PERMISSION_CATALOG.map((d) => d.key),
);

/** Octop BASELINE = settings + nav (chat ungated, not a key) */
export const BASELINE_PERMISSION_KEYS: string[] = OCTOP_PERMISSIONS.filter(
  (d) => d.category === 'settings' || d.category === 'nav',
).map((d) => d.key);

const byCat = (cat: PermissionCategory) =>
  OCTOP_PERMISSIONS.filter((d) => d.category === cat).map((d) => d.key);

/** Business-facing Octop modules (no install-level admin / control) */
export const BUSINESS_MODULE_KEYS: string[] = [
  ...byCat('nav'),
  'skills',
  'subagents',
  'tools',
  'agent_plugins',
  'mbti',
  'memory',
  'channels',
  'connectors',
  'skill_packages',
  'knowledge_bases',
];

/** OWNER: broad modules (nav+settings+control) — no Octop admin install keys */
export const OWNER_OCTOP_KEYS: string[] = [
  ...byCat('nav'),
  ...byCat('settings'),
  ...byCat('control'),
];

export const PORTAL_ADMIN_KEYS = PORTAL_PERMISSIONS.filter((d) =>
  d.key.startsWith('portal.admin.'),
).map((d) => d.key);

export const PORTAL_CONSOLE_KEYS = PORTAL_PERMISSIONS.filter((d) =>
  d.key.startsWith('portal.console.'),
).map((d) => d.key);

export const BUILTIN_ROLE_KEYS = [
  'super_admin',
  'platform_admin',
  'org_owner',
  'org_admin',
  'org_member',
] as const;

export type BuiltinRoleKey = (typeof BUILTIN_ROLE_KEYS)[number];

function uniqSorted(keys: string[]): string[] {
  return [...new Set(keys)].sort();
}

/**
 * Phase1 preset packs (design §4 + locked decisions).
 * MEMBER = BASELINE without portal.console.access
 * OWNER = broad Octop + portal.console.*
 * ADMIN = business modules + console.access + members
 */
export const ROLE_PERMISSION_PACKS: Record<BuiltinRoleKey, string[]> = {
  super_admin: uniqSorted([...ALL_PERMISSION_KEYS]),
  platform_admin: uniqSorted([
    'portal.admin.access',
    'portal.admin.users',
    'portal.admin.enterprises',
    'portal.admin.roles.read',
    ...BUSINESS_MODULE_KEYS,
  ]),
  org_owner: uniqSorted([...OWNER_OCTOP_KEYS, ...PORTAL_CONSOLE_KEYS]),
  org_admin: uniqSorted([
    ...BUSINESS_MODULE_KEYS,
    'portal.console.access',
    'portal.console.members',
  ]),
  org_member: uniqSorted([...BASELINE_PERMISSION_KEYS]),
};

export const ROLE_META: Record<
  BuiltinRoleKey,
  {
    name: string;
    description: string;
    scope: 'PLATFORM' | 'ORG_PRESET';
    editable: boolean;
  }
> = {
  super_admin: {
    name: '超级管理员',
    description: '平台超管：Catalog 全量权限（含 roles.write）',
    scope: 'PLATFORM',
    editable: false,
  },
  platform_admin: {
    name: '平台管理员',
    description: '总后台用户/企业/角色只读；无 roles.write',
    scope: 'PLATFORM',
    editable: true,
  },
  org_owner: {
    name: '企业所有者',
    description: '企业控制台全开 + Octop 业务/控制模块',
    scope: 'ORG_PRESET',
    editable: false,
  },
  org_admin: {
    name: '企业管理员',
    description: '业务模块 + console 准入与成员管理',
    scope: 'ORG_PRESET',
    editable: false,
  },
  org_member: {
    name: '企业成员',
    description: 'BASELINE（nav+settings）；无 console',
    scope: 'ORG_PRESET',
    editable: false,
  },
};

export const CATEGORY_LABELS: Record<
  PermissionCategory,
  { labelZh: string; labelEn: string }
> = {
  nav: { labelZh: '导航', labelEn: 'Nav' },
  settings: { labelZh: '设置', labelEn: 'Settings' },
  control: { labelZh: '控制', labelEn: 'Control' },
  admin: { labelZh: 'Agent 管理', labelEn: 'Agent admin' },
  portal_admin: { labelZh: '总后台', labelEn: 'Portal admin' },
  portal_console: { labelZh: '企业控制台', labelEn: 'Portal console' },
};

export function isKnownPermissionKey(key: string): boolean {
  return ALL_PERMISSION_KEYS.has(key);
}

/** Deduped keys or throws Error with unknown list (caller maps to HTTP 400). */
export function validatePermissionKeys(keys: string[]): string[] {
  const unknown = [...new Set(keys.filter((k) => !ALL_PERMISSION_KEYS.has(k)))].sort();
  if (unknown.length) {
    throw new Error(`unknown permission keys: ${unknown.join(', ')}`);
  }
  const seen = new Set<string>();
  const out: string[] = [];
  for (const k of keys) {
    if (!seen.has(k)) {
      seen.add(k);
      out.push(k);
    }
  }
  return out;
}

export interface CatalogGroup {
  category: PermissionCategory;
  labelZh: string;
  labelEn: string;
  items: Array<{
    key: string;
    labelZh: string;
    labelEn: string;
    page?: string;
    pageZh?: string;
    pageEn?: string;
  }>;
}

/** Grouped catalog for chip pickers. */
export function getCatalogGrouped(): CatalogGroup[] {
  const order: PermissionCategory[] = [
    'nav',
    'settings',
    'control',
    'admin',
    'portal_admin',
    'portal_console',
  ];
  return order.map((category) => {
    const labels = CATEGORY_LABELS[category];
    return {
      category,
      labelZh: labels.labelZh,
      labelEn: labels.labelEn,
      items: PERMISSION_CATALOG.filter((d) => d.category === category).map((d) => ({
        key: d.key,
        labelZh: d.labelZh,
        labelEn: d.labelEn,
        page: d.page,
        pageZh: d.pageZh,
        pageEn: d.pageEn,
      })),
    };
  });
}
