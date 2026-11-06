import 'server-only';
import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  DATABASE_POOLED: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
  APP_SECRET: z
    .string()
    .min(32, 'APP_SECRET must be at least 32 characters')
    .refine((value) => !value.startsWith('replace-me'), 'APP_SECRET is still the example value'),
  PUBLIC_APP_URL: z.url(),
  /** Header your edge sets to the client IP (see server/client-ip.ts). Optional on Vercel. */
  CLIENT_IP_HEADER: z.string().min(1).optional(),
  /** Ed25519 private JWK (JSON) for signing realtime tickets. Without it, realtime is off. */
  REALTIME_PRIVATE_KEY: z.string().min(1).optional(),
  /** Where browsers open realtime sockets, e.g. wss://realtime.example.com */
  REALTIME_URL: z.string().min(1).optional(),
  VERCEL: z.string().optional(),
});

export type ServerEnv = z.infer<typeof envSchema>;

let cached: ServerEnv | undefined;

/** Validated server environment. Parsed on first use so builds don't need secrets. */
export function serverEnv(): ServerEnv {
  if (!cached) {
    const parsed = envSchema.safeParse(process.env);
    if (!parsed.success) {
      throw new Error(`Invalid server environment:\n${z.prettifyError(parsed.error)}`);
    }
    cached = parsed.data;
  }
  return cached;
}
