# Validação da camada única de dados

Data: 19/07/2026  
Versão: 1.8.0

## Estrutura validada

- `src/js/data/data-access.js` é a única fachada pública de dados;
- apenas a fachada importa `src/js/core/supabase-client.js`;
- as nove telas operacionais usam `dataAccess.dashboard`;
- Auth, perfis, permissões e parâmetros também usam `dataAccess`;
- nenhuma página chama `.rpc()`, `.from()` ou `supabase.auth` diretamente;
- erros remotos são convertidos em `DataAccessError`.

## Comandos executados

```bash
npm ci
npm run check
npm audit --audit-level=high
```

Resultados:

```text
build concluído
validação estrutural concluída
0 vulnerabilidades
13 páginas HTML responderam HTTP 200
bundles principais CSS e JavaScript responderam HTTP 200
```

## Banco

Nenhuma migration foi criada ou alterada. O contrato atual das tabelas e RPCs permanece igual.
