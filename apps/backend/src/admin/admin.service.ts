import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { MemberRole, Prisma, TenantType, User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAdminUserDto } from './dto/create-admin-user.dto';
import { UpdateAdminUserDto } from './dto/update-admin-user.dto';
import { ListAdminUsersDto } from './dto/list-admin-users.dto';
import { CreateAdminEnterpriseDto } from './dto/create-admin-enterprise.dto';
import { UpdateAdminEnterpriseDto } from './dto/update-admin-enterprise.dto';
import { validatePermissionKeys } from '../permissions/catalog';
import { computeEffectivePermissions } from '../permissions/effective';
import { ListAdminRolesDto } from './dto/list-admin-roles.dto';
import { CreateAdminRoleDto } from './dto/create-admin-role.dto';
import { UpdateAdminRoleDto } from './dto/update-admin-role.dto';

const userSelect = {
  id: true,
  name: true,
  phone: true,
  email: true,
  isPlatformAdmin: true,
  status: true,
  createdAt: true,
  memberships: {
    select: { role: true, tenant: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'asc' },
  },
  platformRole: {
    select: { role: { select: { key: true, name: true, scope: true } } },
  },
} satisfies Prisma.UserSelect;

const enterpriseSelect = {
  id: true,
  name: true,
  slug: true,
  type: true,
  status: true,
  createdAt: true,
  _count: { select: { members: true } },
  // 企业管理员 = 组织成员中角色为 ADMIN（含历史 OWNER）的用户，可多人
  members: {
    where: { role: { in: [MemberRole.ADMIN, MemberRole.OWNER] } },
    select: { user: { select: { id: true, name: true, phone: true } } },
    orderBy: { createdAt: 'asc' as const },
  },
} satisfies Prisma.TenantSelect;

type UserRow = Prisma.UserGetPayload<{ select: typeof userSelect }>;
type EnterpriseRow = Prisma.TenantGetPayload<{ select: typeof enterpriseSelect }>;

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

  private requirePlatformAdmin(actor: User) {
    if (!actor.isPlatformAdmin) throw new ForbiddenException('仅平台管理员可访问总后台');
  }

  /** 当前账号绑定的平台角色 key（无绑定返回 null）。 */
  private async getPlatformRoleKey(userId: string) {
    const binding = await this.prisma.userPlatformRole.findUnique({
      where: { userId },
      select: { role: { select: { key: true } } },
    });
    return binding?.role.key ?? null;
  }

  /** 非超管不得操作（停用/删除/改密）超级管理员。 */
  private async assertCanManageSuperAdmin(actor: User, targetRoleKey: string | null, action: string) {
    if (targetRoleKey !== 'super_admin') return;
    if ((await this.getPlatformRoleKey(actor.id)) !== 'super_admin') {
      throw new ForbiddenException(`平台管理员不能对超级管理员执行「${action}」操作`);
    }
  }

  /** Public wrapper for other admin controllers (catalog etc.). */
  requirePlatformAdminPublic(actor: User) {
    this.requirePlatformAdmin(actor);
  }

  private presentUser(user: UserRow) {
    const role = user.platformRole?.role ?? null;
    const platformRoleKey = role?.key ?? null;
    const platformRoleName = role?.name ?? null;
    const platformRoleScope = role?.scope ?? null;
    // isPlatformAdmin only when bound role is PLATFORM scope (ORG_PRESET does not count)
    const isPlatformAdmin = platformRoleScope === 'PLATFORM';
    return {
      id: user.id,
      name: user.name,
      phone: user.phone,
      email: user.email,
      isPlatformAdmin,
      platformRoleKey,
      platformRoleName,
      platformRoleScope,
      status: user.status,
      createdAt: user.createdAt,
      tenants: user.memberships.map((m) => ({ id: m.tenant.id, name: m.tenant.name, role: m.role })),
    };
  }

  private presentEnterprise(tenant: EnterpriseRow) {
    const admins = tenant.members.map((member) => member.user);
    return {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      type: tenant.type,
      status: tenant.status,
      createdAt: tenant.createdAt,
      memberCount: tenant._count.members,
      admins,
      adminCount: admins.length,
    };
  }

  private async getUser(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id }, select: userSelect });
    if (!user) throw new NotFoundException('用户不存在');
    return this.presentUser(user);
  }

  private async getEnterprise(id: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id }, select: enterpriseSelect });
    if (!tenant) throw new NotFoundException('企业不存在');
    return this.presentEnterprise(tenant);
  }

  /**
   * Bind any existing Role by key (PLATFORM or ORG_PRESET).
   * Pass roleKey=null to clear. isPlatformAdmin cache = scope === PLATFORM.
   */
  async bindPlatformRole(
    tx: Prisma.TransactionClient,
    userId: string,
    roleKey: string | null,
  ) {
    if (!roleKey) {
      await tx.userPlatformRole.deleteMany({ where: { userId } });
      await tx.user.update({ where: { id: userId }, data: { isPlatformAdmin: false } });
      return;
    }
    const role = await tx.role.findUnique({ where: { key: roleKey } });
    if (!role) {
      throw new BadRequestException(`角色不存在: ${roleKey}`);
    }
    await tx.userPlatformRole.upsert({
      where: { userId },
      update: { roleId: role.id },
      create: { userId, roleId: role.id },
    });
    await tx.user.update({
      where: { id: userId },
      data: { isPlatformAdmin: role.scope === 'PLATFORM' },
    });
  }

  /** Validate perm keys against catalog; throws BadRequestException on unknown. */
  assertKnownPermissionKeys(keys: string[]) {
    try {
      return validatePermissionKeys(keys);
    } catch (e) {
      throw new BadRequestException((e as Error).message);
    }
  }

  async listUsers(actor: User, query: ListAdminUsersDto) {
    this.requirePlatformAdmin(actor);
    const where: Prisma.UserWhereInput = {};
    if (query.keyword?.trim()) {
      const keyword = query.keyword.trim();
      where.OR = [
        { name: { contains: keyword, mode: 'insensitive' } },
        { phone: { contains: keyword } },
      ];
    }
    if (query.role === 'admin') where.isPlatformAdmin = true;
    else if (query.role === 'user') where.isPlatformAdmin = false;
    if (query.status) where.status = query.status;
    if (query.enterpriseId) {
      where.memberships = { some: { tenantId: query.enterpriseId } };
    }

    const users = await this.prisma.user.findMany({
      where,
      select: userSelect,
      orderBy: { createdAt: 'desc' },
    });
    return users.map((user) => this.presentUser(user));
  }

  async createUser(actor: User, dto: CreateAdminUserDto) {
    this.requirePlatformAdmin(actor);
    const phone = dto.phone.trim();
    const existing = await this.prisma.user.findUnique({ where: { phone } });
    if (existing) throw new ConflictException('手机号已存在');

    const tenantId = dto.tenantId ?? null;
    const roleKey = dto.platformRoleKey ?? (dto.isPlatformAdmin ? 'platform_admin' : null);
    let platformSide = false;
    if (roleKey) {
      const role = await this.prisma.role.findUnique({ where: { key: roleKey } });
      if (!role) throw new BadRequestException(`角色不存在: ${roleKey}`);
      platformSide = role.scope === 'PLATFORM';
    }
    // Only PLATFORM-side accounts may skip enterprise; ORG_PRESET / none need a tenant.
    if (!platformSide && !tenantId) {
      throw new BadRequestException('非平台角色用户必须绑定一家企业');
    }
    if (tenantId) {
      const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
      if (!tenant) throw new NotFoundException('企业不存在');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          name: dto.name.trim(),
          phone,
          passwordHash,
          isPlatformAdmin: platformSide,
        },
      });
      if (roleKey) {
        await this.bindPlatformRole(tx, created.id, roleKey);
      }
      if (tenantId) {
        await tx.orgMember.create({
          data: { userId: created.id, tenantId, role: MemberRole.MEMBER },
        });
      }
      return created;
    });

    await this.prisma.auditLog.create({
      data: {
        userId: actor.id,
        tenantId,
        action: 'admin_create_user',
        meta: { targetUserId: user.id, isPlatformAdmin: platformSide, platformRoleKey: roleKey },
      },
    });
    return this.getUser(user.id);
  }

  async updateUser(actor: User, id: string, dto: UpdateAdminUserDto) {
    this.requirePlatformAdmin(actor);
    const existing = await this.prisma.user.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('用户不存在');

    const deactivating = dto.status !== undefined && dto.status !== 'active';
    if (actor.id === id && deactivating) throw new BadRequestException('不能停用自己');

    const currentRole = await this.prisma.userPlatformRole.findUnique({
      where: { userId: id },
      select: { role: { select: { key: true, scope: true } } },
    });
    const currentKey = currentRole?.role.key ?? null;
    const currentlyPlatform = currentRole?.role.scope === 'PLATFORM' || existing.isPlatformAdmin;

    // super_admin role is fixed: ignore/reject platformRoleKey / isPlatformAdmin demotion attempts
    const isSuperAdminTarget = currentKey === 'super_admin';
    if (isSuperAdminTarget) {
      if (
        (dto.platformRoleKey !== undefined && dto.platformRoleKey !== 'super_admin')
        || dto.isPlatformAdmin === false
      ) {
        throw new BadRequestException('超级管理员角色不可变更');
      }
      if (deactivating) await this.assertCanManageSuperAdmin(actor, currentKey, '停用');
    }

    if (dto.tenantId) {
      const tenant = await this.prisma.tenant.findUnique({ where: { id: dto.tenantId } });
      if (!tenant) throw new NotFoundException('企业不存在');
    }

    // Resolve next role binding (null = clear; string = bind; undefined = no change)
    let nextRoleKey: string | null | undefined = undefined;
    if (!isSuperAdminTarget) {
      if (dto.platformRoleKey === null) {
        nextRoleKey = null;
      } else if (typeof dto.platformRoleKey === 'string') {
        nextRoleKey = dto.platformRoleKey;
      } else if (dto.isPlatformAdmin === false) {
        nextRoleKey = null;
      } else if (dto.isPlatformAdmin === true && !currentlyPlatform) {
        nextRoleKey = 'platform_admin';
      }
    }

    let nextIsPlatformAdmin = currentlyPlatform;
    if (nextRoleKey === null) {
      nextIsPlatformAdmin = false;
    } else if (typeof nextRoleKey === 'string') {
      const nextRole = await this.prisma.role.findUnique({ where: { key: nextRoleKey } });
      if (!nextRole) throw new BadRequestException(`角色不存在: ${nextRoleKey}`);
      nextIsPlatformAdmin = nextRole.scope === 'PLATFORM';
    }

    const demotingPlatform = currentlyPlatform && !nextIsPlatformAdmin;
    if (actor.id === id && demotingPlatform) {
      throw new BadRequestException('不能取消自己的平台管理员身份');
    }
    if (currentlyPlatform && (demotingPlatform || deactivating)) {
      const otherActiveAdmins = await this.prisma.user.count({
        where: { isPlatformAdmin: true, status: 'active', id: { not: id } },
      });
      if (otherActiveAdmins < 1) {
        throw new BadRequestException('需保留至少一名可用状态的平台管理员，请先增配其他管理员');
      }
    }

    const data: Prisma.UserUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name.trim();
    if (dto.status !== undefined) data.status = dto.status;
    // isPlatformAdmin is owned by bindPlatformRole; only set when no role change
    if (nextRoleKey === undefined && dto.isPlatformAdmin !== undefined && !isSuperAdminTarget) {
      data.isPlatformAdmin = dto.isPlatformAdmin;
    }

    await this.prisma.$transaction(async (tx) => {
      if (Object.keys(data).length > 0) {
        await tx.user.update({ where: { id }, data });
      }
      if (nextRoleKey !== undefined) {
        await this.bindPlatformRole(tx, id, nextRoleKey);
      }
      if (dto.tenantId !== undefined) {
        if (dto.tenantId === null) {
          await tx.orgMember.deleteMany({ where: { userId: id } });
        } else {
          await tx.orgMember.deleteMany({ where: { userId: id, tenantId: { not: dto.tenantId } } });
          await tx.orgMember.upsert({
            where: { userId_tenantId: { userId: id, tenantId: dto.tenantId } },
            update: {},
            create: { userId: id, tenantId: dto.tenantId, role: MemberRole.MEMBER },
          });
        }
      }
    });
    await this.prisma.auditLog.create({
      data: {
        userId: actor.id,
        action: 'admin_update_user',
        meta: {
          targetUserId: id,
          ...(dto.tenantId !== undefined ? { tenantId: dto.tenantId } : {}),
        },
      },
    });
    return this.getUser(id);
  }

  async changePassword(actor: User, id: string, password: string) {
    this.requirePlatformAdmin(actor);
    const existing = await this.prisma.user.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('用户不存在');

    const targetRole = await this.prisma.userPlatformRole.findUnique({
      where: { userId: id },
      select: { role: { select: { key: true } } },
    });
    await this.assertCanManageSuperAdmin(actor, targetRole?.role.key ?? null, '修改密码');

    const passwordHash = await bcrypt.hash(password, 10);
    await this.prisma.user.update({ where: { id }, data: { passwordHash } });
    await this.prisma.auditLog.create({
      data: { userId: actor.id, action: 'admin_change_user_password', meta: { targetUserId: id } },
    });
    return this.getUser(id);
  }

  async deactivateUser(actor: User, id: string) {
    this.requirePlatformAdmin(actor);
    if (actor.id === id) throw new BadRequestException('不能停用自己');
    const existing = await this.prisma.user.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('用户不存在');
    await this.assertCanManageSuperAdmin(actor, await this.getPlatformRoleKey(id), '停用');

    await this.prisma.user.update({ where: { id }, data: { status: 'inactive' } });
    await this.prisma.auditLog.create({
      data: { userId: actor.id, action: 'admin_deactivate_user', meta: { targetUserId: id } },
    });
    return this.getUser(id);
  }

  async deleteUser(actor: User, id: string) {
    this.requirePlatformAdmin(actor);
    if (actor.id === id) throw new BadRequestException('不能删除自己');
    const existing = await this.prisma.user.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('用户不存在');
    if (existing.isPlatformAdmin) throw new BadRequestException('平台管理员不能删除');

    await this.prisma.user.delete({ where: { id } });
    await this.prisma.auditLog.create({
      data: {
        userId: actor.id,
        action: 'admin_delete_user',
        meta: { targetUserId: id, name: existing.name, phone: existing.phone },
      },
    });
    return { ok: true };
  }

  async listEnterprises(actor: User) {
    this.requirePlatformAdmin(actor);
    const tenants = await this.prisma.tenant.findMany({
      select: enterpriseSelect,
      orderBy: { createdAt: 'asc' },
    });
    return tenants.map((tenant) => this.presentEnterprise(tenant));
  }

  async createEnterprise(actor: User, dto: CreateAdminEnterpriseDto) {
    this.requirePlatformAdmin(actor);
    const slug = dto.slug.trim();
    const existing = await this.prisma.tenant.findUnique({ where: { slug } });
    if (existing) throw new ConflictException('品牌已存在');

    const tenant = await this.prisma.tenant.create({
      data: {
        name: dto.name.trim(),
        slug,
        type: TenantType.ENTERPRISE,
        status: dto.status ?? 'active',
        quota: { create: {} },
      },
    });
    await this.prisma.auditLog.create({
      data: {
        userId: actor.id,
        tenantId: tenant.id,
        action: 'admin_create_enterprise',
        meta: { slug },
      },
    });
    return this.getEnterprise(tenant.id);
  }

  async updateEnterprise(actor: User, id: string, dto: UpdateAdminEnterpriseDto) {
    this.requirePlatformAdmin(actor);
    const existing = await this.prisma.tenant.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('企业不存在');

    const data: Prisma.TenantUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name.trim();
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.slug !== undefined && dto.slug.trim() !== existing.slug) {
      const slug = dto.slug.trim();
      const dup = await this.prisma.tenant.findUnique({ where: { slug } });
      if (dup) throw new ConflictException('品牌已存在');
      data.slug = slug;
    }

    if (Object.keys(data).length > 0) {
      await this.prisma.tenant.update({ where: { id }, data });
    }
    await this.prisma.auditLog.create({
      data: { userId: actor.id, tenantId: id, action: 'admin_update_enterprise' },
    });
    return this.getEnterprise(id);
  }

  async getEnterpriseDeletionImpact(actor: User, id: string) {
    this.requirePlatformAdmin(actor);
    return this.computeEnterpriseDeletionImpact(actor, id);
  }

  private async computeEnterpriseDeletionImpact(actor: User, id: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
      include: {
        agents: { select: { name: true } },
        _count: {
          select: {
            children: true,
            kbFolders: true,
            kbDocuments: true,
            usageEvents: true,
          },
        },
      },
    });
    if (!tenant) throw new NotFoundException('企业不存在');
    if (tenant.type === TenantType.PLATFORM) throw new BadRequestException('总部不可删除');

    const members = await this.prisma.orgMember.findMany({
      where: { tenantId: id },
      select: {
        user: {
          select: {
            id: true,
            name: true,
            phone: true,
            isPlatformAdmin: true,
            memberships: { select: { tenantId: true } },
          },
        },
      },
    });
    const removable = members
      .map((member) => member.user)
      .filter((user) =>
        user.id !== actor.id
        && !user.isPlatformAdmin
        && user.memberships.length === 1,
      );

    const customAgents = tenant.agents.filter((agent) => agent.name !== '企业助手');
    const blockedReasons: string[] = [];
    if (tenant._count.children > 0) blockedReasons.push(`有 ${tenant._count.children} 个子企业`);
    if (customAgents.length > 0) blockedReasons.push(`有 ${customAgents.length} 个自定义智能体`);
    if (tenant._count.kbFolders > 0) blockedReasons.push(`有 ${tenant._count.kbFolders} 个知识库目录`);
    if (tenant._count.kbDocuments > 0) blockedReasons.push(`有 ${tenant._count.kbDocuments} 篇知识库文档`);

    return {
      tenant: { id: tenant.id, name: tenant.name, slug: tenant.slug },
      memberCount: members.length,
      deletedUsers: removable.map((user) => ({ id: user.id, name: user.name, phone: user.phone })),
      unboundMemberCount: members.length - removable.length,
      usageEventCount: tenant._count.usageEvents,
      blockedReasons,
      canDelete: blockedReasons.length === 0,
    };
  }

  async deleteEnterprise(actor: User, id: string) {
    this.requirePlatformAdmin(actor);
    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
      include: {
        agents: { select: { name: true } },
        _count: {
          select: {
            children: true,
            kbFolders: true,
            kbDocuments: true,
            usageEvents: true,
          },
        },
      },
    });
    if (!tenant) throw new NotFoundException('企业不存在');
    if (tenant.type === TenantType.PLATFORM) throw new BadRequestException('总部不可删除');
    if (this.hasEnterpriseBusinessData(tenant)) {
      throw new BadRequestException('有数据，不能删除');
    }

    const impact = await this.computeEnterpriseDeletionImpact(actor, id);
    const removableUserIds = impact.deletedUsers.map((user) => user.id);

    await this.prisma.$transaction(async (tx) => {
      if (removableUserIds.length > 0) {
        await tx.user.deleteMany({ where: { id: { in: removableUserIds } } });
      }
      await tx.tenant.delete({ where: { id } });
    });
    await this.prisma.auditLog.create({
      data: {
        userId: actor.id,
        action: 'admin_delete_enterprise',
        meta: { slug: tenant.slug, deletedUserIds: removableUserIds },
      },
    });
    return { ok: true };
  }


  private async actorHasRolesWrite(actor: User) {
    const eff = await computeEffectivePermissions(this.prisma, actor.id, null);
    if (eff.effectivePermissions.includes('portal.admin.roles.write')) return true;
    // Fallback: legacy super flag without role row yet
    return actor.isPlatformAdmin && eff.platformRoleKey === 'super_admin';
  }

  private presentRole(role: {
    id: string;
    key: string;
    name: string;
    description: string | null;
    scope: string;
    builtIn: boolean;
    editable: boolean;
    permissions: Array<{ permKey: string }>;
    _count?: { platformUsers: number };
  }) {
    const permissions = role.permissions.map((p) => p.permKey).sort();
    return {
      id: role.id,
      key: role.key,
      name: role.name,
      description: role.description,
      scope: role.scope,
      builtIn: role.builtIn,
      editable: role.editable,
      permissionsLocked: role.key === 'super_admin',
      permissions,
      userCount: role._count?.platformUsers ?? 0,
    };
  }

  async listRoles(actor: User, query: ListAdminRolesDto) {
    this.requirePlatformAdmin(actor);
    const where: Prisma.RoleWhereInput = {};
    if (query.keyword?.trim()) {
      const keyword = query.keyword.trim();
      where.OR = [
        { name: { contains: keyword, mode: 'insensitive' } },
        { key: { contains: keyword, mode: 'insensitive' } },
      ];
    }
    const roles = await this.prisma.role.findMany({
      where,
      include: {
        permissions: { select: { permKey: true } },
        _count: { select: { platformUsers: true } },
      },
      orderBy: [{ scope: 'asc' }, { key: 'asc' }],
    });
    return roles.map((r) => this.presentRole(r));
  }

  async getRole(actor: User, id: string) {
    this.requirePlatformAdmin(actor);
    const role = await this.prisma.role.findUnique({
      where: { id },
      include: {
        permissions: { select: { permKey: true } },
        _count: { select: { platformUsers: true } },
      },
    });
    if (!role) throw new NotFoundException('角色不存在');
    return this.presentRole(role);
  }

  async createRole(actor: User, dto: CreateAdminRoleDto) {
    this.requirePlatformAdmin(actor);
    if (!(await this.actorHasRolesWrite(actor))) {
      throw new ForbiddenException('无角色编辑权限');
    }
    const name = dto.name.trim();
    if (!name) throw new BadRequestException('角色名称不能为空');

    const duplicated = await this.prisma.role.findFirst({
      where: { name, scope: 'PLATFORM' },
      select: { id: true },
    });
    if (duplicated) throw new BadRequestException('角色名称已存在');

    const permissions = this.assertKnownPermissionKeys(dto.permissions ?? []);
    const key = this.nextCustomRoleKey();
    const role = await this.prisma.role.create({
      data: {
        key,
        name,
        description: dto.description?.trim() || null,
        scope: 'PLATFORM',
        builtIn: false,
        editable: true,
        permissions: {
          create: permissions.map((permKey) => ({ permKey })),
        },
      },
      include: {
        permissions: { select: { permKey: true } },
        _count: { select: { platformUsers: true } },
      },
    });

    await this.prisma.auditLog.create({
      data: {
        userId: actor.id,
        action: 'admin_create_role',
        meta: { roleId: role.id, key: role.key, permissions },
      },
    });
    return this.presentRole(role);
  }

  async deleteRole(actor: User, id: string) {
    this.requirePlatformAdmin(actor);
    if (!(await this.actorHasRolesWrite(actor))) {
      throw new ForbiddenException('无角色编辑权限');
    }
    const role = await this.prisma.role.findUnique({
      where: { id },
      include: { _count: { select: { platformUsers: true } } },
    });
    if (!role) throw new NotFoundException('角色不存在');
    if (role.builtIn) throw new BadRequestException('系统内置角色不可删除');
    if (role._count.platformUsers > 0) {
      throw new BadRequestException(
        `还有 ${role._count.platformUsers} 个用户使用该角色，请先解绑后再删除`,
      );
    }

    await this.prisma.role.delete({ where: { id } });
    await this.prisma.auditLog.create({
      data: {
        userId: actor.id,
        action: 'admin_delete_role',
        meta: { roleId: id, key: role.key, name: role.name },
      },
    });
    return { ok: true };
  }

  private nextCustomRoleKey() {
    const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    return `custom_${suffix}`;
  }

  async updateRole(actor: User, id: string, dto: UpdateAdminRoleDto) {
    this.requirePlatformAdmin(actor);
    if (!(await this.actorHasRolesWrite(actor))) {
      throw new ForbiddenException('无角色编辑权限');
    }
    const role = await this.prisma.role.findUnique({
      where: { id },
      include: { permissions: { select: { id: true, permKey: true } } },
    });
    if (!role) throw new NotFoundException('角色不存在');
    // 超级管理员权限固定为全量，任何编辑一律拒绝；其余角色（含企业预设）可编辑。
    if (role.key === 'super_admin') {
      throw new ForbiddenException('超级管理员拥有全部权限，不可编辑');
    }

    const data: Prisma.RoleUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name.trim();
    if (dto.description !== undefined) {
      data.description = dto.description === null ? null : dto.description.trim();
    }

    if (dto.permissions !== undefined) {
      const keys = this.assertKnownPermissionKeys(dto.permissions);
      await this.replaceRolePermissions(role.id, keys);
    }

    if (Object.keys(data).length > 0) {
      await this.prisma.role.update({ where: { id }, data });
    }

    await this.prisma.auditLog.create({
      data: {
        userId: actor.id,
        action: 'admin_update_role',
        meta: { roleId: id, key: role.key },
      },
    });
    return this.getRole(actor, id);
  }

  private async replaceRolePermissions(roleId: string, keys: string[]) {
    const existing = await this.prisma.rolePermission.findMany({
      where: { roleId },
      select: { id: true, permKey: true },
    });
    const want = new Set(keys);
    const have = new Set(existing.map((e) => e.permKey));
    const toDelete = existing.filter((e) => !want.has(e.permKey)).map((e) => e.id);
    if (toDelete.length) {
      await this.prisma.rolePermission.deleteMany({ where: { id: { in: toDelete } } });
    }
    const toAdd = keys.filter((k) => !have.has(k));
    if (toAdd.length) {
      await this.prisma.rolePermission.createMany({
        data: toAdd.map((permKey) => ({ roleId, permKey })),
        skipDuplicates: true,
      });
    }
  }

  /** 子企业/自定义智能体/知识库属于真实业务资产，仍拦截删除；用量日志随租户一并清理。 */
  private hasEnterpriseBusinessData(tenant: {
    agents: Array<{ name: string }>;
    _count: {
      children: number;
      kbFolders: number;
      kbDocuments: number;
    };
  }) {
    const customAgents = tenant.agents.filter((agent) => agent.name !== '企业助手');
    return tenant._count.children > 0
      || customAgents.length > 0
      || tenant._count.kbFolders > 0
      || tenant._count.kbDocuments > 0;
  }
}