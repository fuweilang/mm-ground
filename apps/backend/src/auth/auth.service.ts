import {
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { Response } from 'express';
import { randomUUID } from 'crypto';
import { AccessScope, MemberRole, Prisma, TenantType, User } from '@prisma/client';
import { DEFAULT_AGENT_PERSONA } from '../agent/personas';
import { PrismaService } from '../prisma/prisma.service';
import { SessionMe } from '@mammoth/shared';
import { computeEffectivePermissions } from '../permissions/effective';
import { JwtPayload } from './jwt.guard';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
  ) {}

  private usedBrowserSsoJti = new Set<string>();

  async register(
    input: { name: string; phone: string; password: string; enterpriseName: string; slug: string },
    res: Response,
    ip?: string,
  ) {
    const { user, tenant } = await this.createEnterpriseAccount(input);

    this.setCookie(res, { sub: user.id, tenantId: tenant.id });
    await this.prisma.auditLog.create({
      data: { userId: user.id, tenantId: tenant.id, action: 'register', ip },
    });
    return this.me(user, tenant.id);
  }

  async provisionEnterpriseUser(
    actor: User,
    input: { name: string; phone: string; password: string; enterpriseName: string; slug: string },
  ) {
    if (!actor.isPlatformAdmin) throw new ForbiddenException('仅平台管理员可开户');
    const phone = input.phone.trim();
    const existing = await this.prisma.user.findUnique({ where: { phone } });
    if (existing) {
      const memberships = await this.prisma.orgMember.findMany({
        where: { userId: existing.id },
        orderBy: { createdAt: 'asc' },
      });
      return {
        id: existing.id,
        phone: existing.phone,
        tenantId: memberships[0]?.tenantId ?? null,
        created: false,
      };
    }
    const { user, tenant } = await this.createEnterpriseAccount(input);
    return { id: user.id, phone: user.phone, tenantId: tenant.id, created: true };
  }

  private async createEnterpriseAccount(input: {
    name: string;
    phone: string;
    password: string;
    enterpriseName: string;
    slug: string;
  }) {
    const phone = input.phone.trim();
    const existing = await this.prisma.user.findUnique({ where: { phone } });
    if (existing) throw new ConflictException('手机号已注册');

    const passwordHash = await bcrypt.hash(input.password, 10);
    const slug = input.slug.trim();
    const slugTaken = await this.prisma.tenant.findUnique({ where: { slug } });
    if (slugTaken) throw new ConflictException('品牌已被占用');
    const platform = await this.prisma.tenant.findFirst({ where: { type: TenantType.PLATFORM } });

    return this.prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: { name: input.enterpriseName.trim(), slug, type: TenantType.ENTERPRISE },
      });
      if (platform) {
        await tx.orgTree.create({ data: { parentId: platform.id, childId: tenant.id } });
      }
      const user = await tx.user.create({
        data: {
          name: input.name.trim(),
          phone,
          passwordHash,
        },
      });
      await tx.orgMember.create({
        data: { userId: user.id, tenantId: tenant.id, role: MemberRole.ADMIN },
      });
      await tx.agentRef.create({
        data: {
          tenantId: tenant.id,
          name: '企业助手',
          persona: DEFAULT_AGENT_PERSONA,
          enabled: true,
          visibility: AccessScope.ALL,
        },
      });
      await tx.quota.create({ data: { tenantId: tenant.id } });
      return { user, tenant };
    });
  }

  async login(phone: string, password: string, res: Response, ip?: string) {
    const user = await this.prisma.user.findUnique({ where: { phone } });
    if (!user || user.status !== 'active') throw new UnauthorizedException('账号或密码错误');
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) throw new UnauthorizedException('账号或密码错误');

    const tenants = await this.listTenants(user);
    // 唯一/全部企业被停用的用户：登录成功但没有可用企业上下文（平台账号不受影响）。
    const current = user.isPlatformAdmin ? null : tenants.find((t) => t.status === 'active') ?? null;
    this.setCookie(res, { sub: user.id, tenantId: current?.id ?? null });

    await this.prisma.auditLog.create({
      data: { userId: user.id, tenantId: current?.id, action: 'login', ip },
    });
    return await this.toMe(user, current?.id ?? null, tenants);
  }

  async me(user: User, tenantId: string | null): Promise<SessionMe> {
    const tenants = await this.listTenants(user);
    return await this.toMe(user, tenantId, tenants);
  }

  async switchTenant(user: User, tenantId: string, res: Response) {
    const tenants = await this.listTenants(user);
    const target = tenants.find((t) => t.id === tenantId);
    if (!target && !user.isPlatformAdmin) throw new ForbiddenException('无权切换到该租户');
    let tenant: { status: string; type: TenantType } | null = target ?? null;
    if (user.isPlatformAdmin && !tenant) {
      const found = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
      if (!found) throw new ForbiddenException('租户不存在');
      tenant = found;
    }
    if (tenant && tenant.status !== 'active') throw new ForbiddenException('企业已停用，无法进入');
    // 平台代运营只针对业务租户；猛犸总部（PLATFORM）没有「工作台」语义。
    if (user.isPlatformAdmin && tenant && tenant.type === TenantType.PLATFORM) {
      throw new ForbiddenException('平台租户无需进入工作台');
    }
    this.setCookie(res, { sub: user.id, tenantId });
    await this.prisma.auditLog.create({
      data: { userId: user.id, tenantId, action: 'switch_tenant' },
    });
    return this.me(user, tenantId);
  }

  logout(res: Response) {
    res.clearCookie(this.cookieName(), {
      path: '/',
      sameSite: 'lax',
      secure: this.cookieSecure(),
    });
    return { ok: true };
  }

  issueBrowserSsoTicket(user: User, tenantId: string | null) {
    const jti = randomUUID();
    const ticket = this.jwt.sign(
      { sub: user.id, tenantId, purpose: 'browser-sso', jti },
      { expiresIn: '60s' },
    );
    return {
      ticket,
      next: user.isPlatformAdmin ? '/admin' : '/console/',
    };
  }

  async consumeBrowserSso(ticket: string, res: Response) {
    let payload: JwtPayload;
    try {
      payload = await this.jwt.verifyAsync<JwtPayload>(ticket);
    } catch {
      throw new UnauthorizedException('登录已失效，请重新登录');
    }
    if (payload.purpose !== 'browser-sso' || !payload.jti) {
      throw new UnauthorizedException('登录已失效，请重新登录');
    }
    if (this.usedBrowserSsoJti.has(payload.jti)) {
      throw new UnauthorizedException('登录已失效，请重新登录');
    }
    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || user.status !== 'active') throw new UnauthorizedException('账号不可用');
    this.usedBrowserSsoJti.add(payload.jti);
    const tenantId = await this.resolveSsoTenant(user, payload.tenantId ?? null);
    this.setCookie(res, { sub: user.id, tenantId });
    return this.me(user, tenantId);
  }

  /**
   * 从 Octop 桌面端带过来的 handoff 票据常常不带企业上下文（后端用 Bearer 换票，没有
   * cookie），若直接沿用票据里的 tenantId，企业用户会落到 currentTenant = null，被
   * /console 路由守卫弹回 /agent/chat。这里与 login() 对齐：平台管理员留空进 /admin，
   * 其余用户回落到自己第一个可用企业。
   */
  private async resolveSsoTenant(user: User, tenantId: string | null): Promise<string | null> {
    if (!tenantId && user.isPlatformAdmin) return null;
    const tenants = await this.listTenants(user);
    if (tenantId && tenants.some((t) => t.id === tenantId && t.status === 'active')) {
      return tenantId;
    }
    if (user.isPlatformAdmin) return null;
    return tenants.find((t) => t.status === 'active')?.id ?? null;
  }

  /** 平台管理员退出代运营：清掉当前企业上下文，回到「没有企业」的平台身份。 */
  async exitWorkbench(user: User, tenantId: string | null, res: Response) {
    if (!user.isPlatformAdmin) throw new ForbiddenException('只有平台管理员可以退出业务工作台');
    this.setCookie(res, { sub: user.id, tenantId: null });
    await this.prisma.auditLog.create({
      data: { userId: user.id, tenantId, action: 'exit_workbench' },
    });
    return this.me(user, null);
  }

  private cookieName() {
    return this.config.get<string>('COOKIE_NAME') ?? 'mammothai_access_token';
  }

  private cookieSecure() {
    return (this.config.get<string>('PUBLIC_ORIGIN') ?? '').startsWith('https://');
  }

  private setCookie(res: Response, payload: JwtPayload) {
    const token = this.jwt.sign(payload);
    res.cookie(this.cookieName(), token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: this.cookieSecure(),
      path: '/',
      maxAge: 7 * 24 * 3600 * 1000,
    });
  }

  private async listTenants(user: User) {
    if (user.isPlatformAdmin) {
      const all = await this.prisma.tenant.findMany({ orderBy: { createdAt: 'asc' } });
      const memberships = await this.prisma.orgMember.findMany({ where: { userId: user.id } });
      const roleMap = new Map(memberships.map((m) => [m.tenantId, m.role]));
      return all.map((t) => ({ ...t, role: roleMap.get(t.id) ?? null }));
    }
    const memberships = await this.prisma.orgMember.findMany({
      where: { userId: user.id },
      include: { tenant: true },
      orderBy: { createdAt: 'asc' },
    });
    return memberships.map((m) => ({ ...m.tenant, role: m.role }));
  }

  private async toMe(
    user: User,
    tenantId: string | null,
    tenants: Array<Prisma.TenantGetPayload<object> & { role: MemberRole | null }>,
  ): Promise<SessionMe> {
    const current = tenants.find((t) => t.id === tenantId) ?? null;
    const eff = await computeEffectivePermissions(this.prisma, user.id, tenantId);
    // 总后台身份以角色权限为准（只授 experts 的自建角色不算平台管理员）
    const isPlatformAdmin = eff.isPlatformAdmin;
    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        isPlatformAdmin,
        platformRoleKey: eff.platformRoleKey,
      },
      currentTenant: current
        ? { id: current.id, name: current.name, slug: current.slug, type: current.type, status: current.status }
        : null,
      currentRole: current?.role ?? null,
      tenants: tenants.map((t) => ({
        id: t.id,
        name: t.name,
        slug: t.slug,
        type: t.type,
        status: t.status,
        role: t.role,
      })),
      effectivePermissions: eff.effectivePermissions,
      platformRoleKey: eff.platformRoleKey,
    };
  }
}
