# Guia visual do dashboard de compras

> **Documento historico.** Descreve a estrutura multipagina anterior a migracao
> para React (`src/js/`, `scripts/build.js`, `src/assets/css/styles.css`), que foi
> removida do repositorio. Vale como registro datado, nao como instrucao.
> Para o estado atual, ver `llm.md` e `docs/ai/`.

## 1. conceito visual geral

O estilo é um **SaaS clean corporativo**, leve, moderno e focado em leitura rápida.

A ideia principal:

- fundo quase branco;
- cards brancos;
- pouca sombra;
- bordas suaves;
- azul como cor principal;
- vermelho apenas para problema real;
- verde para status saudável;
- laranja para alerta;
- roxo para informação secundária;
- tabelas densas, mas com respiro visual.

Não é dashboard escuro.  
Não é visual gamer.  
Não é cheio de glow.  
Não usa gradiente pesado.  
É um painel técnico de compras com foco em decisão operacional.

---

## 2. paleta de cores

### 2.1 cores base

| uso                |                 cor |       hex |
| ------------------ | ------------------: | --------: |
| fundo principal    |         branco frio | `#F8FAFC` |
| fundo secundário   |                gelo | `#F1F5F9` |
| card principal     |         branco puro | `#FFFFFF` |
| borda leve         | cinza azulado claro | `#E2E8F0` |
| divisor interno    |   cinza muito claro | `#EEF2F7` |
| texto principal    |          azul preto | `#0F172A` |
| texto secundário   |       cinza azulado | `#475569` |
| texto fraco        |         cinza médio | `#94A3B8` |
| texto desabilitado |         cinza claro | `#CBD5E1` |

### 2.2 cor primária

| uso              |             cor |       hex |
| ---------------- | --------------: | --------: |
| azul principal   |       azul vivo | `#2563EB` |
| azul hover       | azul mais forte | `#1D4ED8` |
| azul ativo claro |  azul bem claro | `#EFF6FF` |
| azul borda ativo |      azul claro | `#BFDBFE` |
| azul ícone claro |      azul claro | `#DBEAFE` |

### 2.3 cores de status

| status            | cor principal | fundo claro |     borda |
| ----------------- | ------------: | ----------: | --------: |
| ruptura / crítico |     `#EF4444` |   `#FEF2F2` | `#FECACA` |
| urgente           |     `#F43F5E` |   `#FFF1F2` | `#FDA4AF` |
| alerta / atenção  |     `#F59E0B` |   `#FFFBEB` | `#FDE68A` |
| médio             |     `#F97316` |   `#FFF7ED` | `#FED7AA` |
| saudável / ok     |     `#22C55E` |   `#F0FDF4` | `#BBF7D0` |
| informativo       |     `#0EA5E9` |   `#F0F9FF` | `#BAE6FD` |
| roxo auxiliar     |     `#7C3AED` |   `#F5F3FF` | `#DDD6FE` |
| teal / cobertura  |     `#14B8A6` |   `#F0FDFA` | `#99F6E4` |

### 2.4 paleta para gráficos

| série    |       cor |
| -------- | --------: |
| comprado | `#2563EB` |
| CMV      | `#22C55E` |
| ruptura  | `#EF4444` |
| crítico  | `#F97316` |
| atenção  | `#F59E0B` |
| saudável | `#22C55E` |
| excesso  | `#8B5CF6` |
| neutro   | `#64748B` |

---

## 3. tipografia

### 3.1 fonte principal

Usar:

```css
font-family: Inter, 'Segoe UI', Roboto, Arial, sans-serif;
```

Motivo: a fonte Inter funciona muito bem para dashboards porque mantém boa leitura em números, tabelas, cards e menus.

### 3.2 fonte secundária

Para números grandes e indicadores:

```css
font-family: Inter, 'Segoe UI', Roboto, Arial, sans-serif;
font-variant-numeric: tabular-nums;
```

O `tabular-nums` é importante para alinhar valores como:

- `R$ 5,83 mi`;
- `8.742`;
- `312`;
- `-256`.

### 3.3 tamanhos recomendados

| elemento           |         tamanho |  peso |
| ------------------ | --------------: | ----: |
| título da página   |          `28px` | `700` |
| título de card     |          `15px` | `600` |
| label de filtro    |          `13px` | `500` |
| texto de tabela    |          `13px` | `500` |
| header de tabela   |          `12px` | `600` |
| KPI grande         | `28px` a `32px` | `700` |
| KPI pequeno        |          `13px` | `500` |
| legenda de gráfico |          `12px` | `500` |
| sidebar item       |          `15px` | `500` |
| badge / pill       |          `12px` | `600` |

### 3.4 cor de texto

```css
--text-primary: #0f172a;
--text-secondary: #475569;
--text-muted: #94a3b8;
--text-disabled: #cbd5e1;
```

---

## 4. branco, cinza e fundo

### 4.1 regra principal

O dashboard não deve usar branco puro no fundo geral.  
O branco puro fica apenas nos cards.

```css
--page-bg: #f8fafc;
--surface: #ffffff;
--surface-soft: #f1f5f9;
--border: #e2e8f0;
--divider: #eef2f7;
```

### 4.2 aplicação

| área               |       cor |
| ------------------ | --------: |
| body               | `#F8FAFC` |
| sidebar            | `#FFFFFF` |
| cards              | `#FFFFFF` |
| input              | `#FFFFFF` |
| hover de linha     | `#F8FAFC` |
| header de tabela   | `#F8FAFC` |
| item ativo sidebar | `#EFF6FF` |

---

## 5. curvatura dos componentes

A interface usa curvatura suave, sem botões exageradamente arredondados.

| componente       | border-radius |
| ---------------- | ------------: |
| card grande      |        `16px` |
| KPI card         |        `16px` |
| input / select   |        `10px` |
| botão            |        `10px` |
| badge / pill     |         `6px` |
| avatar           |       `999px` |
| ícone circular   |       `999px` |
| sidebar item     |        `10px` |
| tabela container |        `16px` |
| linhas internas  |         `0px` |

Não usar botão muito redondo tipo pill exagerada.  
O máximo arredondado deve ser badge pequena, avatar ou ícone circular.

---

## 6. sombra e borda

### 6.1 sombra padrão de card

```css
box-shadow: 0 8px 24px rgba(15, 23, 42, 0.04);
border: 1px solid #e2e8f0;
```

### 6.2 sombra hover

```css
box-shadow: 0 12px 32px rgba(15, 23, 42, 0.08);
```

### 6.3 regra

Cards sempre têm:

- fundo branco;
- borda leve;
- sombra quase invisível;
- nada de glow;
- nada de sombra preta pesada.

---

## 7. espaçamento e diagramação

### 7.1 grid geral desktop

Proporção usada nas imagens: **4:3**.

Layout sugerido:

```css
.app {
  display: grid;
  grid-template-columns: 240px 1fr;
  min-height: 100vh;
}
```

### 7.2 sidebar

```css
width: 240px;
padding: 24px 16px;
```

### 7.3 main

```css
padding: 28px 32px;
```

### 7.4 distância entre blocos

| bloco                   |             gap |
| ----------------------- | --------------: |
| entre filtros           |          `16px` |
| entre cards KPI         |          `16px` |
| entre seções            |          `20px` |
| dentro de card          |          `20px` |
| entre título e conteúdo |          `16px` |
| linha de tabela         | `52px` a `60px` |

### 7.5 largura dos cards

KPIs em desktop:

```css
grid-template-columns: repeat(5, 1fr);
gap: 16px;
```

Para home com 6 cards:

```css
grid-template-columns: repeat(6, 1fr);
gap: 16px;
```

---

## 8. hierarquia visual

### 8.1 ordem de leitura

1. menu lateral;
2. título da página;
3. filtros principais;
4. KPIs;
5. componente principal da página;
6. gráficos auxiliares;
7. tabelas secundárias / rodapé.

### 8.2 regra de peso visual

O componente principal da tela deve ocupar mais espaço.

| página          | componente principal         |
| --------------- | ---------------------------- |
| home            | matriz curva x status        |
| sugestão compra | tabela dinâmica              |
| budget          | gráfico CMV x comprado       |
| transferências  | tabela de transferências     |
| excesso         | tabela de excesso + gráficos |
| rupturas        | tabela de ruptura            |

Não deixar todo card com o mesmo peso visual, senão a tela perde hierarquia.

---

## 9. sidebar

### 9.1 comportamento visual

Item ativo:

```css
background: #eff6ff;
color: #2563eb;
font-weight: 600;
```

Item normal:

```css
color: #334155;
```

Hover:

```css
background: #f8fafc;
color: #2563eb;
```

### 9.2 estrutura

Cada item:

```css
height: 48px;
padding: 0 14px;
border-radius: 10px;
display: flex;
align-items: center;
gap: 12px;
```

Ícone:

```css
width: 20px;
height: 20px;
stroke-width: 1.8;
```

---

## 10. cards KPI

### 10.1 estrutura recomendada

Cada KPI precisa ter:

- ícone colorido;
- label;
- valor principal;
- comparativo pequeno;
- seta de tendência.

### 10.2 exemplo CSS

```css
.kpi-card {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 16px;
  padding: 18px;
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.04);
}

.kpi-icon {
  width: 40px;
  height: 40px;
  border-radius: 999px;
  display: grid;
  place-items: center;
}

.kpi-label {
  font-size: 13px;
  font-weight: 600;
  color: #334155;
}

.kpi-value {
  margin-top: 14px;
  font-size: 28px;
  font-weight: 700;
  color: #0f172a;
  letter-spacing: -0.02em;
}

.kpi-trend {
  margin-top: 8px;
  font-size: 12px;
  color: #64748b;
}
```

### 10.3 card-tag (identificador de componente)

Todo card, gráfico e tabela tem uma marcação discreta `i` no canto inferior **direito**. Serve como referência interna para saber qual componente é qual na hora de ligar dados reais — não é conteúdo para o usuário final.

- classe `.card-tag`, posicionado `absolute; right:10px; bottom:8px`
- ícone lucide `info` em `.icon-xs` (11px)
- opacidade `0.45` em repouso, `1` no hover (cor muda para azul primário)
- o nome do componente aparece num tooltip customizado (`.card-tag-label`) ao passar o mouse — balão escuro acima do ícone, não é o tooltip nativo do navegador
- também tem `aria-label` com o mesmo texto, pra acessibilidade/teclado (`tabindex="0"`)
- é sempre o último elemento dentro do `.card`/`.kpi-card`, para não interferir na ordem de leitura do conteúdo

```css
.card-tag {
  position: absolute;
  right: 10px;
  bottom: 8px;
  width: 16px;
  height: 16px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  color: #94a3b8;
  opacity: 0.45;
  cursor: help;
}

.card-tag:hover {
  opacity: 1;
  color: #2563eb;
}

.card-tag-label {
  position: absolute;
  right: 0;
  bottom: calc(100% + 8px);
  background: #0f172a;
  color: #ffffff;
  font-size: 11px;
  font-weight: 600;
  white-space: nowrap;
  padding: 5px 9px;
  border-radius: 6px;
  opacity: 0;
  visibility: hidden;
  transform: translateY(4px);
  transition:
    opacity 140ms ease,
    transform 140ms ease,
    visibility 140ms;
  pointer-events: none;
}

.card-tag:hover .card-tag-label,
.card-tag:focus-visible .card-tag-label {
  opacity: 1;
  visibility: visible;
  transform: translateY(0);
}
```

Ao criar uma tela nova, todo card/gráfico/tabela deve sair com esse `.card-tag` já incluso:

```html
<span class="card-tag" tabindex="0" aria-label="Tipo - Nome do Componente">
  <i data-lucide="info" class="icon-xs"></i>
  <span class="card-tag-label">Tipo - Nome do Componente</span>
</span>
```

---

## 11. tabelas

### 11.1 estilo geral

As tabelas devem ser densas, mas limpas.

```css
.table-card {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 16px;
  overflow: hidden;
}
```

Header:

```css
thead {
  background: #f8fafc;
  color: #475569;
  font-size: 12px;
  font-weight: 600;
}
```

Linha:

```css
tbody tr {
  border-top: 1px solid #eef2f7;
  height: 56px;
}
```

Hover:

```css
tbody tr:hover {
  background: #f8fafc;
}
```

Número negativo:

```css
.color-danger {
  color: #ef4444;
  font-weight: 700;
}
```

Link de SKU ou ID:

```css
color: #2563eb;
font-weight: 600;
```

### 11.2 regra de tabela

- coluna de produto sempre mais larga;
- SKU menor e mais discreto;
- valor monetário alinhado à direita;
- quantidade e dias centralizados;
- status em badge;
- ação no final;
- nada de tabela com borda preta;
- nada de zebra pesada.

---

## 12. badges e status

### 12.1 prioridade

```css
.badge-critical {
  color: #be123c;
  background: #fff1f2;
  border: 1px solid #fda4af;
}

.badge-urgent {
  color: #b91c1c;
  background: #fef2f2;
  border: 1px solid #fecaca;
}

.badge-high {
  color: #c2410c;
  background: #fff7ed;
  border: 1px solid #fed7aa;
}

.badge-medium {
  color: #a16207;
  background: #fefce8;
  border: 1px solid #fef08a;
}

.badge-ok {
  color: #15803d;
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
}
```

### 12.2 tamanho

```css
.badge {
  height: 24px;
  padding: 0 8px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  display: inline-flex;
  align-items: center;
}
```

---

## 13. botões

### 13.1 botão primário

```css
.btn-primary {
  background: #2563eb;
  color: #ffffff;
  border-radius: 10px;
  height: 40px;
  padding: 0 16px;
  font-weight: 600;
}
```

Hover:

```css
background: #1d4ed8;
```

### 13.2 botão secundário

```css
.btn-secondary {
  background: #ffffff;
  color: #334155;
  border: 1px solid #e2e8f0;
}
```

Hover:

```css
background: #f8fafc;
border-color: #cbd5e1;
```

### 13.3 botão de ação em tabela

Exemplos: `Em compra`, `Transferir`, `Exportar`.

```css
height: 32px;
padding: 0 12px;
border-radius: 8px;
font-size: 12px;
font-weight: 600;
```

---

## 14. inputs, filtros e busca

### 14.1 estilo

```css
.input,
.select {
  height: 44px;
  background: #ffffff;
  border: 1px solid #cbd5e1;
  border-radius: 10px;
  padding: 0 14px;
  color: #334155;
  font-size: 13px;
}
```

Focus:

```css
border-color: #2563eb;
box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.12);
outline: none;
```

Placeholder:

```css
color: #94a3b8;
```

### 14.2 busca e filtros funcionais (src/js/shared/filtros.js)

A secao `.filters` de cada tela e ligada por `src/js/shared/filtros.js`
(carregado logo depois de `app.js` em todas as 9 telas de dados):

- a barra de busca (`<label class="control">` com `<input>`) filtra as
  linhas da tabela principal por texto, ignorando acento/caixa;
- os controles com `<span class="value">` (Fornecedor, Curva, Marca,
  Status, Qualidade, etc.) viram dropdown de verdade: ao abrir, listam
  os valores que existem na coluna correspondente da tabela (casada
  pelo texto do `<th>` com o rotulo do filtro - ver `MAPA_SINONIMOS` no
  script para os casos em que o nome do filtro nao bate 1:1 com a
  coluna, tipo "Performance" -> coluna "Status");
- busca e filtros de coluna se combinam (E logico); sem nenhuma linha
  batendo, mostra "Nenhum resultado para os filtros atuais"
  (`.filter-no-results`);
- o controle de data abre um popover com data inicial/final, mas so
  atualiza o texto exibido - ainda nao filtra linha, porque nem toda
  tabela tem uma coluna de data em formato consistente;
- a "tabela principal" da pagina e sempre a `table.table` com mais
  colunas no thead (evita pegar tabelas pequenas de resumo, tipo
  Follow-ups Prioritarios em fornecedores.html);
- um `MutationObserver` refaz as opcoes de cada dropdown sempre que o
  `tbody` muda - quando os scripts de integracao com o supabase
  trocarem o estado vazio pelos dados reais, os filtros passam a
  oferecer os valores reais sem precisar de nada extra.

Ao criar uma tela nova com `.filters`, os controles de coluna precisam
ter `<span class="value">Todas</span>` (ou "Todos") e o rotulo em texto
direto antes do span - o script cuida do resto sozinho.

---

## 15. gráficos

### 15.1 estilo geral

- linhas finas;
- grid cinza claro pontilhado;
- legenda pequena;
- tooltip branco;
- evitar excesso de cor;
- não usar 3D;
- não usar gradiente pesado;
- labels claros e poucos.

### 15.2 gráfico de linha

```css
line-width: 2px;
point-radius: 4px;
grid-color: #e2e8f0;
axis-color: #94a3b8;
```

### 15.3 donut

- furo central grande;
- label no centro;
- legenda à direita;
- porcentagem com uma casa decimal;
- cor por status.

### 15.4 matriz heatmap

Essa é a assinatura da home.

Regras:

- vermelho para ruptura;
- laranja para crítico;
- amarelo para atenção;
- verde para saudável;
- roxo para excesso;
- intensidade cresce conforme quantidade;
- texto centralizado e em negrito;
- bordas internas brancas ou cinza muito claro.

---

## 16. matriz curva x status

> nota de implementacao (2026-07-02): a matriz da home consome dados reais do Sankhya via n8n (`src/js/pages/home.js`). as colunas passam a ser dinamicas conforme as curvas presentes nos dados (podem aparecer tambem `A bigmac` e `NOVO`, na frente de A-D). visual, cores e componentes permanecem os definidos abaixo; o mock do html segue como fallback quando a api falha.

### 16.1 estrutura

Colunas:

- curva A;
- curva B;
- curva C;
- curva D.

Linhas:

- ruptura;
- crítico;
- atenção;
- saudável;
- excesso.

### 16.2 cores da matriz

```css
--heat-ruptura: #fca5a5;
--heat-critico: #fdba74;
--heat-atencao: #fde68a;
--heat-saudavel: #86efac;
--heat-excesso: #c4b5fd;
```

### 16.3 regra visual

Curva A + ruptura deve parecer mais grave visualmente que curva D + ruptura, mesmo com número menor.

Ou seja, a matriz pode ponderar não só quantidade, mas criticidade.

Peso sugerido por curva:

| curva | peso |
| ----- | ---: |
| A     |    4 |
| B     |    3 |
| C     |    2 |
| D     |    1 |

Peso sugerido por status:

| status   | peso |
| -------- | ---: |
| ruptura  |    5 |
| crítico  |    4 |
| atenção  |    3 |
| saudável |    1 |
| excesso  |    2 |

Isso ajuda a pintar prioridade real, não só volume bruto.

---

## 17. animações

Usar animação leve e funcional. Nada de firula.

### 17.1 transições padrão

```css
transition: all 160ms ease;
```

### 17.2 hover de card

```css
transform: translateY(-2px);
box-shadow: 0 12px 32px rgba(15, 23, 42, 0.08);
```

### 17.3 hover de linha

```css
background: #f8fafc;
```

### 17.4 loading de dashboard

Skeleton leve:

```css
background: linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 37%, #f1f5f9 63%);
animation: shimmer 1.2s infinite linear;
```

```css
@keyframes shimmer {
  0% {
    background-position: -400px 0;
  }
  100% {
    background-position: 400px 0;
  }
}
```

### 17.5 refresh

Botão atualizar pode girar 360 graus:

```css
.refresh-icon.loading {
  animation: spin 700ms linear;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
```

### 17.6 entrada de card

```css
@keyframes fadeUp {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
```

Usar com delay curto:

```css
animation: fadeUp 220ms ease-out both;
```

---

## 18. ícones

### 18.1 estilo

Usar ícones outline simples.

Bibliotecas indicadas:

- Lucide Icons;
- Heroicons;
- Phosphor Icons.

### 18.2 regra

```css
stroke-width: 1.8;
width: 20px;
height: 20px;
```

Em KPI:

```css
width: 22px;
height: 22px;
```

Ícone dentro de círculo:

```css
width: 40px;
height: 40px;
border-radius: 999px;
```

### 18.3 padrão por módulo

| módulo          | ícone             |
| --------------- | ----------------- |
| home            | house             |
| sugestão compra | clipboard list    |
| budget          | chart pie         |
| transferências  | arrows left right |
| excesso         | package           |
| rupturas        | alert triangle    |
| comprado        | shopping cart     |
| cobertura       | shield            |
| fornecedor      | users             |
| valor           | dollar sign       |

---

## 19. cards principais por página

### 19.1 home

Foco: radar/matriz.

```txt
KPIs
matriz 60% + itens críticos 40%
gráfico linha 60% + donut 40%
```

### 19.2 sugestão de compra

Foco: tabela dinâmica.

```txt
KPIs
tabela dinâmica full width
resumo fornecedor + prioridade + cobertura
```

### 19.3 budget

Foco: comparação CMV x comprado.

```txt
KPIs
gráfico principal full width
donut categoria + tabela resumo mensal
```

### 19.4 transferências

Foco: operação.

```txt
KPIs
tabela full width
lojas com necessidade + status transferência
```

### 19.5 excesso

Foco: valor parado.

```txt
KPIs
categorias excesso + cobertura faixa + maior valor parado
tabela full width
```

### 19.6 rupturas

Foco: urgência.

```txt
KPIs
tabela ruptura full width
evolução ruptura + fornecedores impactados
```

---

## 20. estilo de design system

### 20.1 personalidade visual

- clean;
- técnico;
- confiável;
- rápido de ler;
- corporativo moderno;
- sem excesso decorativo.

### 20.2 não fazer

- sombra preta forte;
- fundo cinza escuro;
- gradiente exagerado;
- bordas muito arredondadas;
- card com glow;
- fonte pequena demais;
- gráficos 3D;
- dashboard com poluição visual;
- cor vermelha em coisa que não é problema;
- botão primário demais na tela inteira.

### 20.3 fazer

- usar branco com cinza frio;
- manter bastante espaço;
- usar cor por significado;
- usar tabela como elemento operacional;
- manter KPI curto;
- deixar ação clara;
- destacar apenas o que exige decisão.

---

## 21. tokens CSS base

```css
:root {
  /* base */
  --color-bg: #f8fafc;
  --color-surface: #ffffff;
  --color-surface-soft: #f1f5f9;
  --color-border: #e2e8f0;
  --color-divider: #eef2f7;

  /* text */
  --color-text-primary: #0f172a;
  --color-text-secondary: #475569;
  --color-text-muted: #94a3b8;
  --color-text-disabled: #cbd5e1;

  /* brand */
  --color-primary: #2563eb;
  --color-primary-hover: #1d4ed8;
  --color-primary-soft: #eff6ff;
  --color-primary-border: #bfdbfe;

  /* status */
  --color-danger: #ef4444;
  --color-danger-soft: #fef2f2;
  --color-danger-border: #fecaca;

  --color-warning: #f59e0b;
  --color-warning-soft: #fffbeb;
  --color-warning-border: #fde68a;

  --color-orange: #f97316;
  --color-orange-soft: #fff7ed;
  --color-orange-border: #fed7aa;

  --color-success: #22c55e;
  --color-success-soft: #f0fdf4;
  --color-success-border: #bbf7d0;

  --color-info: #0ea5e9;
  --color-info-soft: #f0f9ff;
  --color-info-border: #bae6fd;

  --color-purple: #7c3aed;
  --color-purple-soft: #f5f3ff;
  --color-purple-border: #ddd6fe;

  --color-teal: #14b8a6;
  --color-teal-soft: #f0fdfa;
  --color-teal-border: #99f6e4;

  /* radius */
  --radius-card: 16px;
  --radius-control: 10px;
  --radius-badge: 6px;
  --radius-full: 999px;

  /* shadow */
  --shadow-card: 0 8px 24px rgba(15, 23, 42, 0.04);
  --shadow-card-hover: 0 12px 32px rgba(15, 23, 42, 0.08);

  /* spacing */
  --space-xs: 4px;
  --space-sm: 8px;
  --space-md: 12px;
  --space-lg: 16px;
  --space-xl: 20px;
  --space-2xl: 24px;
  --space-3xl: 32px;

  /* typography */
  --font-main: Inter, 'Segoe UI', Roboto, Arial, sans-serif;
}
```

---

## 22. CSS base de componente

```css
body {
  margin: 0;
  background: var(--color-bg);
  color: var(--color-text-primary);
  font-family: var(--font-main);
  font-variant-numeric: tabular-nums;
}

.card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-card);
  box-shadow: var(--shadow-card);
}

.card:hover {
  box-shadow: var(--shadow-card-hover);
}

.page-title {
  font-size: 28px;
  line-height: 1.2;
  font-weight: 700;
  letter-spacing: -0.03em;
}

.section-title {
  font-size: 16px;
  line-height: 1.3;
  font-weight: 700;
  color: var(--color-text-primary);
}

.muted {
  color: var(--color-text-muted);
}

.divider {
  height: 1px;
  background: var(--color-divider);
}
```

---

## 23. resumo final do estilo

A receita visual é:

**base branca fria + card branco + azul como ação + status semântico + tabela limpa + sombra quase invisível + radius médio + Inter como fonte.**

Isso cria um produto sério e moderno sem virar poluição visual.

A matriz da home vira o elemento proprietário do produto, e as outras páginas seguem o mesmo design system com foco operacional.

## paginas 7 8 9

### pagina 7 - produtos

foco operacional: saneamento e cadastro dos produtos.

componentes principais:

- kpis de produtos ativos, cadastro incompleto, curva a, ativos compra, valor medio e fornecedores padrao.
- tabela `Cadastro de Produtos` com sku, produto, marca, modelo comercial, armazenamento, cor, qualidade, ativo compra, fornecedor padrao, saldo, custo medio e status.
- graficos auxiliares de pendencias de cadastro, distribuicao por qualidade e marcas com mais skus.

### pagina 8 - recebimento

foco operacional: controle das notas e pedidos que estao entrando.

componentes principais:

- kpis de aguardando recebimento, notas recebidas, divergencias, valor recebido, tempo medio e recebimento no mes.
- tabela `Controle de Recebimento` com nota, pedido, fornecedor, previsao, data recebida, itens, volumes, valor, conferencia, divergencia, status e responsavel.
- agenda de recebimentos, distribuicao por status e valor recebido por dia.

### pagina 9 - fornecedores

foco gerencial: performance, atraso, custo e follow-up dos fornecedores.

componentes principais:

- kpis de fornecedores ativos, valor comprado, prazo medio, atraso medio, score medio e divergencias.
- tabela `Performance de Fornecedores` com fornecedor, categoria, pedidos, valor comprado, prazo medio, atraso, variacao custo, score, status e responsavel.
- ranking por valor comprado, distribuicao por performance e follow-ups prioritarios.

### pagina 10 - configuracao

foco administrativo: parametros do sistema, organizados em abas.

componentes principais:

- abas (`chip`) para geral, aparencia, compras, estoque, notificacoes, integracoes, seguranca e **permissoes e usuarios** (esta ultima so aparece pra perfil admin).
- campos de compras e estoque leem/gravam em `parametros_compras` (supabase); somente perfil admin pode salvar, conforme RLS do backend.
- campos de aparencia, notificacoes e seguranca ficam salvos em localStorage por navegador ate existir uma tabela de preferencias por usuario.
- aba integracoes e somente leitura (status da conexao com supabase e demais integracoes).
- acoes: salvar alteracoes, cancelar e restaurar padrao.

### pagina 11 - perfil (meu perfil)

foco pessoal: dados do usuario logado.

componentes principais:

- cabecalho com avatar (iniciais), nome e badge de nivel de acesso.
- dados do usuario (nome, e-mail, cargo) - nome e cargo so editaveis por perfil admin, conforme RLS do backend.
- preferencia local: mostrar dicas e tooltips.
- alterar senha via supabase auth (minimo 8 caracteres).
- sessao ativa (dispositivo e ultimo acesso) com opcao de encerrar sessao (logout).

## navegacao, acesso e autenticacao

### login

- pagina: `login.html`, com `<body data-auth="guest">`.
- uso: tela de autenticacao real via supabase auth (e-mail e senha).
- nao possui sidebar, notificacao ou usuario logado.
- composicao: painel visual lateral + card central de acesso.
- campos: e-mail, senha, lembrar acesso, esqueci minha senha, entrar e acesso sso (sso ainda nao configurado).
- com sessao ja ativa, `login.html` redireciona automaticamente para `index.html`.

### paginas internas protegidas

- todas as paginas internas usam `<body data-auth="required">`.
- sem sessao valida, o usuario e redirecionado para `login.html`.
- o conteudo so aparece depois da sessao confirmada (evita flash de tela protegida).

### usuario na sidebar

- usuario logado fica na sidebar, abaixo de `Configuracao` - nunca no canto superior direito, nunca junto de notificacao.
- componente: avatar circular com iniciais, nome, cargo/perfil e chevron; ao clicar, abre um menu com "Meu perfil", "Configuracao" e "Sair".
- dados vem de `auth.getSession()` + tabela `usuarios_perfis` (nome, cargo, perfil).

### configuracao na sidebar

- o antigo espaco de `recolher menu` foi substituido por `Configuracao`.
- o item fica no rodape da sidebar, separado por divisor fino, acima do bloco de usuario.
-
