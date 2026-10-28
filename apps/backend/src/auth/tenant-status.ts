import type { PrismaService } from '../prisma/prisma.service';

/**
 * 停用企业 = 该企业的上下文不可用（成员进不了 console/agent），但不动成员账号本身。
 * 平台账号不受此限制；无租户上下文（tenantId=null）也不受限。
 */
export async function tenantActive(
  prisma: PrismaService,
  tenantId: string | null | undefined,
): Promise<boolean> {
  if (!tenantId) return true;
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { status: true },
  });
  return tenant?.status === 'active';
}
