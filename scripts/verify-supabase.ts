/**
 * Supabase connectivity check for NationLinks Dispatch.
 *
 * Verifies, in order:
 *   1. Required environment variables are present and non-placeholder.
 *   2. The Supabase REST API answers with the anon and service-role keys.
 *   3. The `drivers` / `payments` tables exist and are queryable.
 *   4. Prisma can reach the database over DATABASE_URL.
 *
 * Run with: npm run db:verify
 */
import { createClient } from '@supabase/supabase-js';

const PLACEHOLDER = /\[(YOUR_DB_PASSWORD|REGION|PROJECT_REF|YOUR_PASSWORD)\]|your-supabase-/i;

let failures = 0;

function pass(label: string, detail = '') {
  console.log(`  ok    ${label}${detail ? ` — ${detail}` : ''}`);
}

function fail(label: string, detail: string) {
  failures += 1;
  console.log(`  FAIL  ${label} — ${detail}`);
}

function requireEnv(name: string): string | null {
  const value = (process.env[name] || '').trim();
  if (!value) {
    fail(name, 'not set');
    return null;
  }
  if (PLACEHOLDER.test(value)) {
    fail(name, 'still contains a placeholder');
    return null;
  }
  pass(name, name.includes('KEY') ? 'set (redacted)' : 'set');
  return value;
}

async function main() {
  console.log('\nEnvironment');
  const url = requireEnv('NEXT_PUBLIC_SUPABASE_URL');
  const anonKey = requireEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY');
  const serviceKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
  const databaseUrl = requireEnv('DATABASE_URL');

  if (url && anonKey && serviceKey) {
    console.log('\nSupabase REST API');
    for (const [label, key] of [['anon key', anonKey], ['service-role key', serviceKey]] as const) {
      const client = createClient(url, key, { auth: { persistSession: false } });
      const { error } = await client.from('drivers').select('id').limit(1);
      if (!error) {
        pass(label, 'authenticated, drivers table readable');
      } else if (error.code === 'PGRST205') {
        fail(label, 'authenticated, but table public.drivers does not exist — apply supabase_schema.sql');
      } else {
        fail(label, `${error.code || 'error'}: ${error.message}`);
      }
    }
  }

  if (databaseUrl) {
    console.log('\nPrisma / PostgreSQL');
    try {
      const { PrismaClient } = await import('@prisma/client');
      const prisma = new PrismaClient({ log: ['error'] });
      try {
        const [drivers, payments] = await Promise.all([
          prisma.driver.count(),
          prisma.payment.count(),
        ]);
        pass('connection', `drivers=${drivers}, payments=${payments}`);
      } finally {
        await prisma.$disconnect();
      }
    } catch (err) {
      fail('connection', err instanceof Error ? err.message.split('\n')[0] : String(err));
    }
  }

  console.log(
    failures === 0
      ? '\nSupabase is attached and reachable.\n'
      : `\n${failures} check(s) failed — see above.\n`
  );
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
