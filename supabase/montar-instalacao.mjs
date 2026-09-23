// Junta base-projeto-proprio.sql + migrations num arquivo só, para colar no SQL Editor de um Supabase próprio.
// Uso: npm run db:instalacao
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const migrations = fs.readdirSync(path.join(aqui, 'migrations')).sort().map((f) => path.join('migrations', f));
const partes = [
  '-- Gerado por supabase/montar-instalacao.mjs; não editar à mão.\n'
    + '-- Instala o Octadesk Plus num Supabase próprio (sem o metrics).\n\n'
    + '-- agenda dos detectores, atribuição e limpeza\ncreate extension if not exists pg_cron;\n',
  ...[path.join('base', 'base-projeto-proprio.sql'), ...migrations]
    .map((f) => `-- ===== ${f.split(path.sep).join('/')} =====\n${fs.readFileSync(path.join(aqui, f), 'utf8')}`),
];
fs.writeFileSync(path.join(aqui, 'instalar-projeto-proprio.sql'), partes.join('\n'));
console.log('gerado supabase/instalar-projeto-proprio.sql');
