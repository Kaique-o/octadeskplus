# auditoria de erros - 2026-07-02

> **Documento historico.** Descreve a estrutura multipagina anterior a migracao
> para React (`src/js/`, `scripts/build.js`, `src/assets/css/styles.css`), que foi
> removida do repositorio. Vale como registro datado, nao como instrucao.
> Para o estado atual, ver `llm.md` e `docs/ai/`.

auditoria completa do projeto dashboard compras (13 html, 8 js, 1 css, 5 md, 9 sql).
prioridades: **alta** = quebra visivel ou bloqueia uso | **media** = inconsistencia real | **baixa** = melhoria/higiene.

---

## erro 1 - icone lucide inexistente `circle-a`

**arquivo:** `rupturas.html` (kpi "Curva A em Ruptura") e `produtos.html` (kpi "Curva A")

**problema:**
`data-lucide="circle-a"` nao existe na biblioteca lucide (verificado contra o pacote oficial, 1994 icones). o `lucide.createIcons()` nao substitui o `<i>`, que fica vazio.

**impacto:**
kpi renderiza sem icone (circulo colorido vazio) nas duas paginas.

**prioridade:** alta

**correcao sugerida:**
trocar por icone existente com mesmo significado (ex.: `award` para "curva A" = produtos top).

---

## erro 2 - centro dos donuts exibe `\A` literal

**arquivo:** `index.html`, `sugestao-compra.html`, `budget.html`, `transferencias.html`, `produtos.html`, `recebimento.html`, `fornecedores.html` + `src/assets/css/styles.css` (`.donut::after`)

**problema:**
os donuts usam `data-center="Total\A 8.742\A SKUs"` esperando que `\A` vire quebra de linha via `content: attr(data-center)`. o escape `\A` so funciona em string escrita no proprio css — em `attr()` o valor do atributo entra literal. o centro do donut mostra o texto `Total\A 8.742\A SKUs` com barras.

**impacto:**
todos os 7 donuts do projeto exibem texto quebrado no centro.

**prioridade:** alta

**correcao sugerida:**
trocar `\A ` por quebra de linha real no atributo (`&#10;`); o `white-space: pre` ja existente no css passa a funcionar.

---

## erro 3 - tela branca permanente quando supabase nao esta configurado

**arquivo:** `src/js/core/supabase-client.js` + `src/assets/css/styles.css`

**problema:**
com `config.js` vazio (padrao do repositorio), `createClient('', '')` lanca excecao, o modulo `auth.js` inteiro falha e a classe `.auth-ready` nunca e adicionada ao body. como o css esconde `.app`/`.login-shell` com `opacity: 0` ate o `.auth-ready`, toda pagina fica em branco — inclusive o login.

**impacto:**
rodando local sem preencher as chaves, o projeto inteiro parece quebrado, sem nenhuma mensagem na tela.

**prioridade:** alta

**correcao sugerida:**
usar url/chave placeholder validas quando as env estiverem vazias (client inicializa, `getSession()` devolve null, fluxo cai no login e o erro aparece de forma controlada no console/submit).

---

## erro 4 - doc duplicada e desatualizada na raiz

**arquivo:** `guia_visual_dashboard_compras(1).md`

**problema:**
copia antiga de `docs/reference/kv_dashboard_compras.md` (faltam as 83 linhas finais que documentam as paginas 7-10). nome fora do padrao (parenteses, sufixo de download).

**impacto:**
duas fontes de verdade do design system; quem ler a copia da raiz perde a doc das paginas novas.

**prioridade:** media

**correcao sugerida:**
remover a copia da raiz, manter `docs/reference/kv_dashboard_compras.md` como canonico e corrigir referencias em `resumo_projeto_dashboard_compras.md`.

---

## erro 5 - home: matriz, kpis e donut com numeros conflitantes

**arquivo:** `index.html` (+ gradiente base `.donut` em `styles.css`)

**problema:**
a matriz soma 10.342 skus (ruptura 312, critico 486, atencao 1.249, saudavel 7.167, excesso 1.128), o kpi diz 8.742 skus monitorados e o donut distribui 8.742 com valores diferentes (ruptura 576, critico 1.338, atencao 1.026, saudavel 4.674).

**impacto:**
tres componentes da mesma tela se contradizem — mina a confianca no dashboard.

**prioridade:** media

**correcao sugerida:**
manter ruptura 312 e excesso 1.128 (confirmados 2x na tela), ajustar linha "saudavel" da matriz para fechar 8.742 e recalcular donut/legenda com os mesmos numeros.

---

## erro 6 - donut de recebimento: 5 fatias, 4 legendas, total errado

**arquivo:** `recebimento.html` + `.donut.receiving` em `styles.css`

**problema:**
legenda soma 56 (24+18+8+6), centro diz "Total 66" e o gradiente tem uma 5a fatia roxa (~15%) sem legenda.

**impacto:**
grafico mente: fatia fantasma e total que nao fecha.

**prioridade:** media

**correcao sugerida:**
total 56, remover fatia roxa e recalcular os 4 percentuais.

---

## erro 7 - donut de produtos: fatia roxa sem legenda e soma que nao fecha

**arquivo:** `produtos.html` + `.donut.quality` em `styles.css`

**problema:**
legenda soma 8.441 (2.158+2.989+2.543+751) mas o centro diz 8.742; o gradiente tem fatia roxa 96,6-100% sem categoria correspondente.

**impacto:**
mesmo problema do erro 6: ~301 produtos "fantasma".

**prioridade:** media

**correcao sugerida:**
ajustar "Inacabado" para 2.459 (fecha 8.742), remover fatia roxa e recalcular percentuais.

---

## erro 8 - grafico "evolucao das rupturas" com 4 legendas e 3 linhas

**arquivo:** `rupturas.html`

**problema:**
legenda lista Total, Curva A, Curva B e Curva C, mas o svg tem apenas 3 polylines (falta a linha verde da Curva C).

**impacto:**
legenda orfa; leitor procura uma serie que nao existe.

**prioridade:** media

**correcao sugerida:**
adicionar polyline verde (`#22C55E`) com valores abaixo da Curva B.

---

## erro 9 - donut de transferencias: duas fatias verdes para legendas iguais

**arquivo:** `transferencias.html`

**problema:**
"Aprovada" e "Recebida" usam o mesmo dot verde na legenda, mas o gradiente usa dois verdes diferentes (`#22C55E` e `#16A34A`); impossivel saber qual fatia e qual.

**impacto:**
leitura ambigua do grafico.

**prioridade:** media

**correcao sugerida:**
usar teal (`#14B8A6`, token existente) para "Recebida" na fatia e criar `.dot.teal` para a legenda.

---

## erro 10 - css morto (classes sem nenhum uso no html)

**arquivo:** `src/assets/css/styles.css`

**problema:**
seletores sem ocorrencia em nenhuma pagina: `.chart`, `.chart-grid`, `.stack`, `.control .placeholder`, `.icon-box.yellow`, `.form-grid.single`, `.footer-note .refresh`, `.table .right`.

**impacto:**
peso e ruido no css central; induz uso de padrao abandonado.

**prioridade:** media

**correcao sugerida:**
remover os seletores mortos (tokens `--space-*` e `--color-violet` permanecem: fazem parte do contrato de design tokens documentado).

---

## erro 11 - css duplicado

**arquivo:** `src/assets/css/styles.css`

**problema:**
`.sidebar-footer` definido 2x (linhas ~718 e ~1001), `.sidebar-user` definido 2x (~1006 e ~1079) e tres blocos `@media (max-width: 1180px)` separados.

**impacto:**
manutencao arriscada: editar uma definicao e esquecer a outra.

**prioridade:** media

**correcao sugerida:**
consolidar cada seletor em uma unica definicao e unificar as media queries.

---

## erro 12 - dependencia lucide sem versao fixada

**arquivo:** todos os html (`https://unpkg.com/lucide@latest/...`)

**problema:**
`@latest` pode trazer major novo com icones renomeados/removidos, quebrando os icones do projeto inteiro sem nenhum deploy.

**impacto:**
risco de quebra silenciosa em producao.

**prioridade:** media

**correcao sugerida:**
fixar versao testada (ex.: `lucide@1.23.0`, atual em 2026-07) em todas as paginas.

---

## erro 13 - botao "olho" da senha no login nao funciona

**arquivo:** `login.html` / `src/js/core/auth.js`

**problema:**
o icone de olho no campo de senha e decorativo — nao alterna mostrar/ocultar senha.

**impacto:**
usuario clica e nada acontece; ui promete funcao que nao existe.

**prioridade:** baixa

**correcao sugerida:**
handler em `auth.js` alternando `type=password/text` + icone `eye`/`eye-off`.

---

## erro 14 - links mortos e placeholders

**arquivo:** `login.html` (`href="#administrador"`), `recebimento.html` (`href="#"` em "Ver todos os recebimentos previstos"), `login.html` (`.btn-sso` com `href="index.html"`)

**problema:**
ancoras sem destino/handler. o sso tem handler js (alert), mas o `href="index.html"` navega errado se o js falhar.

**impacto:**
cliques sem efeito ou navegacao indevida como fallback.

**prioridade:** baixa

**correcao sugerida:**
`.btn-sso` com `href="#"` (handler ja existe); demais registrar como pendencia de produto (destino real a definir).

---

## erro 15 - "lembrar acesso" e um enfeite

**arquivo:** `login.html`

**problema:**
o "checkbox" e um `<span>` estatico, sem input real e sem funcao.

**impacto:**
usuario acha que controla persistencia de sessao, mas nao controla (sessao supabase sempre persiste).

**prioridade:** baixa

**correcao sugerida:**
pendencia de produto: implementar de verdade (storage de sessao condicional) ou remover o elemento. nao alterado nesta rodada para nao inventar comportamento.

---

## erro 16 - cores divergentes entre linha do grafico e legenda (home)

**arquivo:** `index.html`

**problema:**
serie "Excesso" desenhada com `#8B5CF6` (violet) enquanto o dot da legenda usa `--color-purple #7C3AED`.

**impacto:**
mesma serie com duas cores no mesmo card.

**prioridade:** baixa

**correcao sugerida:**
alinhar a polyline ao `#7C3AED` da legenda.

---

## erro 17 - favicon ausente

**arquivo:** todos os html

**problema:**
nenhuma pagina declara favicon; navegador dispara request 404 de `/favicon.ico`.

**impacto:**
404 no console em toda pagina; aba sem identidade.

**prioridade:** baixa

**correcao sugerida:**
favicon svg inline (data uri, carrinho azul `#2563EB`) em todas as paginas.

---

## erro 18 - acessibilidade: cabecalhos de tabela sem `scope`

**arquivo:** todos os html com tabelas

**problema:**
`<th>` sem `scope="col"`; filtros `.control` sao divs nao focaveis simulando selects; checkboxes de linha sem label acessivel.

**impacto:**
leitores de tela nao associam celulas a colunas; filtros invisiveis para teclado.

**prioridade:** baixa

**correcao sugerida:**
adicionar `scope="col"` (seguro, sem impacto visual) e `aria-label` nos checkboxes de linha. filtros interativos reais ficam como pendencia (mudaria componente global).

---

## erro 19 - readme e resumo desatualizados

**arquivo:** `README.md`, `resumo_projeto_dashboard_compras.md`

**problema:**
readme nao lista `docs/architecture/supabase_arquitetura.md`, `assets/images/mockups/` nem o resumo na estrutura; resumo ainda aponta o bug `%%` em `06_rpc_acoes.sql` como pendente, mas o sql ja esta correto (verificado: todos os `raise exception` usam `%`), e referencia a doc duplicada da raiz.

**impacto:**
documentacao mente sobre o estado real do projeto.

**prioridade:** baixa

**correcao sugerida:**
atualizar estrutura do readme (incluindo `llm.md` e `docs/ai/`) e corrigir as pendencias do resumo.

---

## erro 20 - higiene de codigo js/html

**arquivo:** `src/js/settings/perfil.js`, `index.html`, `sugestao-compra.html`

**problema:**
`import { supabase, }` com virgula sobrando (perfil.js); atributos `class=""` vazios em kpis e celulas; preferencia "densidade da tabela" (configuracao) e salva mas nao aplica efeito nenhum.

**impacto:**
ruido de manutencao; configuracao que nao faz nada.

**prioridade:** baixa

**correcao sugerida:**
limpar virgula e `class=""`; densidade de tabela registrada como pendencia (exige css `.table` compacta + aplicar classe no load de todas as paginas).

---

## erro 21 - login sem fallback responsivo

**arquivo:** `src/assets/css/styles.css`

**problema:**
`.login-shell` fixa `35% / 65%` sem nenhuma media query (o restante do app tem breakpoint 1180px).

**impacto:**
em janela estreita o formulario espreme; projeto e desktop-first, mas o app interno ja trata isso e o login nao.

**prioridade:** baixa

**correcao sugerida:**
abaixo de 1024px, empilhar em coluna unica ocultando o aside ilustrativo.

---

## observacoes (nao sao erros)

- `06_rpc_acoes.sql`: bug `%%` citado no resumo ja esta corrigido no sql atual.
- vocabulario de prioridade difere entre telas ("Urgente/Alta/Media" vs "Critico/Urgente/Hoje") — ja mapeado como risco R8 em `docs/architecture/supabase_arquitetura.md`, decisao de produto pendente.
- dados sao todos mockados no html; a consistencia corrigida aqui vale ate a integracao real (RPCs `get_*`) entrar.
- kv doc especifica pesos 600/700 em titulos; a implementacao usa 700/800. mantida a implementacao (visual aprovado) e documentado o valor real em `docs/ai/design-system.md`.
