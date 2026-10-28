import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

type AuthedRequest = Request & {
  user?: { id?: string; phone?: string; name?: string; username?: string };
};

/**
 * Compact access log for multi-user / LAN debugging.
 * Includes client IP (X-Forwarded-For / X-Real-IP when present) and user id
 * when JwtGuard (or similar) attached ``req.user``. Never logs Authorization
 * headers, cookies, or password bodies.
 */
@Injectable()
export class RequestLoggingMiddleware implements NestMiddleware {
  private readonly log = new Logger('HTTP');

  use(req: AuthedRequest, res: Response, next: NextFunction): void {
    const started = Date.now();
    res.on('finish', () => {
      const path = req.originalUrl || req.url || '';
      const interesting =
        path.includes('/auth') ||
        path.includes('/oidc') ||
        path.includes('/admin') ||
        path.includes('/health') ||
        res.statusCode >= 400;
      if (!interesting && res.statusCode < 400) {
        // Still log every request at log level for IP debugging in multi-user LAN.
      }
      const durationMs = Date.now() - started;
      const ip = clientIp(req);
      const user = userLabel(req);
      const line = `method=${req.method} path=${path} status=${res.statusCode} duration_ms=${durationMs} ip=${ip} user=${user}`;
      if (res.statusCode >= 500) this.log.error(line);
      else if (res.statusCode >= 400) this.log.warn(line);
      else this.log.log(line);
    });
    next();
  }
}

function clientIp(req: Request): string {
  const forwarded = String(req.headers['x-forwarded-for'] ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (forwarded.length > 0) return forwarded[0]!;
  const real = String(req.headers['x-real-ip'] ?? '').trim();
  if (real) return real;
  return req.ip || req.socket.remoteAddress || 'unknown';
}

function userLabel(req: AuthedRequest): string {
  const user = req.user;
  if (!user) return '-';
  const id = user.id ?? '';
  const name = user.username || user.phone || user.name || '';
  if (id && name) return `${id}/${name}`;
  if (id) return String(id);
  if (name) return String(name);
  return '-';
}
