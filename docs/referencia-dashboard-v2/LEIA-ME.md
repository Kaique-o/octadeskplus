# Documentação do dashboard-v2 — pacote para reuso

Todos os `.md` do repositório `dashboard-v2`, com a estrutura de pastas original.
Este arquivo (`LEIA-ME.md`) e o `prompt-sidebar.md` não fazem parte do repositório:
foram escritos para acompanhar o pacote.

## Ordem de leitura

O documento canônico é o `llm.md` — onde qualquer outro arquivo divergir dele,
vale o `llm.md`. Ele manda ler nesta ordem:

1. `docs/ai/design-system.md` — paleta, tokens, tipografia, espaçamento
2. `docs/ai/componentes.md` — catálogo dos componentes e como compõem as telas
3. `docs/ai/boas-praticas.md` — convenções de código
4. `docs/ai/backend.md` — contrato das RPCs
5. `docs/ai/diagramas.md`
6. a auditoria e o plano de ação mais recentes em `docs/audits/`

`CLAUDE.md` e `AGENTS.md` são o mesmo briefing em formatos diferentes (um para
Claude Code, outro para Codex): arquitetura, padrões do projeto, comandos e a
lista de problemas recorrentes. São o melhor ponto de partida para escrever o
briefing do projeto novo.

## O que é reaproveitável e o que é específico

**Serve para qualquer projeto com a mesma cara:**

- `docs/ai/design-system.md` e `docs/ai/componentes.md` — a identidade visual
- `docs/ai/boas-praticas.md`
- `prompt-sidebar.md` — o menu lateral especificado medida a medida, com cores e
  itens em branco para você preencher
- de `CLAUDE.md`/`AGENTS.md`: as seções "Estilo e UI", "Padrões do projeto",
  "Feature nova (TDD)" e "Checklist pós-implementação"

**É específico deste domínio** (compras/estoque, Supabase, n8n, Cloudflare) e só
serve se o projeto novo repetir a mesma stack:

- `docs/ai/backend.md`, `docs/architecture/`, `supabase/`
- `docs/integration/`, `integrations/n8n/`, `docs/handoff/`
- `docs/implantacao/`, `docs/operations/`, `docs/security-audit/`
- `docs/audits/` e `docs/reports/releases/` — histórico, não regra

## Onde a aparência realmente mora

A documentação descreve, mas a fonte de verdade do visual são três arquivos de
código (não incluídos aqui, porque são `.jsx`/`.css`):

- `src/app/index.css` — tema daisyUI `compras`, tokens extras e todo o CSS da
  sidebar (bloco `.painel-classico`)
- `src/modulos/compras/componentes/SidebarClassica.jsx`
- `src/shared/layout/SidebarRodape.jsx`

O `prompt-sidebar.md` foi extraído desses três — é o que permite reconstruir a
sidebar sem copiar os arquivos.
