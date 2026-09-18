# llm.design.md — design system do dashboard compras

fonte de verdade: tema daisyUI `compras` + tokens extras, implementados em `src/app/index.css` (Tailwind v4 + `@plugin "daisyui/theme"`).
referencia historica: `docs/reference/kv_dashboard_compras.md` (key visual aprovado) e `src/assets/css/styles.css` (implementacao pre-React, mesma paleta).
estilo: **saas clean corporativo**, desktop-first, leitura rapida, decisao operacional.

## paleta de cores

os valores hex nao mudaram na migracao para React; o que muda e o nome/local do token. base e primaria vem do tema daisyUI; os status sem equivalente direto no daisyUI ficam em `:root` no mesmo arquivo.

### base

| uso               | token daisyUI (`src/app/index.css`) | hex       |
| ----------------- | ----------------------------------- | --------- |
| fundo principal   | `--color-base-200`                  | `#F8FAFC` |
| card / superficie | `--color-base-100`                  | `#FFFFFF` |
| borda padrao      | `--color-base-300`                  | `#E2E8F0` |

superficie suave e divisor interno (antigos `--color-surface-soft` `#F1F5F9` e `--color-divider` `#EEF2F7`) nao tem token dedicado no tema novo: usar `bg-base-200`/`border-base-300` com opacidade Tailwind (`/50`, `/70`) quando precisar de uma variacao mais clara.

### texto

o antigo conjunto de quatro tokens fixos (`--color-text-primary/secondary/muted/disabled`) foi substituido por um unico token + opacidade Tailwind:

| uso          | classe                                                 | equivalente aproximado   |
| ------------ | ------------------------------------------------------ | ------------------------ |
| principal    | `text-base-content` (`--color-base-content` `#0F172A`) | `--color-text-primary`   |
| secundario   | `text-base-content/60`                                 | `--color-text-secondary` |
| fraco        | `text-base-content/50` a `/40`                         | `--color-text-muted`     |
| desabilitado | `text-base-content/30`                                 | `--color-text-disabled`  |

### primaria (azul = acao/navegacao)

| uso                 | token                     | hex       |
| ------------------- | ------------------------- | --------- |
| azul principal      | `--color-primary`         | `#2563EB` |
| conteudo sobre azul | `--color-primary-content` | `#FFFFFF` |

hover/soft/border dedicados (`--color-primary-hover` etc.) nao existem mais como token: usar `bg-primary/10`, `hover:bg-base-200`, `ring-primary` via Tailwind conforme o componente.

### status (cores semanticas)

| significado                      | token                                                 | hex       |
| -------------------------------- | ----------------------------------------------------- | --------- |
| ruptura / erro / negativo        | `--color-error`                                       | `#EF4444` |
| critico maximo (badge "Critico") | `--color-critical` (`:root`, sem equivalente daisyUI) | `#F43F5E` |
| alerta / atencao                 | `--color-warning`                                     | `#F59E0B` |
| urgencia intermediaria / critico | `--color-orange` (`:root`)                            | `#F97316` |
| ok / saudavel / recebido         | `--color-success`                                     | `#22C55E` |
| informativo / em andamento       | `--color-info` (`= --color-accent`)                   | `#0EA5E9` |
| excesso / apoio                  | `--color-purple` (`:root`, `= --color-secondary`)     | `#7C3AED` |
| cobertura / apoio                | `--color-teal` (`:root`)                              | `#14B8A6` |

## regras de uso de cor por status

- vermelho **somente** para problema real (ruptura, saldo negativo, divergencia, critico).
- laranja/amarelo para alerta e prioridade intermediaria.
- verde para saudavel, recebido, conferido, ok.
- azul primario para acao, navegacao, item ativo e serie principal de grafico.
- roxo/teal apenas como apoio (excesso, cobertura) — nunca cor principal de tela.
- a cor da fatia/linha do grafico deve ser a mesma do dot da legenda no mesmo card.
- graficos desenham em `<canvas>` (chart.js), que nao resolve `var(--x)`: usar `corTema('--nome-da-variavel')` de `src/shared/lib/theme-color.js` em vez do valor hex fixo.

## tipografia

- fonte: `@fontsource-variable/inter` (import local em `src/app/main.jsx`) + `font-family: 'Inter Variable', ui-sans-serif, system-ui, sans-serif` em `body` (`src/app/index.css`);
- tamanhos/pesos usam as classes Tailwind padrao (`text-xl font-semibold`, `text-sm text-base-content/60`...) em vez das classes proprias antigas (`.page-title`, `.kpi-value`...). aproximacao pratica observada nas paginas:

| elemento              | classe Tailwind tipica                                                 |
| --------------------- | ---------------------------------------------------------------------- |
| titulo de pagina      | `text-xl font-semibold`                                                |
| titulo de card        | `card-title text-base`                                                 |
| valor de kpi          | `stat-value` (daisyUI, ajustado por `tamanhoValor()` em `KpiCard.jsx`) |
| texto de apoio / nota | `text-sm text-base-content/60`                                         |

nao ha mais folha de estilo com pesos fixos por elemento: cada jsx escolhe a classe Tailwind mais proxima do peso/tamanho já usado nas telas existentes — copiar de uma tela vizinha antes de inventar combinacao nova.

## espacamentos e radius

fonte de verdade agora e a escala padrao do Tailwind (`gap-4`=16px, `p-6`=24px, `p-8`=32px...), nao mais tokens `--space-*` proprios. valores praticados nas telas:

- gap entre kpis/cards: `gap-4` (16px);
- padding de `card-body`: padrão do daisyUI (24px);
- padding do conteudo principal: `p-4 sm:p-6 lg:p-8`;
- radius: tema daisyUI define `--radius-box: 1rem` (16px, cards) e `--radius-field`/`--radius-selector: 0.625rem` (10px, inputs/botoes/selects) em `src/app/index.css`.

nada de botao pill exagerado — os componentes daisyUI (`btn`, `badge`, `avatar`) ja seguem essa regra por padrao.

## sombra e borda

- card: `shadow-sm` (daisyUI/Tailwind) + `bg-base-100`;
- proibido: glow, sombra preta pesada, fundo escuro fora do tema `dark`, gradiente forte.

## hierarquia visual

ordem de leitura de toda tela protegida: sidebar (`AppShell`) → titulo → filtros (`FilterBar`) → kpis (`stats`) → componente principal (tabela/matriz/grafico grande) → cards analiticos secundarios. o componente principal deve ocupar mais espaco que os secundarios.

o login deixou de ter o layout de duas colunas (aside decorativo + form) da versao legada: hoje e um unico card centralizado (`src/app/paginas/Login.jsx`), sem elemento decorativo.

## regras para manter o visual clean

- fundo geral nunca branco puro (`bg-base-200`); branco puro (`bg-base-100`) so em card.
- uma cor de acento por significado; nao decorar com cor.
- tabela densa mas com respiro (`table-sm`, hover padrao do daisyUI, sem zebra pesada, sem borda preta).
- graficos: linhas finas (`borderWidth` ~2.5-3), sem 3d, sem gradiente pesado.
- animacoes leves e funcionais apenas (`animation: { delay: 300 }` nos graficos, `skeleton` do daisyUI para loading).
- desktop-first: breakpoint principal `lg` (1024px, escala padrao do Tailwind) — a sidebar colapsa para drawer com overlay abaixo dele; login e telas de conteudo unico nao precisam de breakpoint proprio.
