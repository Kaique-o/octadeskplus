# Camada única de acesso aos dados

> **Documento historico.** Descreve a estrutura multipagina anterior a migracao
> para React (`src/js/`, `scripts/build.js`, `src/assets/css/styles.css`), que foi
> removida do repositorio. Vale como registro datado, nao como instrucao.
> Para o estado atual, ver `llm.md` e `docs/ai/`.

> Implementada na versão 1.8.0.

## Objetivo

Eliminar chamadas remotas espalhadas pelas telas e impedir que a interface dependa diretamente do SDK, de nomes de tabela ou de nomes de RPC.

## Arquivo público

```text
src/js/data/data-access.js
```

Este é o único módulo autorizado a importar `src/js/core/supabase-client.js`.

## Fluxo

```text
pagina / componente / auth / settings
                |
                v
       dataAccess.<dominio>
                |
                v
        supabase-client.js
                |
                v
       Supabase Auth/PostgREST
```

## Domínios

### `dataAccess.dashboard`

- `home(filtros)`
- `sugestaoCompra(filtros)`
- `rupturas(filtros)`
- `produtos(filtros)`
- `budget(filtros)`
- `excesso(filtros)`
- `transferencias(filtros)`
- `recebimentos(filtros)`
- `fornecedores(filtros)`

### `dataAccess.auth`

- `getSession()`
- `signIn(email, password)`
- `signOut()`
- `requestPasswordReset(email, redirectTo)`
- `verifyRecoveryCode(email, token)`
- `updatePassword(password)`

### `dataAccess.users`

- `getProfile(userId)`
- `listForPermissions()`
- `updateOwnProfile(userId, values)`
- `updateRole(userId, perfil)`

### `dataAccess.permissions`

- `get(userId)`
- `save(userId, config, actorId)`

### `dataAccess.parameters`

- `list(keys)`
- `saveAll(rows)`

## Erros

Toda falha remota é convertida em `DataAccessError`:

```text
message
operation
code
status
details
hint
cause
```

A UI decide como apresentar a falha, mas não interpreta a resposta bruta do SDK.

## Regras para novas operações

1. criar um método com nome semântico no domínio adequado;
2. informar explicitamente as colunas em consultas de tabela;
3. normalizar parâmetros dentro da camada;
4. devolver dados já no contrato esperado pelo consumidor;
5. não importar arquivos de UI dentro da camada;
6. executar `npm run check`.

## Proteção automática

`scripts/validate.js` falha quando encontra fora da camada:

- import de `supabase-client.js`;
- chamada `supabase.rpc`;
- chamada `supabase.auth`;
- consulta `.from('tabela')`.
