# Relatório de evolução da plataforma — Skytech

Relatório executivo do período **01/07/2026 a 31/08/2026**, escrito para **diretoria e gestão**.
Conta o que foi entregue (migração para React → dado real no Supabase → escala multimódulo →
front-end dos módulos → levantamento de segurança) e o que falta (novo banco e datalake, WhatsApp,
backend dos módulos, DNS e ações de escrita no Sankhya).

| Arquivo                              | O que é                                                                          |
| ------------------------------------ | -------------------------------------------------------------------------------- |
| `relatorio-plataforma-skytech.pdf`   | O relatório entregue (40 páginas, A4).                                           |
| `dados_relatorio.py`                 | Fonte de verdade de todo o texto, tabelas e listas. **É aqui que se edita.**     |
| `gerar_relatorio.py`                 | Só apresentação: capa, paginação, tabelas, selos e os cinco gráficos.            |
| `graficos/`                          | PNGs gerados pelo script. Regerados a cada execução.                             |

## Regerar

Reusa o ambiente isolado da auditoria de segurança (`reportlab`, `matplotlib`, `pymupdf` já
instalados lá; nada é instalado globalmente):

```bash
docs/security-audit/.venv/Scripts/python.exe docs/reports/relatorio-plataforma/gerar_relatorio.py
```

Se o `.venv/` não existir (clone novo):

```bash
python -m venv docs/security-audit/.venv && docs/security-audit/.venv/Scripts/python.exe -m pip install reportlab matplotlib pymupdf
```

No Linux/macOS, troque `.venv/Scripts/python.exe` por `.venv/bin/python`.

## Como editar

Todo o conteúdo vive em `dados_relatorio.py`, organizado em listas nomeadas: `NUMEROS` (cartões de
abertura), `RESUMO`, `FASES` (as cinco etapas, cada uma com `corpo`, `destaques` e `commits`),
`MODULOS`, `ACHADOS`, `PENDENCIAS`, `PONTOS_FORTES`, `FRENTES` (as cinco frentes abertas),
`MATRIZ_BANCO`, `TABELAS_DATALAKE`, `SEQUENCIA`, `RISCOS`, `MIGRATIONS` e `GLOSSARIO`.

O texto aceita a marcação leve do reportlab: `<b>`, `<i>`, `<br/>`, `<font face="Courier">`.

Acrescentar item a qualquer uma dessas listas já atualiza sozinho o que depende dela — os gráficos,
as contagens do resumo e as tabelas se refazem a partir dos dados. Os únicos números escritos à mão
são os de `NUMEROS`; os demais (12 achados, 15 controles, 53 telas, 38 migrations) são derivados.

## Verificar depois de gerar

```bash
docs/security-audit/.venv/Scripts/python.exe -c "import pymupdf; d=pymupdf.open('docs/reports/relatorio-plataforma/relatorio-plataforma-skytech.pdf'); print(d.page_count, d[0].rect)"
```

## Fontes do conteúdo

- Histórico do repositório (222 commits entre 01/07 e 31/08/2026).
- `docs/security-audit/` — a auditoria de 29/08/2026: 12 achados, 15 controles confirmados.
- `docs/security-audit/pendencias-externas.md` — os 3 achados que não fecham só com código.
- Estudo de arquitetura documental TI + RH (site estático, 28/08/2026), origem da seção 6.1:
  matriz de decisão de banco, estrutura do datalake documental e o comparativo de custo.
