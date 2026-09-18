# relatorio de erros

> **Documento historico.** Descreve a estrutura multipagina anterior a migracao
> para React (`src/js/`, `scripts/build.js`, `src/assets/css/styles.css`), que foi
> removida do repositorio. Vale como registro datado, nao como instrucao.
> Para o estado atual, ver `llm.md` e `docs/ai/`.

consolidado da auditoria de 2026-07-02 (`docs/audits/auditoria_erros_2026-07-02.md`) + reorganizacao de pastas de 2026-07-02.
status possiveis: `okay` (corrigido e validado) | `pendente` (registrado, aguarda decisao/rodada futura) | `nao_aplicavel`.

---

## erro 1 - icone lucide inexistente `circle-a`

**arquivo:** `src/modulos/compras/paginas/rupturas.html`, `src/modulos/compras/paginas/produtos.html`

**problema:**
`data-lucide="circle-a"` nao existe na biblioteca lucide; o icone do kpi ficava vazio.

**impacto:**
kpi "Curva A" renderizava sem icone nas duas paginas.

**correcao sugerida:**
trocar por icone existente (`award`).

**status final:** okay

---

## erro 2 - centro dos donuts exibia `\A` literal

**arquivo:** `index.html` e 6 paginas em `pages/` + `src/assets/css/styles.css`

**problema:**
`data-center="Total\A ..."` esperava quebra de linha, mas escape css nao funciona dentro de `attr()`.

**impacto:**
os 7 donuts mostravam o texto cru `Total\A 8.742\A SKUs` no centro.

**correcao sugerida:**
usar quebra de linha real `&#10;` no atributo (o `white-space: pre` ja existente passa a atuar).

**status final:** okay

---

## erro 3 - tela branca permanente sem supabase configurado

**arquivo:** `src/js/core/supabase-client.js`

**problema:**
`createClient('', '')` lancava excecao, o modulo `auth.js` falhava e `.auth-ready` nunca era adicionada — toda pagina ficava com `opacity: 0`.

**impacto:**
rodando local com `config.js` vazio, o projeto inteiro parecia quebrado, sem mensagem.

**correcao sugerida:**
fallback com url/chave placeholder validas; o fluxo cai no login com erro controlado.

**status final:** okay

---

## erro 4 - doc duplicada e desatualizada na raiz

**arquivo:** `guia_visual_dashboard_compras(1).md` (removido)

**problema:**
copia antiga do `docs/reference/kv_dashboard_compras.md`, sem as secoes das paginas 7-10, com nome fora do padrao.

**impacto:**
duas fontes de verdade do design system.

**correcao sugerida:**
remover a copia; canonico e `docs/reference/kv_dashboard_compras.md`.

**status final:** okay

---

## erro 5 - home com matriz, kpis e donut conflitantes

**arquivo:** `index.html` + `src/assets/css/styles.css`

**problema:**
matriz somava 10.342 skus, kpi dizia 8.742 e o donut distribuia 8.742 com valores diferentes dos da matriz.

**impacto:**
tres componentes da mesma tela se contradiziam.

**correcao sugerida:**
manter ruptura 312 e excesso 1.128, ajustar linha "saudavel" e recalcular donut/legenda — tudo fechando 8.742.

**status final:** okay

**atualizacao 2026-07-02:** a matriz da home agora consome dados reais do sankhya via n8n (`src/js/pages/home.js`); o mock so aparece como fallback quando a api falha (com nota "Dados de exemplo" no card). kpis e donut seguem mockados — quando forem integrados, usar a mesma fonte para nao voltar a divergencia.

---

## erro 6 - donut de recebimento com fatia fantasma e total errado

**arquivo:** `src/modulos/compras/paginas/recebimento.html` + `src/assets/css/styles.css`

**problema:**
legenda somava 56, centro dizia 66 e havia 5a fatia roxa sem legenda.

**impacto:**
grafico apresentava dados que nao existiam.

**correcao sugerida:**
total 56, remover fatia roxa, recalcular percentuais.

**status final:** okay

---

## erro 7 - donut de produtos com soma que nao fechava

**arquivo:** `src/modulos/compras/paginas/produtos.html` + `src/assets/css/styles.css`

**problema:**
legenda somava 8.441 para um total de 8.742, com fatia roxa sem categoria.

**impacto:**
~301 produtos "fantasma" no grafico.

**correcao sugerida:**
"Inacabado" = 2.459, remover fatia roxa, recalcular gradiente.

**status final:** okay

---

## erro 8 - grafico de rupturas com 4 legendas e 3 linhas

**arquivo:** `src/modulos/compras/paginas/rupturas.html`

**problema:**
legenda listava Curva C, mas a polyline verde nao existia no svg.

**impacto:**
legenda orfa.

**correcao sugerida:**
adicionar a polyline verde da Curva C.

**status final:** okay

---

## erro 9 - donut de transferencias com duas fatias verdes ambiguas

**arquivo:** `src/modulos/compras/paginas/transferencias.html` + `src/assets/css/styles.css`

**problema:**
"Aprovada" e "Recebida" usavam o mesmo dot verde com dois verdes diferentes no gradiente.

**impacto:**
leitura ambigua.

**correcao sugerida:**
fatia "Recebida" em teal (`#14B8A6`) + classe `.dot.teal`.

**status final:** okay

---

## erro 10 - css morto

**arquivo:** `src/assets/css/styles.css`

**problema:**
seletores sem uso: `.chart`, `.chart-grid`, `.stack`, `.control .placeholder`, `.icon-box.yellow`, `.form-grid.single`, `.footer-note .refresh`, `.table .right`.

**impacto:**
ruido e risco de uso de padrao abandonado.

**correcao sugerida:**
remover os seletores mortos (tokens de design permanecem).

**status final:** okay

---

## erro 11 - css duplicado

**arquivo:** `src/assets/css/styles.css`

**problema:**
`.sidebar-footer` e `.sidebar-user` definidos 2x; tres media queries 1180px separadas.

**impacto:**
manutencao arriscada.

**correcao sugerida:**
consolidar definicoes e unificar media queries.

**status final:** okay

---

## erro 12 - lucide sem versao fixada

**arquivo:** todas as paginas html

**problema:**
`lucide@latest` podia trazer major com icones renomeados e quebrar o projeto sem deploy.

**impacto:**
risco de quebra silenciosa em producao.

**correcao sugerida:**
fixar `lucide@1.23.0` (umd verificado no pacote oficial).

**status final:** okay

---

## erro 13 - botao "olho" da senha decorativo

**arquivo:** `login.html`, `src/js/core/app.js`

**problema:**
icone de olho nao alternava a visibilidade da senha.

**impacto:**
ui prometia funcao inexistente.

**correcao sugerida:**
toggle generico `[data-toggle-password]` em `app.js` alternando `password/text` e icone `eye/eye-off`.

**status final:** okay

---

## erro 14 - sso com fallback de navegacao errado

**arquivo:** `login.html`

**problema:**
`.btn-sso` tinha `href="index.html"`; sem js, navegava para area interna.

**impacto:**
navegacao indevida como fallback.

**correcao sugerida:**
`href="#"` (handler js ja existente cobre o clique).

**status final:** okay

---

## erro 15 - links placeholder sem destino

**arquivo:** `login.html` (`#administrador`), `src/modulos/compras/paginas/recebimento.html` (`href="#"`)

**problema:**
ancoras sem destino ou handler.

**impacto:**
clique sem efeito.

**correcao sugerida:**
definir destino real (contato do administrador; tela completa de recebimentos previstos) — decisao de produto.

**status final:** pendente

---

## erro 16 - "lembrar acesso" e um enfeite

**arquivo:** `login.html`

**problema:**
o "checkbox" e um `<span>` estatico sem funcao.

**impacto:**
usuario acha que controla persistencia de sessao.

**correcao sugerida:**
implementar persistencia condicional de sessao ou remover o elemento — decisao de produto.

**status final:** pendente

---

## erro 17 - cor da serie excesso divergente da legenda

**arquivo:** `index.html`

**problema:**
polyline `#8B5CF6` com dot de legenda `#7C3AED`.

**impacto:**
mesma serie com duas cores no card.

**correcao sugerida:**
alinhar polyline ao `#7C3AED`.

**status final:** okay

---

## erro 18 - favicon ausente

**arquivo:** todas as paginas html

**problema:**
nenhuma pagina declarava favicon; 404 no console.

**impacto:**
erro em toda pagina; aba sem identidade.

**correcao sugerida:**
favicon svg em data-uri (carrinho azul) em todas as paginas.

**status final:** okay

---

## erro 19 - tabelas sem `scope` e checkboxes sem label

**arquivo:** todas as paginas com tabela

**problema:**
`<th>` sem `scope="col"`; checkboxes de linha sem nome acessivel.

**impacto:**
leitores de tela nao associavam celulas a colunas.

**correcao sugerida:**
adicionar `scope="col"` (103 ocorrencias) e `aria-label` nos checkboxes.

**status final:** okay

---

## erro 20 - filtros nao interativos (divs simulando selects)

**arquivo:** todas as paginas internas

**problema:**
`.control` e div nao focavel; sem teclado, sem estado real.

**impacto:**
filtros invisiveis para navegacao por teclado.

**correcao sugerida:**
transformar em componente interativo real quando a integracao de dados entrar (mudanca de componente global).

**status final:** pendente

---

## erro 21 - readme e resumo desatualizados

**arquivo:** `README.md`, `docs/architecture/resumo_projeto_dashboard_compras.md`

**problema:**
estrutura incompleta no readme; resumo apontava bug de sql ja corrigido e doc removida.

**impacto:**
documentacao mentia sobre o estado real.

**correcao sugerida:**
atualizar estrutura, docs e pendencias (refeito novamente apos a reorganizacao de pastas).

**status final:** okay

---

## erro 22 - higiene de codigo

**arquivo:** `src/js/settings/perfil.js`, `index.html`, `src/modulos/compras/paginas/budget.html`, `src/modulos/compras/paginas/sugestao-compra.html`

**problema:**
virgula sobrando em import; atributos `class=""` vazios.

**impacto:**
ruido de manutencao.

**correcao sugerida:**
limpar import e atributos vazios.

**status final:** okay

---

## erro 23 - preferencia "densidade da tabela" sem efeito

**arquivo:** `src/modulos/compras/paginas/configuracao.html`, `src/js/settings/configuracao.js`

**problema:**
valor e salvo mas nenhuma pagina aplica densidade compacta.

**impacto:**
configuracao que nao faz nada.

**correcao sugerida:**
criar variante css compacta de `.table` e aplicar via js no load de todas as paginas.

**status final:** pendente

---

## erro 24 - login sem fallback responsivo

**arquivo:** `src/assets/css/styles.css`

**problema:**
`.login-shell` fixava 35%/65% sem media query.

**impacto:**
formulario espremido em janela estreita.

**correcao sugerida:**
empilhar em coluna unica abaixo de 1024px ocultando o aside.

**status final:** okay

---

## erro 25 - bug `%%` em `raise exception` (sql)

**arquivo:** `supabase/sql/06_rpc_acoes.sql`

**problema:**
o resumo do projeto apontava `%%` em `aprovar_transferencia`.

**impacto:**
nenhum: verificado em 2026-07-02, todos os `raise exception` ja usam `%` — o bug ja havia sido corrigido antes desta auditoria.

**correcao sugerida:**
nenhuma; apenas o resumo foi atualizado para refletir isso.

**status final:** nao_aplicavel

---

## erro 26 - redirects do auth.js incompativeis com `pages/`

**arquivo:** `src/js/core/auth.js`

**problema:**
redirects relativos (`login.html`, `index.html`, `definir-senha.html`) quebravam a partir de paginas dentro de `pages/` apos a reorganizacao.

**impacto:**
logout, guarda de rota e roteamento de convite levariam a 404 nas paginas internas.

**correcao sugerida:**
prefixo `RAIZ` calculado pela url (`/pages/` -> `../`) aplicado em todos os redirects.

**status final:** okay

---

## erro 27 - estrutura de pastas plana na raiz

**arquivo:** raiz do projeto

**problema:**
13 html, docs datadas e resumo misturados na raiz; imagens em `assets/images`.

**impacto:**
navegacao e manutencao confusas; fora do padrao de organizacao.

**correcao sugerida:**
paginas internas em `pages/`, docs em `docs/`, imagens em `src/assets/img/`; login, index e definir-senha (fluxo de autenticacao) permanecem na raiz.

**status final:** okay

---

## erro 28 - vocabulario de prioridade inconsistente entre telas

**arquivo:** `src/modulos/compras/paginas/sugestao-compra.html`, `src/modulos/compras/paginas/rupturas.html`

**problema:**
"Urgente/Alta/Media" numa tela, "Critico/Urgente/Hoje" em outra (risco R8 da arquitetura).

**impacto:**
badge do frontend pode divergir do dado real na integracao.

**correcao sugerida:**
definir vocabulario unico com o time de produto antes da integracao.

**status final:** pendente

---

## erro 29 - estilos inline espalhados nos html

**arquivo:** varias paginas

**problema:**
`style=""` para grids, cores e paddings repetidos.

**impacto:**
manutencao fora do css central.

**correcao sugerida:**
migrar gradualmente para classes utilitarias em `styles.css`.

**status final:** pendente

---

## erro 30 - fallback silencioso para dados mockados

**arquivo:** `src/index.html`, `src/modulos/compras/paginas/*.html`, `src/js/pages/*.js`

**problema:**
conteudo estatico podia permanecer visivel quando a consulta ao Supabase falhava ou quando um componente nao tinha fonte de dados mapeada.

**impacto:**
valores, nomes, graficos e paginacoes de exemplo podiam ser interpretados como dados reais.

**correcao aplicada:**
criado `src/js/shared/data-state.js`; todas as telas operacionais passaram a usar estados explicitos de carregamento, vazio, indisponivel e erro. o html inicial foi limpo e o validador agora bloqueia regressao dos mocks historicos.

**status final:** okay
