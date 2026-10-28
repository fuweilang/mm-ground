import type { MemberRole } from '@mammoth/shared';
import { http } from './http';

export type MemberRow = {
  id: string;
  role: MemberRole;
  createdAt: string;
  user: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    status: string;
    /** 用户的全部角色（多角色，权限取并集）。 */
    roles?: Array<{ role: { key: string; name: string } }>;
  };
};

export const tenantApi = {
  members: () => http<MemberRow[]>('/api/members'),
  addMember: (body: { name: string; phone: string; password: string; role: MemberRole }) =>
    http<MemberRow>('/api/members', { method: 'POST', body: JSON.stringify(body) }),
};
