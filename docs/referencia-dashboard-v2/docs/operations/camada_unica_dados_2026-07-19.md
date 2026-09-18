# Implementação da camada única de dados — 19/07/2026

> **Documento historico.** Descreve a estrutura multipagina anterior a migracao
> para React (`src/js/`, `scripts/build.js`, `src/assets/css/styles.css`), que foi
> removida do repositorio. Vale como registro datado, nao como instrucao.
> Para o estado atual, ver `llm.md` e `docs/ai/`.

## Alterações

- criado `src/js/data/data-access.js`;
- centralizadas as nove RPCs operacionais;
- centralizados Auth, perfis, permissões e parâmetros;
- páginas deixaram de importar o cliente Supabase;
- erros remotos passaram a usar `DataAccessError`;
- `scripts/validate.js` passou a bloquear acesso direto fora da camada;
- documentação estrutural e de backend atualizada;
- versão elevada para `1.8.0`.

## Impacto no banco

Nenhuma migration nova. O contrato das RPCs e tabelas permanece igual.

## Validação

```bash
npm ci
npm run check
```
