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
  p('knowledge_bases', 'settings', '知识库', 'Knowledge Base', {
    page: 'knowledge-bases',
    pageZh: '知识库',
    pageEn: 'Knowledge Base',
  }),

  p('terminal', 'control', '工作台/终端', 'Workbench / Terminal', {
    page: 'workbench',
    pageZh: '工作台',
    pageEn: 'Workbench',
  }),
  p('browser', 'control', '工作台/浏览器', 'Workbench / Browser', {
    page: 'workbench',
    pageZh: '工作台',
    pageEn: 'Workbench',
  }),
  p('desktop', 'control', '远程桌面', 'Remote Desktop', {
    page: 'remote-desktop',
    pageZh: '远程桌面',
    pageEn: 'Remote Desktop',
  }),
  p('mobile', 'control', '远程手机', 'Remote Phone', {
    page: 'remote-desktop',
    pageZh: '远程桌面',
    pageEn: 'Remote Desktop',
  }),

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
  p('storage_backends', 'admin', '存储', 'Storage', {
    page: 'storage',
    pageZh: '存储',
    pageEn: 'Storage',
  }),
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
    page: 'knowledge-bases',
    pageZh: '知识库',
    pageEn: 'Knowledge Base',
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
  // 企业侧只保留「企业管理员 / 企业成员」两档：管理员=原 owner 全量能力
  org_admin: uniqSorted([
    ...OWNER_OCTOP_KEYS,
    ...BUSINESS_MODULE_KEYS,
    ...PORTAL_CONSOLE_KEYS,
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
    description: '系统最高权限：平台后台全部功能，可管理所有企业、用户和角色。建议只给 1–2 位负责人。',
    scope: 'PLATFORM',
    editable: false,
  },
  platform_admin: {
    name: '平台管理员',
    description: '平台运营：可管理企业和用户，也能使用业务功能；不能修改角色权限，不能进入企业后台。',
    scope: 'PLATFORM',
    editable: true,
  },
  org_admin: {
    name: '企业管理员',
    description: '企业管理员：企业后台和业务功能全部可用，可管理成员、企业设置与用量。',
    scope: 'ORG_PRESET',
    editable: false,
  },
  org_member: {
    name: '企业成员',
    description: '普通员工：可使用智能体、知识库等业务功能并修改个人设置，不能管理成员或企业配置。',
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

export interface CatalogChipItem {
  key: string;
  labelZh: string;
  labelEn: string;
  page?: string;
  pageZh?: string;
  pageEn?: string;
}

export interface CatalogPageBlock {
  /** null = flat chips under the category (no page subtitle) */
  page: string | null;
  pageZh: string;
  pageEn: string;
  items: CatalogChipItem[];
}

export interface CatalogGroup {
  category: PermissionCategory;
  labelZh: string;
  labelEn: string;
  /** Flat list (compat); same keys as pages flattened. */
  items: CatalogChipItem[];
  /** Octop-aligned page blocks for chip pickers. */
  pages: CatalogPageBlock[];
}

/**
 * Display layout aligned with Octop PermissionCheckboxPicker:
 * category → optional page subtitle → chips.
 * `knowledge_settings` sits with `knowledge_bases` under 知识库 (settings),
 * even though its catalog category remains `admin` for baseline packs.
 */
const PICKER_LAYOUT: readonly {
  category: PermissionCategory;
  pages: readonly { page: string | null; pageZh: string; pageEn: string; keys: readonly string[] }[];
}[] = [
  {
    category: 'nav',
    pages: [{ page: null, pageZh: '', pageEn: '', keys: ['experts', 'tasks', 'token_usage'] }],
  },
  {
    category: 'settings',
    pages: [
      {
        page: 'personalization',
        pageZh: '个性化',
        pageEn: 'Personalization',
        keys: ['skills', 'subagents', 'tools', 'agent_plugins', 'mbti', 'memory'],
      },
      { page: null, pageZh: '', pageEn: '', keys: ['channels', 'connectors', 'skill_packages'] },
      {
        page: 'knowledge-bases',
        pageZh: '知识库',
        pageEn: 'Knowledge Base',
        keys: ['knowledge_bases', 'knowledge_settings'],
      },
    ],
  },
  {
    category: 'control',
    pages: [
      {
        page: 'workbench',
        pageZh: '工作台',
        pageEn: 'Workbench',
        keys: ['terminal', 'browser'],
      },
      {
        page: 'remote-desktop',
        pageZh: '远程桌面',
        pageEn: 'Remote Desktop',
        keys: ['desktop', 'mobile'],
      },
    ],
  },
  {
    category: 'admin',
    pages: [
      { page: 'users', pageZh: '用户', pageEn: 'Users', keys: ['users', 'sso'] },
      {
        page: 'models',
        pageZh: '模型',
        pageEn: 'Models',
        keys: ['providers', 'ollama_models', 'onnx_models', 'search', 'voice'],
      },
      { page: 'storage', pageZh: '存储', pageEn: 'Storage', keys: ['storage_backends'] },
      { page: 'plugins', pageZh: '插件', pageEn: 'Plugins', keys: ['plugins'] },
      {
        page: 'security',
        pageZh: '安全防护',
        pageEn: 'Security',
        keys: ['security', 'admin_console'],
      },
      {
        page: 'advanced',
        pageZh: '应用设置',
        pageEn: 'App settings',
        keys: ['envs', 'observability', 'backup', 'tls', 'captcha', 'update'],
      },
    ],
  },
  {
    category: 'portal_admin',
    pages: [
      {
        page: null,
        pageZh: '',
        pageEn: '',
        keys: [
          'portal.admin.access',
          'portal.admin.users',
          'portal.admin.enterprises',
          'portal.admin.roles.read',
          'portal.admin.roles.write',
        ],
      },
    ],
  },
  {
    category: 'portal_console',
    pages: [
      {
        page: null,
        pageZh: '',
        pageEn: '',
        keys: [
          'portal.console.access',
          'portal.console.members',
          'portal.console.settings',
        ],
      },
    ],
  },
];

function chipFromDef(d: PermissionDef): CatalogChipItem {
  return {
    key: d.key,
    labelZh: d.labelZh,
    labelEn: d.labelEn,
    page: d.page,
    pageZh: d.pageZh,
    pageEn: d.pageEn,
  };
}

/** Grouped catalog for chip pickers (Octop page taxonomy). */
export function getCatalogGrouped(): CatalogGroup[] {
  const byKey = new Map(PERMISSION_CATALOG.map((d) => [d.key, d]));
  const covered = new Set<string>();
  const groups: CatalogGroup[] = [];

  for (const section of PICKER_LAYOUT) {
    const labels = CATEGORY_LABELS[section.category];
    const pages: CatalogPageBlock[] = [];
    const items: CatalogChipItem[] = [];
    for (const block of section.pages) {
      const blockItems: CatalogChipItem[] = [];
      for (const key of block.keys) {
        const def = byKey.get(key);
        if (!def) continue;
        covered.add(key);
        const chip = chipFromDef(def);
        blockItems.push(chip);
        items.push(chip);
      }
      if (blockItems.length) {
        pages.push({
          page: block.page,
          pageZh: block.pageZh,
          pageEn: block.pageEn,
          items: blockItems,
        });
      }
    }
    if (items.length) {
      groups.push({
        category: section.category,
        labelZh: labels.labelZh,
        labelEn: labels.labelEn,
        items,
        pages,
      });
    }
  }

  const orphans = PERMISSION_CATALOG.filter((d) => !covered.has(d.key)).map(chipFromDef);
  if (orphans.length) {
    groups.push({
      category: 'admin',
      labelZh: '其他',
      labelEn: 'Other',
      items: orphans,
      pages: [{ page: null, pageZh: '', pageEn: '', items: orphans }],
    });
  }
  return groups;
}
