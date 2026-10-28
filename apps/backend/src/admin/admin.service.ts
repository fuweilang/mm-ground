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
import { ADMIN_ACCESS_PERM, computeEffectivePermissions } from '../permissions/effective';
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
    select: { role: true, tenant: { select: { id: true, name: true, status: true } } },
    orderBy: { createdAt: 'asc' },
  },
  roles: {
    select: {
      role: {
        select: { key: true, name: true, scope: true, permissions: { select: { permKey: true } } },
      },
    },
    orderBy: { createdAt: 'asc' as const },
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
    // 企业管理员 = 拥有「企业管理员」角色的成员
    where: { user: { roles: { some: { role: { key: 'org_admin' } } } } },
    select: { user: { select: { id: true, name: true, phone: true } } },
    orderBy: { createdAt: 'asc' as const },
  },
} satisfies Prisma.TenantSelect;

/** 角色是否为「总后台角色」：内置超管/平台管理员，或权限里带 portal.admin.access。 */
type RoleWithPerms = { key: string; permissions?: Array<{ permKey: string }> };
function roleGrantsAdmin(role: RoleWithPerms | null | undefined) {
  if (!role) return false;
  if (role.key === 'super_admin' || role.key === 'platform_admin') return true;
  return (role.permissions ?? []).some((p) => p.permKey === ADMIN_ACCESS_PERM);
}

/** 平台账号只能是这两个内置角色；其它角色（含自建）都是企业内角色。 */
function isPlatformAccountKey(key: string | null | undefined) {
  return key === 'super_admin' || key === 'platform_admin';
}

type UserRow = Prisma.UserGetPayload<{ select: typeof userSelect }>;
type EnterpriseRow = Prisma.TenantGetPayload<{ select: typeof enterpriseSelect }>;

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

  private requirePlatformAdmin(actor: User) {
    if (!actor.isPlatformAdmin) throw new ForbiddenException('仅平台管理员可访问总后台');
  }

  /** 当前账号的全部角色 key。 */
  private async getRoleKeys(userId: string) {
    const rows = await this.prisma.userRole.findMany({
      where: { userId },
      select: { role: { select: { key: true } } },
    });
    return rows.map((row) => row.role.key);
  }

  /** 非超管不得操作（停用/删除/改密）超级管理员。 */
  private async assertCanManageSuperAdmin(actor: User, targetKeys: string[], action: string) {
    if (!targetKeys.includes('super_admin')) return;
    if (!(await this.getRoleKeys(actor.id)).includes('super_admin')) {
      throw new ForbiddenException(`平台管理员不能对超级管理员执行「${action}」操作`);
    }
  }

  /** Public wrapper for other admin controllers (catalog etc.). */
  requirePlatformAdminPublic(actor: User) {
    this.requirePlatformAdmin(actor);
  }

  private async findRoleOrThrow(key: string) {
    const role = await this.prisma.role.findUnique({
      where: { key },
      include: { permissions: { select: { permKey: true } } },
    });
    if (!role) throw new BadRequestException(`角色不存在: ${key}`);
    return role;
  }

  /** 覆盖用户角色（多选，权限取并集）。 */
  private async setUserRoles(
    tx: Prisma.TransactionClient,
    userId: string,
    roles: Array<{ id: string; key: string; permissions: Array<{ permKey: string }> }>,
  ) {
    await tx.userRole.deleteMany({ where: { userId } });
    if (roles.length > 0) {
      await tx.userRole.createMany({
        data: roles.map((role) => ({ userId, roleId: role.id })),
        skipDuplicates: true,
      });
    }
    await tx.user.update({
      where: { id: userId },
      data: { isPlatformAdmin: roles.some((role) => roleGrantsAdmin(role)) },
    });
  }

  /** 成员关系上的历史枚举：只是给控制台列表用的兜底展示。 */
  private membershipRole(roles: Array<{ key: string }>): MemberRole {
    return roles.some((role) => role.key === 'org_admin') ? MemberRole.ADMIN : MemberRole.MEMBER;
  }

  /** 前端传 roleKeys；兼容旧的单个 platformRoleKey。 */
  private resolveRoleKeys(dto: { roleKeys?: string[]; platformRoleKey?: string | null; isPlatformAdmin?: boolean }) {
    if (dto.roleKeys !== undefined) return Array.from(new Set(dto.roleKeys.filter(Boolean)));
    if (dto.platformRoleKey) return [dto.platformRoleKey];
    return dto.isPlatformAdmin ? ['platform_admin'] : [];
  }

  /** 一次取回所有角色（含权限），顺序按传入的 key。 */
  private async loadRoles(keys: string[]) {
    if (keys.length === 0) return [];
    const roles = await this.prisma.role.findMany({
      where: { key: { in: keys } },
      include: { permissions: { select: { permKey: true } } },
    });
    const missing = keys.filter((key) => !roles.some((role) => role.key === key));
    if (missing.length > 0) throw new BadRequestException(`角色不存在: ${missing.join(', ')}`);
    return keys.map((key) => roles.find((role) => role.key === key)!);
  }

  private presentUser(user: UserRow) {
    const roles = user.roles.map((row) => row.role);
    const roleKeys = roles.map((role) => role.key);
    // 平台身份取第一个总后台角色；超级管理员优先
    const platformRole = roles.find((role) => role.key === 'super_admin')
      ?? roles.find((role) => roleGrantsAdmin(role))
      ?? null;
    const platformRoleKey = platformRole?.key ?? null;
    const platformRoleName = platformRole?.name ?? null;
    const platformRoleScope = platformRole?.scope ?? null;
    // 总后台身份由角色权限决定，不能只看 scope（自建角色可能是 PLATFORM 但没有任何总后台权限）
    const isPlatformAdmin = roles.some((role) => roleGrantsAdmin(role));
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
      // 推导状态：所属企业全部被停用的用户，在用户管理里也表现为停用（不改 user.status）。
      blockedByTenant:
        user.memberships.length > 0
        && user.memberships.every((m) => m.tenant.status !== 'active'),
      createdAt: user.createdAt,
      roleKeys,
      roleNames: roles.map((role) => role.name),
      tenants: user.memberships.map((m) => ({
        id: m.tenant.id,
        name: m.tenant.name,
        role: m.role,
      })),
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
    if (query.role === 'none') {
      where.roles = { none: {} };
    } else if (query.role) {
      where.roles = { some: { role: { key: query.role } } };
    }
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
    const roleKeys = this.resolveRoleKeys(dto);
    const roles = await this.loadRoles(roleKeys);
    // 只有全部是超级管理员/平台管理员时才能不绑企业；其余必须选一家企业。
    const platformOnly = roles.length > 0 && roles.every((role) => isPlatformAccountKey(role.key));
    if (!tenantId && !platformOnly) {
      throw new BadRequestException('除超级管理员、平台管理员外，用户必须选择所属企业');
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
          isPlatformAdmin: roles.some((role) => roleGrantsAdmin(role)),
        },
      });
      if (roles.length > 0) await this.setUserRoles(tx, created.id, roles);
      if (tenantId) {
        await tx.orgMember.create({
          data: { userId: created.id, tenantId, role: this.membershipRole(roles) },
        });
      }
      return created;
    });

    await this.prisma.auditLog.create({
      data: {
        userId: actor.id,
        tenantId,
        action: 'admin_create_user',
        meta: { targetUserId: user.id, roleKeys },
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

    const currentKeys = await this.getRoleKeys(id);
    const currentlyPlatform = currentKeys.some((key) => isPlatformAccountKey(key));
    const isSuperAdminTarget = currentKeys.includes('super_admin');
    if (isSuperAdminTarget) {
      if (dto.roleKeys !== undefined && !dto.roleKeys.includes('super_admin')) {
        throw new BadRequestException('超级管理员角色不可变更');
      }
      if (dto.platformRoleKey !== undefined && dto.platformRoleKey !== 'super_admin') {
        throw new BadRequestException('超级管理员角色不可变更');
      }
      if (dto.isPlatformAdmin === false) throw new BadRequestException('超级管理员角色不可变更');
      if (deactivating) await this.assertCanManageSuperAdmin(actor, currentKeys, '停用');
    }

    if (dto.tenantId) {
      const tenant = await this.prisma.tenant.findUnique({ where: { id: dto.tenantId } });
      if (!tenant) throw new NotFoundException('企业不存在');
    }

    const roleChangeRequested = !isSuperAdminTarget && (dto.roleKeys !== undefined || dto.platformRoleKey !== undefined);
    const nextKeys = roleChangeRequested ? this.resolveRoleKeys(dto) : currentKeys;
    const nextRoles = roleChangeRequested ? await this.loadRoles(nextKeys) : [];
    const nextIsPlatformOnly = nextRoles.length > 0 && nextRoles.every((role) => isPlatformAccountKey(role.key));
    const nextHasAdmin = roleChangeRequested
      ? nextRoles.some((role) => roleGrantsAdmin(role))
      : existing.isPlatformAdmin;

    // 除超级管理员、平台管理员外，其余角色都必须挂在一家企业下。
    if (roleChangeRequested && !nextIsPlatformOnly) {
      const boundTenants = dto.tenantId !== undefined
        ? (dto.tenantId ? 1 : 0)
        : await this.prisma.orgMember.count({ where: { userId: id } });
      if (boundTenants < 1) {
        throw new BadRequestException('除超级管理员、平台管理员外，用户必须选择所属企业');
      }
    }

    const demotingPlatform = currentlyPlatform && !nextHasAdmin;
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

    await this.prisma.$transaction(async (tx) => {
      if (Object.keys(data).length > 0) {
        await tx.user.update({ where: { id }, data });
      }
      if (roleChangeRequested) {
        await this.setUserRoles(tx, id, nextRoles);
      }
      if (dto.tenantId !== undefined) {
        if (dto.tenantId === null) {
          await tx.orgMember.deleteMany({ where: { userId: id } });
        } else {
          await tx.orgMember.deleteMany({ where: { userId: id, tenantId: { not: dto.tenantId } } });
          const role = this.membershipRole(nextRoles.length > 0 ? nextRoles : await this.loadRoles(currentKeys));
          await tx.orgMember.upsert({
            where: { userId_tenantId: { userId: id, tenantId: dto.tenantId } },
            update: { role },
            create: { userId: id, tenantId: dto.tenantId, role },
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
          ...(roleChangeRequested ? { roleKeys: nextKeys } : {}),
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

    await this.assertCanManageSuperAdmin(actor, await this.getRoleKeys(id), '修改密码');

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
    await this.assertCanManageSuperAdmin(actor, await this.getRoleKeys(id), '停用');

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
    if ((await this.getRoleKeys(id)).includes('super_admin')) {
      throw new BadRequestException('超级管理员不能删除');
    }

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

    // 只建企业；管理员统一到「用户管理」里开户（手机号、密码、角色都在那边管理）。
    const tenant = await this.prisma.$transaction(async (tx) => {
      const created = await tx.tenant.create({
        data: {
          name: dto.name.trim(),
          slug,
          type: TenantType.ENTERPRISE,
          status: dto.status ?? 'active',
          quota: { create: {} },
        },
      });
      const platform = await tx.tenant.findFirst({ where: { type: TenantType.PLATFORM } });
      if (platform) {
        await tx.orgTree.create({ data: { parentId: platform.id, childId: created.id } });
      }
      return created;
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
    // 猛犸总部（PLATFORM）承载平台账号，不允许停用。
    if (dto.status !== undefined && dto.status !== 'active' && existing.type === TenantType.PLATFORM) {
      throw new ForbiddenException('平台租户不可停用');
    }

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
    _count?: { users: number };
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
      userCount: role._count?.users ?? 0,
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
        _count: { select: { users: true } },
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
        _count: { select: { users: true } },
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
        _count: { select: { users: true } },
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
      include: { _count: { select: { users: true } } },
    });
    if (!role) throw new NotFoundException('角色不存在');
    if (role.builtIn) throw new BadRequestException('系统内置角色不可删除');
    if (role._count.users > 0) {
      throw new BadRequestException(
        `还有 ${role._count.users} 个用户使用该角色，请先解绑后再删除`,
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
    // 角色权限变了，绑定该角色的用户「总后台身份」跟着变。
    if (dto.permissions !== undefined) {
      const fresh = await this.prisma.role.findUnique({
        where: { id },
        include: { permissions: { select: { permKey: true } } },
      });
      const bound = await this.prisma.userRole.findMany({
        where: { roleId: id },
        select: { userId: true },
      });
      for (const row of bound) {
        const keys = await this.getRoleKeys(row.userId);
        const roles = await this.loadRoles(keys);
        await this.prisma.user.update({
          where: { id: row.userId },
          data: { isPlatformAdmin: roles.some((role) => roleGrantsAdmin(role)) },
        });
      }
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