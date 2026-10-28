import type { MemberRole, TenantType } from '@mammoth/shared';
import { adminHttp } from './http';

export type AdminUserTenant = {
  id: string;
  name: string;
  role: MemberRole;
};

export type AdminUserRow = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  isPlatformAdmin: boolean;
  platformRoleKey?: string | null;
  status: string;
  createdAt: string;
  tenants: AdminUserTenant[];
};

export type AdminEnterpriseRow = {
  id: string;
  name: string;
  slug: string;
  type: TenantType;
  status: string;
  memberCount: number;
  createdAt: string;
};

export type AdminUserCreate = {
  name: string;
  phone: string;
  password: string;
  isPlatformAdmin: boolean;
  tenantId?: string;
  platformRoleKey?: 'super_admin' | 'platform_admin';
};

export type AdminUserUpdate = {
  name?: string;
  isPlatformAdmin?: boolean;
  status?: string;
  password?: string;
  platformRoleKey?: 'super_admin' | 'platform_admin' | null;
};

export type AdminRoleRow = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  scope: 'PLATFORM' | 'ORG_PRESET';
  builtIn: boolean;
  editable: boolean;
  permissionsLocked: boolean;
  permissions: string[];
  userCount: number;
};

export type PermissionCatalogGroup = {
  category: string;
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
};

export type AdminEnterpriseCreate = {
  name: string;
  slug: string;
  status?: string;
};

export type AdminEnterpriseUpdate = {
  name?: string;
  slug?: string;
  status?: string;
};

export const adminUserApi = {
  list: (params: { keyword?: string; role?: '' | 'admin' | 'user'; status?: string } = {}) => {
    const qs = new URLSearchParams();
    if (params.keyword) qs.set('keyword', params.keyword);
    if (params.role) qs.set('role', params.role);
    if (params.status) qs.set('status', params.status);
    const query = qs.toString();
    return adminHttp<AdminUserRow[]>(`/users${query ? `?${query}` : ''}`);
  },
  create: (body: AdminUserCreate) =>
    adminHttp<AdminUserRow>('/users', { method: 'POST', body: JSON.stringify(body) }),
  update: (id: string, body: AdminUserUpdate) =>
    adminHttp<AdminUserRow>(`/users/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deactivate: (id: string) => adminHttp<AdminUserRow>(`/users/${id}`, { method: 'DELETE' }),
  remove: (id: string) => adminHttp<{ ok: boolean }>(`/users/${id}/delete`, { method: 'POST' }),
};

export const adminEnterpriseApi = {
  list: () => adminHttp<AdminEnterpriseRow[]>('/enterprises'),
  create: (body: AdminEnterpriseCreate) =>
    adminHttp<AdminEnterpriseRow>('/enterprises', { method: 'POST', body: JSON.stringify(body) }),
  update: (id: string, body: AdminEnterpriseUpdate) =>
    adminHttp<AdminEnterpriseRow>(`/enterprises/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  remove: (id: string) => adminHttp<{ ok: boolean }>(`/enterprises/${id}`, { method: 'DELETE' }),
};
export const adminRoleApi = {
  list: (params: { keyword?: string } = {}) => {
    const qs = new URLSearchParams();
    if (params.keyword) qs.set('keyword', params.keyword);
    const query = qs.toString();
    return adminHttp<AdminRoleRow[]>(`/roles${query ? `?${query}` : ''}`);
  },
  get: (id: string) => adminHttp<AdminRoleRow>(`/roles/${id}`),
  update: (id: string, body: { name?: string; description?: string | null; permissions?: string[] }) =>
    adminHttp<AdminRoleRow>(`/roles/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
};

export const adminPermissionApi = {
  catalog: () => adminHttp<{ categories: PermissionCatalogGroup[] }>('/permissions/catalog'),
};
