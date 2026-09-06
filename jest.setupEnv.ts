import { loadEnvConfig } from '@next/env';
import 'whatwg-fetch';

const projectDir = process.cwd();
loadEnvConfig(projectDir);

// Em testes, o Prisma deve usar DIRECT_URL (session-mode pooler) em vez do
// DATABASE_URL com pgbouncer=true (transaction mode), que causa falhas de FK
// quando um usuário é criado no Supabase Auth e em seguida acessado pelo Prisma.
if (process.env.DIRECT_URL) {
  process.env.DATABASE_URL = process.env.DIRECT_URL;
}

