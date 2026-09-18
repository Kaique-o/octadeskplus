# Decisões e relatórios de referência

Registro dos documentos que precisam ser consultáveis meses depois: as decisões estruturais — as que
custam caro para reverter — e os relatórios que estabelecem o estado do projeto numa data.

Convenção de nome: `AAAA-MM-DD-assunto.pdf`, pela data do documento.

| Data | Documento | Tipo | Situação |
| ---- | --------- | ---- | -------- |
| 31/08/2026 | [Repositório documental TI + RH](2026-08-31-repositorio-documental-ti-rh.pdf) — banco, object storage e camada de acesso | Decisão | Recomendada, não implantada |
| 31/08/2026 | [Relatório de evolução da plataforma](2026-08-31-relatorio-evolucao-plataforma.pdf) — 40 páginas, para diretoria | Prestação de contas | Emitido |
| 29/08/2026 | [Auditoria de segurança](2026-08-29-auditoria-seguranca.pdf) — 32 páginas, 12 achados | Auditoria | 9 dos 12 achados corrigidos |

## Cópias fixas × documentos vivos

Os três PDFs aqui são **fotografias de uma data**, e é assim que devem ser lidos. Dois deles têm uma
versão viva em outro lugar do repositório, que continua evoluindo:

| Cópia aqui | Fonte que continua evoluindo |
| ---------- | ---------------------------- |
| `2026-08-31-relatorio-evolucao-plataforma.pdf` | `docs/reports/relatorio-plataforma/` — editar `dados_relatorio.py` e rodar o gerador |
| `2026-08-29-auditoria-seguranca.pdf` | `docs/security-audit/` — editar `dados_auditoria.py` e rodar o gerador |

Regerar a fonte **não atualiza a cópia daqui**, e isso é proposital: o que foi entregue à diretoria em
31/08 continua sendo o que foi entregue em 31/08. Emissão nova entra como **linha nova** na tabela
acima, com a data nova — não sobrescreve a anterior.

O relatório de repositório documental não tem fonte viva: veio pronto e é registro definitivo da
decisão.

---

## 31/08/2026 — Repositório documental TI + RH

**Decisão em uma frase:** banco para regras e relacionamentos, object storage para arquivos, API para
autorização.

**Escolha:** PostgreSQL como fonte de verdade dos metadados e vínculos · Google Cloud Storage Standard
na região **São Paulo** para os arquivos · NestJS como Document Service responsável por autorização,
URLs assinadas, versionamento e auditoria. Nota ponderada **94,9/100**.

**Como foi decidido:** modelo multicritério de 100 pontos, com 10 alternativas avaliadas e pesos
explícitos — segurança 16%, residência/LGPD 12%, adequação relacional 13%, adequação a binários 13%,
escalabilidade 12%, custo/TCO 10%, complexidade operacional 8%, integração com a stack 8%,
versionamento 5%, portabilidade 3%. O estudo inclui **análise de sensibilidade**: quatro cenários
recalculados para mostrar quem venceria se os pesos mudassem.

**O ranking:**

| # | Alternativa | Nota | Leitura |
| - | ----------- | ---- | ------- |
| 1 | PostgreSQL + GCS (São Paulo) | 94,9 | **Recomendada** |
| 2 | PostgreSQL + AWS S3 (São Paulo) | 92,5 | Excelente alternativa |
| 3 | PostgreSQL + Azure Blob (Brasil) | 91,9 | Excelente alternativa |
| 4 | PostgreSQL + Cloudflare R2 | 90,5 | Excelente alternativa |
| 5 | Supabase + Supabase Storage | 89,4 | Viável |
| 6 | MongoDB + GCS | 87,9 | Viável |
| 7 | MongoDB + R2 | 83,4 | Viável |
| 8 | PostgreSQL + MinIO self-hosted | 83,0 | Viável |
| 9 | PostgreSQL Large Objects | 73,2 | Evitar como padrão |
| 10 | MongoDB GridFS | 71,6 | Evitar como padrão |

**O que a sensibilidade mostrou:** a recomendação é estável. GCS vence no cenário balanceado, no de
compliance/RH sensível e, por pequena margem, no de velocidade de implantação. **R2 só assume a
liderança quando custo/TCO sobe para 25% do peso total** — e a diferença entre GCS e R2 em 1 TB é da
ordem de poucos dólares por mês, menor que uma hora de engenharia gasta depurando multi-cloud.

**Quando revisar a decisão** (critérios registrados no próprio relatório, seção 20.1):

- Egress de arquivos virar item principal da fatura → reavaliar R2 para classes de alto download.
- A organização migrar infraestrutura inteira para AWS ou Microsoft → S3 ou Azure Blob ganham aderência.
- Exigência de on-premises ou soberania específica → avaliar MinIO ou storage privado.
- Volume chegar a dezenas ou centenas de TB → revisar classes, retenção e contratos de volume.
- MongoDB virar o banco principal da plataforma → reavaliar apenas o metadado, nunca os binários.
- Colaboração Office virar requisito central → integrar SharePoint/OneDrive como camada colaborativa.

**Roadmap proposto (sem migração big-bang):** Fundação (DocumentService, tabelas, bucket privado,
auditoria) → RH piloto → TI → segurança avançada (quarentena, antivírus, retenção, versionamento) →
migração do legado → busca e IA → otimização de custo.

**Regra de migração registrada:** não migrar todos os arquivos antes de validar autorização e
auditoria. O piloto precisa provar quem enxerga, quem baixa, como uma versão é criada, como se
restaura, como se elimina, como se audita e como se recupera de falha no meio do upload.

### Como isso se conecta ao resto do repositório

- É a fundamentação completa da **frente 6.1** do relatório de evolução da plataforma
  (`docs/reports/relatorio-plataforma/`), que apresenta a mesma conclusão em versão executiva.
- O modelo de dados proposto (`documents`, `document_versions`, `document_links`, `document_events`)
  é o mesmo descrito lá, e vale para **qualquer módulo** — não só RH e TI.
- A regra de acesso repete o princípio que já vale para o Supabase hoje: **o navegador nunca recebe
  acesso direto ao armazenamento**; a API valida, audita e emite uma URL assinada de curta duração.

### Estado

**Recomendada, não implantada.** Nada disso existe no código hoje. O `dashboard-v2` continua no
Supabase, sem repositório de arquivos. Este documento registra a direção acordada, não o que está no ar.

---

## 31/08/2026 — Relatório de evolução da plataforma

Prestação de contas do período **01/07 a 31/08/2026**, escrito para diretoria e gestão. 40 páginas.

Cobre as cinco etapas do período — migração para React, dado real no Supabase, escala multimódulo,
front-end dos módulos e o levantamento de segurança — e as cinco frentes abertas: novo banco e
datalake, WhatsApp, backend dos módulos, DNS e ações de escrita no Sankhya.

**Por que está aqui:** é o documento que estabelece o estado acordado do projeto numa data, e a
referência para "o que tinha sido combinado" em qualquer discussão posterior de escopo ou prazo. A
seção 6.1 dele é a versão executiva da decisão de repositório documental registrada acima.

**Fonte viva:** `docs/reports/relatorio-plataforma/`.

---

## 29/08/2026 — Auditoria de segurança

Revisão de segurança completa do repositório na branch `seguranca`. 32 páginas, **12 achados**
(1 crítica, 3 altas, 2 médias, 3 baixas, 3 informativas) e **15 controles confirmados como corretos**.

**Escopo auditado:** as 38 alterações de banco, as duas Cloudflare Pages Functions, toda a árvore
`src/`, os validadores de `scripts/`, os 14 workflows de ingestão, os arquivos de publicação e o
histórico do git (3.278 objetos), à procura de segredos commitados.

**Estado:** 9 dos 12 achados corrigidos na própria branch. Os 3 restantes não fecham só com código e
estão registrados com dono e forma de verificar em `docs/security-audit/pendencias-externas.md` —
autenticação no webhook da Skyler (alta), persistência de `conversa_id` (baixa) e a decisão sobre
rotacionar a chave anon (informativa).

**Atenção ao ler:** o PDF descreve o estado **antes** das correções. É o registro da auditoria, não
do código atual — e é justamente por isso que ele vale como documento de referência.

**Fonte viva:** `docs/security-audit/`.
