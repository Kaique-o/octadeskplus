> **DOCUMENTO HISTÓRICO — NÃO IMPLEMENTAR COMO ARQUITETURA ATUAL**
>
> Este plano registra a integração direta navegador → webhook n8n usada em 02/07/2026. Ela foi substituída por frontend → RPC Supabase e ingestão n8n → Supabase. O contrato atual está em `docs/integration/guia_endpoints_n8n.md`. Mock como fallback e `DASHBOARD_ENDPOINTS` não fazem parte do código atual.

# plano de acao integracao n8n home

status geral: **concluido em 2026-07-02** (incluindo publicacao no github via web ui — ver etapa git).

## leitura e diagnostico

- [x] ler `llm.md`
- [x] ler arquivos da pasta `skill.md` (`llm.design.md`, `llm.componentes.md`, `llm.boaspraticas.md`, `llm.backend.md`, `llm.diagrama.md`)
- [x] ler docs do projeto (`README.md`, `docs/reference/kv_dashboard_compras.md`, `docs/operations/instrucoes_atualizacao.md`)
- [x] localizar arquivos da home (`index.html` na raiz; css em `src/assets/css/styles.css`; js em `src/js/core/app.js` + `src/js/core/auth.js`)
- [x] localizar dados mockados da matriz (matriz curva x status em `index.html`, valores fixos no html)

## n8n

- [x] acessar n8n (Kai logou no chrome; navegacao assumida pela extensao)
- [x] localizar fluxo `Kaique - site compra skyline`
- [x] analisar estrutura do fluxo existente (webhook GET `compra/produtos` → auth sankhya `/authenticate` → `DbExplorerSP.executeQuery` via gateway → code → respond json)
- [x] mapear autenticacao e endpoint usado (bearer via client_id/client_secret + X-Token; `https://api.sankhya.com.br/gateway/v1/mge/service.sbr?serviceName=DbExplorerSP.executeQuery&outputType=json`)
- [x] criar fluxo novo baseado no existente: **`Kaique - dashboard compras home radar estoque`** (id `BvW0ppANQc9TMqc6`), duplicado do original — credenciais reutilizadas sem exposicao
- [x] configurar payload `DbExplorerSP.executeQuery` com o sql agregado (curva x status x count)
- [x] testar endpoint do fluxo (publicado; versoes v1→v3)
- [x] validar retorno json (`{success, updated_at, data:[{curva_status, status_estoque_principal, quantidade_skus}]}`)
- [x] liberar CORS no respond node (`Access-Control-Allow-Origin: *`) — validado a partir de `dashboard-compras.pages.dev`

endpoint final de producao:

```txt
GET https://automacao.skylinemobile.com.br/webhook/dashboard-compras/home-radar-estoque
```

## frontend

- [x] criar funcao para buscar dados reais da matriz (`fetch_home_stock_radar` em `src/js/pages/home.js`)
- [x] area centralizada de endpoints (`DASHBOARD_ENDPOINTS` em `src/js/pages/home.js`)
- [x] transformar retorno em agregacao por curva e status (`agregarMatriz`)
- [x] atualizar matriz visual da home (render dinamico da `.matrix`, colunas dinamicas por curva presente, heatmap e icones do design system)
- [x] criar fallback para erro de api (mock do html permanece; nota "Dados de exemplo (API indisponivel)" no card)
- [x] manter layout seguindo design system (nenhuma classe/cor nova; usa `heat-*`, `status-cell`, `num`, `footer-note`)
- [x] cards/kpis da home: mantidos mockados (fora do escopo deste endpoint; ver pendencias)
- [x] teste de integracao real: home publicada renderizou a matriz com dados do sankhya (base atual: 862 SKUs, tudo curva D x Ruptura — base sem vendas/estoque)

## supabase

- [x] verificar supabase: **nao necessario para esta alteracao** — a home consome o n8n direto; nao existe tabela/configuracao de endpoint no supabase (conferido via lista de tabelas do projeto `hldeqhkcnbywtorijhvl` em 2026-07-02; tabelas de negocio seguem vazias aguardando pipeline de ingestao)

## git

- [x] validar alteracoes locais (sintaxe `home.js` ok; integracao testada na home publicada)
- [x] testar paginas (home renderizada com dados reais e com fallback; console sem erros)
- [x] commitar alteracoes — a pasta local nao e repositorio git, entao os arquivos foram commitados **pela web ui do github** (repo `Kaique-o/dashboard-compras`, sessao do Kai no chrome), em 4 commits na `main`: `e0e87cb` (raiz: README + index), `9cb196a` (src/js/pages/home.js), `f26ba5a` (docs: 7 arquivos), `7710ef7` (skill.md: llm.backend + llm.diagrama)
- [x] subir atualizacoes no repositorio — deploy automatico do cloudflare pages validado: `https://dashboard-compras.pages.dev` servindo `home.js` e a home mostrando "Dados reais (Sankhya via n8n)" na matriz
- observacao: a pasta local `Compras` continua sem `.git`; se quiser versionar direto dela, clonar o repo e substituir a pasta (ou copiar os arquivos para um clone)

## decisoes tecnicas registradas

1. **sql agregado no n8n**: a home so precisa da matriz, entao o sql base foi encapsulado em `SELECT curva, status, COUNT(*) ... GROUP BY` — payload pequeno e rapido. o sql original (detalhado por SKU) fica guardado em `docs/integration/sql_radar_curva_estoque.sql` para quando for necessario endpoint detalhado.
2. **filtro `AD_MACROGRUPO2` removido**: a coluna nao existe na TGFPRO deste Sankhya (verificado via `ALL_TAB_COLUMNS`; nao existe nenhuma coluna `%MACRO%` no banco). decisao do Kai (2026-07-02): "remover o filtro por ora". as 10 ocorrencias foram removidas. sql publicado: `docs/integration/sql_radar_curva_estoque_efetivo_n8n.sql`.
3. **nomes de node mantidos** (`receber_busca_produtos` etc.) no fluxo duplicado para preservar a expressao de referencia do bearer; o que muda e: path do webhook, jsonBody (sql), jsCode (normalizacao) e responseBody + headers CORS.
4. **mock preservado no html como fallback** documentado; em falha de api aparece nota "Dados de exemplo (API indisponivel no momento)" no card da matriz.

## pendencias

1. **filtro macrogrupo2**: quando o campo `AD_MACROGRUPO2` for criado no dicionario do Sankhya (ou a regra "macrogrupo2 < 4" for definida sobre outra coluna), reaplicar o filtro no sql do node `consultar_produtos_livre` do fluxo novo e republicar.
2. **kpis e demais cards da home** continuam mockados — proximos endpoints podem seguir o mesmo padrao (novo fluxo n8n + entrada em `DASHBOARD_ENDPOINTS`).
3. a base sankhya atual retorna so 1 combinacao (D x Ruptura, 862 SKUs) por falta de vendas/estoque na base — com dados de producao a matriz preenche sozinha, sem mudanca de codigo.
