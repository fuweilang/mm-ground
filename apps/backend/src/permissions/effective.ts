import { MemberRole, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const ORG_PRESET_KEY: Record<MemberRole, string> = {
  // 企业侧只有两档：管理员与成员（OWNER 为历史值，按管理员处理）
  OWNER: 'org_admin',
  ADMIN: 'org_admin',
  MEMBER: 'org_member',
};

export type EffectiveResult = {
  effectivePermissions: string[];
  platformRoleKey: string | null;
  isPlatformAdmin: boolean;
};

type Db = PrismaService | Prisma.TransactionClient;

/** platform RolePermission ∪ current-tenant org preset (union; no tenant → platform only). */
export async function computeEffectivePermissions(
  db: Db,
  userId: string,
  tenantId: string | null,
): Promise<EffectiveResult> {
  const platform = await db.userPlatformRole.findUnique({
    where: { userId },
    include: {
      role: { include: { permissions: { select: { permKey: true } } } },
    },
  });

  const keys = new Set<string>();
  let platformRoleKey: string | null = null;

  if (platform?.role?.scope === 'PLATFORM') {
    platformRoleKey = platform.role.key;
    for (const p of platform.role.permissions) keys.add(p.permKey);
  }

  if (tenantId) {
    const membership = await db.orgMember.findUnique({
      where: { userId_tenantId: { userId, tenantId } },
      select: { role: true },
    });
    if (membership) {
      const presetKey = ORG_PRESET_KEY[membership.role];
      const preset = await db.role.findUnique({
        where: { key: presetKey },
        include: { permissions: { select: { permKey: true } } },
      });
      if (preset) {
        for (const p of preset.permissions) keys.add(p.permKey);
      }
    }
  }

  return {
    effectivePermissions: [...keys].sort(),
    platformRoleKey,
    isPlatformAdmin: platformRoleKey != null,
  };
}

export function orgPresetKeyFor(role: MemberRole): string {
  return ORG_PRESET_KEY[role];
}
