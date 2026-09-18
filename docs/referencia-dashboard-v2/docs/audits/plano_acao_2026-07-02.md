# plano de acao - 2026-07-02

checklist derivada da `auditoria_erros_2026-07-02.md`. marcar `[x]` somente apos correcao real.

## estrutura e documentacao

- [x] remover `guia_visual_dashboard_compras(1).md` (duplicata desatualizada; canonico = `docs/reference/kv_dashboard_compras.md`) (erro 4)
- [x] criar `llm.md` na raiz
- [x] criar pasta `docs/ai/` com `llm.design.md`, `llm.componentes.md`, `llm.boaspraticas.md`, `llm.backend.md`, `llm.diagrama.md`
- [x] atualizar `README.md` (estrutura completa: docs, mockups, llm.md, skill.md) (erro 19)
- [x] atualizar `resumo_projeto_dashboard_compras.md` (bug %% ja corrigido; referencia da doc duplicada) (erro 19)

## layout e html

- [x] trocar icone `circle-a` por `award` em `rupturas.html` e `produtos.html` (erro 1)
- [x] corrigir `\A` literal nos `data-center` dos 7 donuts (usar `&#10;`) (erro 2)
- [x] alinhar dados da home: matriz x kpi x donut fechando 8.742 (erro 5)
- [x] corrigir donut de recebimento (total 56, remover fatia fantasma) (erro 6)
- [x] corrigir donut de produtos (inacabado 2.459, remover fatia fantasma) (erro 7)
- [x] adicionar linha da Curva C em "evolucao das rupturas" (erro 8)
- [x] diferenciar fatias Aprovada/Recebida no donut de transferencias (teal + `.dot.teal`) (erro 9)
- [x] alinhar cor da serie Excesso ao dot da legenda na home (erro 16)
- [x] adicionar favicon svg em todas as 13 paginas (erro 17)
- [x] adicionar `scope="col"` nos `<th>` e `aria-label` nos checkboxes de linha (erro 18)
- [x] limpar `class=""` vazios em `index.html`, `budget.html` e `sugestao-compra.html` (erro 20)
- [x] `.btn-sso` do login com `href="#"` (erro 14)

## css

- [x] remover css morto: `.chart`, `.chart-grid`, `.stack`, `.control .placeholder`, `.icon-box.yellow`, `.form-grid.single`, `.footer-note .refresh`, `.table .right` (erro 10)
- [x] consolidar `.sidebar-footer` e `.sidebar-user` duplicados e unificar media queries 1180px (erro 11)
- [x] atualizar gradiente base `.donut`, `.donut.receiving` e `.donut.quality` com os numeros corrigidos (erros 5-7)
- [x] criar `.dot.teal` (erro 9)
- [x] fallback responsivo do login abaixo de 1024px (erro 21)

## javascript

- [x] fallback de supabase nao configurado sem tela branca (`supabase-client.js`) (erro 3)
- [x] toggle mostrar/ocultar senha no login (`app.js` + `login.html` via `data-toggle-password`) (erro 13)
- [x] limpar virgula sobrando no import de `perfil.js` (erro 20)
- [x] fixar versao do lucide (`@latest` -> `1.23.0`, umd verificado no pacote oficial) nas 13 paginas (erro 12)

## validacao final

- [x] conferir links da sidebar nas 13 paginas (menu identico, item ativo correto, todos os href existem)
- [x] validar html/css/js (parser html ok nas 13 paginas, 83 icones conferidos no lucide 1.23.0, node --check ok, css balanceado e sem classe orfa)
- [x] conferir consistencia visual (sem notificacao no header, usuario abaixo de configuracao, sem "recolher menu")
- [x] conferir arquivos md criados e plano atualizado (donuts e matriz da home fecham matematicamente)

## pendencias registradas (sem correcao nesta rodada — motivo)

- [ ] "lembrar acesso" real no login — decisao de produto (persistencia condicional de sessao) (erro 15)
- [ ] destino real de `#administrador` (login) e "ver todos os recebimentos previstos" (recebimento) — falta definicao de produto (erro 14)
- [ ] filtros `.control` interativos/focaveis de verdade — mudaria componente global; planejar junto com integracao de dados (erro 18)
- [ ] aplicar efeito real da preferencia "densidade da tabela" — exige css compacto + js em todas as paginas (erro 20)
- [ ] unificar vocabulario de prioridade entre telas — risco R8 da arquitetura, decisao de produto
- [ ] reduzir estilos inline dos html movendo para classes utilitarias — refatoracao gradual

## reorganizacao de pastas (2026-07-02, segunda rodada)

- [x] mover as 10 telas internas para `pages/` (incluindo configuracao e perfil)
- [x] manter `login.html`, `definir-senha.html` e `index.html` na raiz (fluxo de autenticacao do supabase depende da raiz)
- [x] renomear `assets/images/` para `src/assets/img/`
- [x] mover docs datadas e resumo para `docs/`
- [x] corrigir links relativos de css/js/navegacao nas paginas movidas e na home
- [x] adicionar prefixo `RAIZ` nos redirects de `auth.js` (logout, guarda de rota, convite/recuperacao)
- [x] criar `docs/audits/relatorio_erros.md` com status final (okay/pendente/nao_aplicavel)
- [x] criar `docs/operations/instrucoes_atualizacao.md`
- [x] atualizar `docs/ai/boas-praticas.md` (organizacao de pastas e links relativos)
- [x] atualizar `docs/ai/diagramas.md` e `docs/ai/componentes.md` com os novos caminhos
- [x] atualizar `llm.md` e `README.md` com a nova estrutura
