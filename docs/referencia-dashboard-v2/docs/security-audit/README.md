# Auditoria de segurança — dashboard-v2

Relatório da revisão de segurança feita na branch `seguranca`, em 29/08/2026.

| Arquivo                             | O que é                                                                                                       |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `relatorio-auditoria-seguranca.pdf` | O relatório entregue (32 páginas, A4).                                                                        |
| `dados_auditoria.py`                | Fonte de verdade dos achados, pontos fortes e recomendações. **É aqui que se edita.**                         |
| `gerar_relatorio.py`                | Só apresentação: gráficos, paginação, tabelas e o bloco de issues.                                            |
| `graficos/`                         | PNGs gerados pelo script (rosca por severidade, barras por categoria). Regerados a cada execução.             |
| `mapa-graficos-payload.md`          | Mapa das 83 chaves do `CATALOGO` para o payload das RPCs (referência do achado nº 5). Gerado a partir do SQL. |
| `pendencias-externas.md`            | Os 3 achados que não fecham só com código (n8n, `conversa_id`, rotação da chave anon).                        |
| `.venv/`                            | Ambiente isolado, fora do controle de versão. Nada é instalado globalmente.                                   |

## Regerar o relatório

O ambiente já existe. Basta:

```bash
docs/security-audit/.venv/Scripts/python.exe docs/security-audit/gerar_relatorio.py
```

Se o `.venv/` não existir (clone novo), recrie antes:

```bash
python -m venv docs/security-audit/.venv && docs/security-audit/.venv/Scripts/python.exe -m pip install reportlab matplotlib pymupdf
```

No Linux/macOS, troque `.venv/Scripts/python.exe` por `.venv/bin/python`.

`pymupdf` é usado só para conferir o PDF gerado (contagem de páginas e rasterização
para inspeção visual); `reportlab` e `matplotlib` são o que de fato monta o documento.

## Correções aplicadas

Os 12 achados foram corrigidos na branch `seguranca`. Onde vive cada correção:

| Achado                                | Onde                                                                                 |
| ------------------------------------- | ------------------------------------------------------------------------------------ |
| 1 — RPCs de widget sem guarda/owner   | `supabase/migrations/20260829100000_seguranca_rpcs_widgets_owner_e_guarda.sql`       |
| 2 e 3 — delegação de permissões       | `supabase/migrations/20260829110000_seguranca_delegacao_permissoes.sql`              |
| 5 — permissão por gráfico no servidor | `supabase/migrations/20260829120000_permissoes_por_grafico_no_servidor.sql`          |
| 2 e 6 — sessão e modo debug           | `AuthProvider.jsx`, `ProtectedRoute.jsx`, `PermissionsProvider.jsx`, `DebugMenu.jsx` |
| 4, 7 e 9 — proxy da Skyler            | `functions/api/skyler/chat.js`                                                       |
| 8 — CSP por hash                      | `public/_headers`                                                                    |
| 11 — gate de segurança                | `scripts/check-security.js` (reescrito: varre todas as migrations)                   |
| 12 — worker do MSW no build           | `vite.config.mjs`                                                                    |
| 4, 7 e 10 — pendências externas       | `pendencias-externas.md`                                                             |

Testes: `supabase/tests/09_smoke_rpcs_widgets_e_graficos.sql` (precisa de Docker, roda por
`npm run test:db:fresh`), `src/app/acesso-protegido.test.jsx`, `src/plataforma/debug/DebugMenu.test.jsx`
e `scripts/test-cloudflare-worker.mjs`.

O relatório em PDF descreve o estado **antes** das correções — é o registro da auditoria, não o do
código atual.

## Como editar

Todo o conteúdo do relatório vive em `dados_auditoria.py`. Cada achado é um dicionário
com `sev`, `cat`, `titulo`, `arquivos` (lista de `caminho:linha`), `codigo`, `porque`,
`impacto`, `correcao`, `aceite` e `condicoes`. O texto aceita marcação leve do reportlab
(`<b>`, `<i>`, `<br/>`, `<font face="Courier">`), que é convertida para Markdown
automaticamente na seção de issues do GitHub — não é preciso escrever o texto duas vezes.

Adicionar um achado novo à lista `ACHADOS` já atualiza sozinho: os dois gráficos, a
contagem do resumo executivo, a tabela-índice, o detalhamento por categoria e as issues.

Agrupamento de issues: `montar_issues()` decide quais achados saem juntos (hoje 8+9 e
10+12, por serem do mesmo tema e de baixo impacto). Achado novo entra na lista
`individuais` a menos que faça sentido agrupar.

## Verificação do PDF

Depois de gerar, vale conferir páginas e transbordo de margem:

```bash
docs/security-audit/.venv/Scripts/python.exe -c "import pymupdf; d=pymupdf.open('docs/security-audit/relatorio-auditoria-seguranca.pdf'); print(d.page_count, d[0].rect)"
```
