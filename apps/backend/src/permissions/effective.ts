import { MemberRole, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const ORG_PRESET_KEY: Record<MemberRole, string> = {
  // 企业侧只有两档：管理员与成员（OWNER 为历史值，按管理员处理）
  OWNER: 'org_admin',
  ADMIN: 'org_admin',
  MEMBER: 'org_member',
};

/** 拥有该权限 = 可进总后台（/admin）。 */
export const ADMIN_ACCESS_PERM = 'portal.admin.access';

export type EffectiveResult = {
  effectivePermissions: string[];
  platformRoleKey: string | null;
  isPlatformAdmin: boolean;
};

type Db = PrismaService | Prisma.TransactionClient;

/** 用户所有角色的权限并集；企业成员关系不再单独带角色。 */
export async function computeEffectivePermissions(
  db: Db,
  userId: string,
  _tenantId: string | null,
): Promise<EffectiveResult> {
  const rows = await db.userRole.findMany({
    where: { userId },
    select: {
      role: {
        select: {
          key: true,
          scope: true,
          permissions: { select: { permKey: true } },
        },
      },
    },
  });

  const keys = new Set<string>();
  const platformRoles = rows
    .map((row) => row.role)
    .filter((role) => role.scope === 'PLATFORM');

  for (const role of rows.map((row) => row.role)) {
    for (const p of role.permissions) keys.add(p.permKey);
  }

  // 平台身份取超级管理员优先，其次第一个平台角色
  const platformRoleKey = platformRoles.find((role) => role.key === 'super_admin')?.key
    ?? platformRoles[0]?.key
    ?? null;

  return {
    effectivePermissions: [...keys].sort(),
    platformRoleKey,
    // 总后台身份看权限，不看角色 scope：只有授了总后台权限才算平台管理员。
    isPlatformAdmin: keys.has(ADMIN_ACCESS_PERM),
  };
}

export function orgPresetKeyFor(role: MemberRole): string {
  return ORG_PRESET_KEY[role];
}