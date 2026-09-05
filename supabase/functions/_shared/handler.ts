import { corsHeaders } from './cors.ts';
import { userClient } from './client.ts';
import { ok, fail } from './respond.ts';
import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2';

export interface Ctx {
  db: SupabaseClient;
  userId: string;
  aal: string;
  body: Record<string, unknown>;
  req: Request;
}

export interface Options {
  name: string;
  anonymous?: boolean;
  rateLimit?: number;
}

export function serveEndpoint(opts: Options, run: (ctx: Ctx) => Promise<unknown>): void {
  Deno.serve(async (req: Request) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
    if (req.method !== 'POST') return fail('METHOD_NOT_ALLOWED: يُسمح بـ POST فقط', 405);
    try {
      const db = userClient(req);
      let userId = '';
      let aal = 'aal1';
      if (!opts.anonymous) {
        const { data: { user }, error } = await db.auth.getUser();
        if (error || !user) return fail('UNAUTHENTICATED');
        userId = user.id;
        const { data: aalData } = await db.auth.mfa.getAuthenticatorAssuranceLevel();
        aal = aalData?.currentLevel ?? 'aal1';
      }
      if (opts.rateLimit) {
        const { data: allowed } = await db.rpc('op_rate_limit', {
          p_endpoint: opts.name, p_max: opts.rateLimit,
        });
        if (allowed === false) return fail('RATE_LIMITED');
      }
      let body: Record<string, unknown> = {};
      try { body = await req.json(); } catch { body = {}; }
      const result = await run({ db, userId, aal, body, req });
      return ok(result);
    } catch (e) {
      return fail(e);
    }
  });
}

export async function rpc(db: SupabaseClient, fn: string, args: Record<string, unknown> = {}) {
  const { data, error } = await db.rpc(fn, args);
  if (error) throw new Error(error.message);
  return data;
}
