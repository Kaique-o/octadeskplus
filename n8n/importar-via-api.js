// Importa os fluxos de n8n/fluxos/ para uma instância n8n via API pública (entram desativados).
// Uso: N8N_URL=https://n8n.kaiqueoli.com N8N_API_KEY=xxx node n8n/importar-via-api.js
const fs = require('fs');
const path = require('path');

const URL = (process.env.N8N_URL || '').replace(/\/$/, '');
const KEY = process.env.N8N_API_KEY;
if (!URL || !KEY) { console.error('Defina N8N_URL e N8N_API_KEY'); process.exit(1); }

const SETTINGS = ['saveExecutionProgress', 'saveManualExecutions', 'saveDataErrorExecution', 'saveDataSuccessExecution', 'executionTimeout', 'errorWorkflow', 'timezone', 'executionOrder', 'callerPolicy', 'callerIds'];
const dir = path.join(__dirname, 'fluxos');

(async () => {
  let ok = 0, erro = 0;
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.json'))) {
    const w = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    const settings = Object.fromEntries(Object.entries(w.settings || {}).filter(([k]) => SETTINGS.includes(k)));
    const r = await fetch(`${URL}/api/v1/workflows`, {
      method: 'POST',
      headers: { 'X-N8N-API-KEY': KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: w.name, nodes: w.nodes, connections: w.connections, settings }),
    });
    if (r.ok) { ok++; console.log('OK  ', w.name); } else { erro++; console.log('ERRO', w.name, '|', r.status, (await r.text()).slice(0, 300)); }
  }
  console.log(`\nImportados: ${ok}  Erros: ${erro}`);
  console.log('Depois: crie a credencial Postgres "Supabase Postgres", selecione-a nos nodes Postgres e ative os fluxos.');
})();
