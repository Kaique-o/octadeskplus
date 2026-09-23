// Testa a instalação num Supabase próprio: base-projeto-proprio.sql + migrations, sem o stub do metrics.
// Uso: npm run db:test (roda junto com testar.mjs)
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const db = new PGlite({ extensions: { pgcrypto } });

let falhas = 0;
const um = async (sql, params) => (await db.query(sql, params)).rows[0];
const teste = (nome, ok, detalhe = '') => {
  console.log(`${ok ? 'ok    ' : 'FALHOU'} ${nome}${!ok && detalhe ? `\n       ${detalhe}` : ''}`);
  if (!ok) falhas++;
};

// só o que o Supabase já traz num projeto novo
await db.exec(`
  create role anon; create role authenticated; create role service_role;
  create schema auth;
  create table auth.users (id uuid primary key default gen_random_uuid(), email text, instance_id uuid, aud text, role text,
    encrypted_password text, email_confirmed_at timestamptz, raw_app_meta_data jsonb, raw_user_meta_data jsonb,
    created_at timestamptz, updated_at timestamptz, last_sign_in_at timestamptz, confirmation_token text, recovery_token text,
    email_change_token_new text, email_change text);
  create table auth.identities (id uuid primary key default gen_random_uuid(), provider_id text not null, user_id uuid not null,
    identity_data jsonb not null, provider text not null, last_sign_in_at timestamptz, created_at timestamptz, updated_at timestamptz);
  -- grants padrão do Supabase: tudo que nasce no public já sai com grant para anon e authenticated
  grant usage on schema public to anon, authenticated;
  alter default privileges in schema public grant all on tables to anon, authenticated;
  alter default privileges in schema public grant all on functions to anon, authenticated;
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('teste.uid', true), '')::uuid $$;
`);

const arquivos = [path.join(aqui, '..', 'base', 'base-projeto-proprio.sql'),
  ...fs.readdirSync(path.join(aqui, '..', 'migrations')).sort().map((f) => path.join(aqui, '..', 'migrations', f))];
for (const f of arquivos) {
  try { await db.exec(fs.readFileSync(f, 'utf8')); teste(`projeto próprio: ${path.basename(f)}`, true); }
  catch (e) { teste(`projeto próprio: ${path.basename(f)}`, false, e.message); process.exit(1); }
}
teste('projeto próprio: base pode ser reaplicada', await db.exec(fs.readFileSync(arquivos[0], 'utf8')).then(() => true, () => false));

const primeiroAcesso = async () => {
  await db.exec(`reset role; select set_config('teste.uid', '', false); set role anon`);
  const r = (await um(`select octaplus.primeiro_acesso() p`)).p;
  await db.exec('reset role');
  return r;
};
teste('primeiro acesso: sem usuários, a tela oferece criar conta (anon consulta)', await primeiroAcesso() === true);

const primeiro = (await um(`insert into auth.users (email, raw_user_meta_data) values ('dono@x', '{"full_name":"Dono"}') returning id`)).id;
const segundo = (await um(`insert into auth.users (email) values ('outro@x') returning id`)).id;
const papel = async (id) => (await um(`select role from public.user_roles where user_id = $1`, [id])).role;
teste('primeiro acesso: depois do primeiro usuário, não oferece mais', await primeiroAcesso() === false);
teste('projeto próprio: primeiro usuário vira dono', await papel(primeiro) === 'owner');
teste('projeto próprio: demais entram sem acesso', await papel(segundo) === 'viewer');
teste('projeto próprio: perfil criado com nome', (await um(`select full_name n from public.profiles where id = $1`, [primeiro])).n === 'Dono');

const pode = async (uid) => {
  await db.exec(`reset role; select set_config('teste.uid', '${uid}', false); set role authenticated`);
  return (await um(`select octaplus.pode_na((select id from octaplus.empresas limit 1), 'editar') p`)).p;
};
teste('projeto próprio: dono edita o octaplus', await pode(primeiro) === true);
teste('projeto próprio: outro usuário não edita', await pode(segundo) === false);
// perfil: cada um lê e renomeia só o próprio; e-mail não muda pelo navegador
await db.exec(`reset role; select set_config('teste.uid', '${segundo}', false); set role authenticated`);
const vistos = (await db.query('select id from public.profiles')).rows;
teste('perfil: usuário só vê o próprio', vistos.length === 1 && vistos[0].id === segundo, JSON.stringify(vistos));
await db.query(`update public.profiles set full_name = 'Outro Nome'`);
await db.exec('reset role');
const nomes = (await db.query('select id, full_name from public.profiles')).rows;
teste('perfil: renomeia só o próprio', nomes.find((x) => x.id === segundo).full_name === 'Outro Nome'
  && nomes.find((x) => x.id === primeiro).full_name === 'Dono');
await db.exec(`select set_config('teste.uid', '${segundo}', false); set role authenticated`);
const trocaEmail = await db.query(`update public.profiles set email = 'x@x' where id = '${segundo}'`).then(() => true, () => false);
teste('perfil: e-mail não muda pelo navegador', !trocaEmail);

// authenticated tem grant nas tabelas do public (padrão do Supabase); quem barra é o RLS
await db.exec(`reset role; insert into public.clients (name) values ('Ana'); set role authenticated`);
const linhas = (await db.query('select * from public.clients')).rows.length;
teste('projeto próprio: navegador não lê public.clients (RLS)', linhas === 0, `${linhas} linha(s)`);

console.log(falhas ? `\n${falhas} teste(s) falharam` : '\ntodos os testes do projeto próprio passaram');
process.exit(falhas ? 1 : 0);
