# Índice da documentação

## Leitura obrigatória

1. `../llm.md` — documento canônico: regras para qualquer alteração no
   repositório;
2. `../CLAUDE.md` — o mesmo contrato, no formato lido por agentes de IA;
3. `ai/design-system.md` — tema, tokens e tipografia;
4. `ai/componentes.md` — catálogo de componentes e padrão de estado de consulta;
5. `ai/boas-praticas.md` — convenções de código e checklist antes de finalizar;
6. `ai/backend.md` — contrato atual do backend;
7. `ai/diagramas.md` — fluxo de navegação e de arquivos;
8. auditoria e plano de ação mais recentes em `audits/`.

## Diretórios

| diretório         | conteúdo                                               |
| ----------------- | ------------------------------------------------------ |
| `ai/`             | design system, componentes, backend e boas práticas    |
| `architecture/`   | arquitetura vigente e decisões técnicas                |
| `operations/`     | deploy, manutenção, migração e procedimentos           |
| `implantacao/`    | ordem de aplicação, credenciais e estado de publicação |
| `integration/`    | n8n, payloads e consultas de origem                    |
| `handoff/`        | pendências passadas adiante entre times                |
| `data-contracts/` | planilhas e contratos de dados                         |
| `reference/`      | key visual, referências e mockups                      |
| `audits/`         | auditorias e planos de ação históricos                 |
| `reports/`        | evidências de validação por tema e versão              |

## Convenções

- relatórios de release ficam em `reports/releases/<versão>/` e **não** devem
  voltar para a raiz do repositório — `npm run validate` bloqueia `RELATORIO_*.md`
  na raiz;
- documentos anteriores à migração para React descrevem a estrutura multipágina
  (`src/js/`, `scripts/build.js`, `src/assets/css/styles.css`), que foi removida
  do repositório. Eles trazem um aviso de documento histórico no topo e servem
  como registro datado, não como instrução;
- em caso de divergência entre qualquer documento e o código, vale o `llm.md` e
  o código.
