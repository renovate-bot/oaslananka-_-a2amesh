import type { Request } from 'express';
import cors from 'cors';
import type { RegistryServerOptions } from './types.js';

export function createRegistryCorsMiddleware(options: RegistryServerOptions) {
  return cors({
    origin: (origin, callback) => {
      callback(null, origin ? isOriginValueAllowed(options, origin) : true);
    },
  });
}

export function isOriginAllowed(options: RegistryServerOptions, req: Request): boolean {
  const origin = req.header('origin');
  if (!origin) {
    return !options.requireOrigin;
  }

  return isOriginValueAllowed(options, origin);
}

function isOriginValueAllowed(options: RegistryServerOptions, origin: string): boolean {
  const allowedOrigins = options.allowedOrigins ?? [];
  if (allowedOrigins.length === 0) {
    return process.env['NODE_ENV'] !== 'production';
  }

  return allowedOrigins.includes(origin);
}
