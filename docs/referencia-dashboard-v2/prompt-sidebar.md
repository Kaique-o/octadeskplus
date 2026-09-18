# Prompt — replicar o menu lateral 1:1

Copie tudo abaixo da linha e cole na outra IA. Antes de enviar, preencha os três blocos marcados com `>>> PREENCHER`.

---

Quero que você construa um **menu lateral (sidebar) de aplicação web** seguindo **exatamente** a especificação abaixo — mesma estrutura, mesmas medidas, mesmos estados e mesmas animações. Só duas coisas mudam em relação a ela: **as cores** e **os itens do menu**, que eu defino no final.

Não simplifique, não "melhore" o layout e não arredonde as medidas. Se algo não estiver especificado, escolha o mais próximo do que está descrito. Entregue o código completo e funcionando.

## Stack

- React + React Router (`NavLink` nos itens de navegação).
- CSS puro num único arquivo, com todas as regras sob um escopo raiz (ex.: `.painel`), para não vazar estilo pro resto do app.
- Ícones: `lucide-react` (se não houver, SVG inline de traço com `stroke-width: 1.8`).
- Tudo por variáveis CSS declaradas no escopo raiz — nenhum hex solto dentro das regras.

## Tokens (declarar no escopo raiz)

```
--bg              /* fundo da área de conteúdo */
--surface         /* fundo da sidebar e dos cartões */
--border          /* borda 1px */
--divider         /* mix de --border 60% com --surface — divisor do rodapé */
--text-primary
--text-secondary  /* mix de --text-primary 80% com --surface */
--text-muted      /* mix de --text-primary 48% com --surface */
--primary
--primary-content /* texto/ícone sobre --primary */
--primary-soft    /* mix de --primary 8% com --surface  → fundo do item ativo */
--primary-border  /* mix de --primary 30% com --surface → borda do card em hover */
--danger
--danger-soft     /* mix de --danger 8% com --surface */
--radius-control: 10px;
--radius-full: 999px;
--shadow-card: 0 8px 24px rgba(15, 23, 42, 0.04);
--shadow-card-hover: 0 12px 32px rgba(15, 23, 42, 0.08);
--ease: cubic-bezier(0.2, 0, 0, 1);
--fast: 130ms;
```

Use `color-mix(in oklab, ...)` para os derivados — assim trocar `--primary` recolore hover, item ativo e bordas de uma vez só. Fonte: Inter, com fallback `"Segoe UI", Roboto, Arial, sans-serif`.

## Estrutura

Dentro de um `<aside class="sidebar">`, nesta ordem:

1. **Linha da marca** (`.brand-linha`)
2. **Navegação** (`<nav class="nav" aria-label="menu principal">`)
3. **Rodapé** (`.sidebar-footer`) — item de destaque, Ajuda, Configurações e card do usuário com menu suspenso.

### Layout geral

- Página: `display: grid; grid-template-columns: 240px 1fr; min-height: 100vh`.
- Sidebar: `position: sticky; top: 0; height: 100vh; padding: 30px 16px 24px; background: var(--surface); border-right: 1px solid var(--border); display: flex; flex-direction: column; gap: 16px`.
  O padding do topo é maior que o de baixo de propósito: com valores iguais a marca parece colada na borda da janela.
- Conteúdo: `padding: 24px 32px; background: var(--bg)`.

### 1. Linha da marca

`.brand-linha`: `display: flex; align-items: center; gap: 2px`.

- **Botão voltar** (só quando existe um nível acima): `<button>` 26×26, `border-radius: 8px`, sem fundo, `color: var(--text-muted)`, ícone chevron-left 18px stroke 2. Hover: fundo `var(--bg)`, cor `var(--text-primary)`. `:focus-visible` → `outline: 2px solid var(--primary); outline-offset: 2px`. Com `aria-label` e `title`.
- **Marca** (`NavLink` para a home): `flex: 1; min-width: 0; display: flex; align-items: center; gap: 10px; font-size: 21px; font-weight: 800; letter-spacing: -0.03em; border-radius: var(--radius-control)`, transição de `background` e `color` em `var(--fast) var(--ease)`. Hover: fundo `var(--bg)`, cor `var(--primary)`, e o ícone ganha `filter: brightness(1.08)`.
  - `.brand-icon`: 40×40, `border-radius: 11px`, `flex: none`, `background: var(--primary)`, `color: var(--primary-content)`, `display: grid; place-items: center`, ícone 22px stroke 1.8.
  - O texto trunca: `overflow: hidden; text-overflow: ellipsis; white-space: nowrap`.
- **Variante sem botão voltar** (`.brand-linha--solo`): marca com `gap: 12px`, `font-size: 23px` e `padding: 10px 14px` (o recuo alinha o logo com os ícones do menu, que têm `padding: 0 14px`, e dá forma ao fundo do hover); `.brand-icon` 44×44, `border-radius: 12px`.

### 2. Navegação

`.nav`: `display: grid; gap: 8px`.

Cada item é um `NavLink` renderizado a partir de **um array de dados** (`NAV = [{ chave, to, end?, icone, label }]`) — nunca JSX repetido à mão. Classe `nav-item`, mais `active` quando `isActive`.

```
.nav-item {
  height: 48px;
  padding: 0 14px;
  border: 0;
  border-radius: var(--radius-control);
  background: none;
  width: 100%;
  text-align: left;
  display: flex;
  align-items: center;
  gap: 12px;
  color: var(--text-secondary);
  font-size: 15px;
  font-weight: 500;
  transition: background var(--fast) var(--ease), color var(--fast) var(--ease);
}
```

- Ícone 20px, stroke 1.8.
- `:hover` → `background: var(--bg); color: var(--primary)`.
- `.active` → `background: var(--primary-soft); color: var(--primary); font-weight: 700`.
- `:disabled` → `opacity: .5; cursor: not-allowed`, e o hover não muda nada.

A mesma classe `.nav-item` serve para `<button>` e para `NavLink` — os itens do rodapé reaproveitam ela.

### 3. Rodapé

`.sidebar-footer`: `margin-top: auto; padding-top: 16px; border-top: 1px solid var(--divider); display: grid; gap: 10px`.

**a) Item de destaque** (assistente / ação principal) — um `.nav-item` com gradiente animado:

```
position: relative;
color: #fff;
font-weight: 700;
border: 1px solid <borda-clara>;
background-image: var(--degrade);
background-size: 125% 100%;   /* o gradiente é mais largo que o botão */
background-position: 0% 50%;
animation: degradeDeslize 8s ease-in-out infinite alternate;
box-shadow: 0 6px 16px <sombra-colorida-18%>;
```

`@keyframes degradeDeslize { from { background-position: 0% 50% } to { background-position: 100% 50% } }` — a folga de 25% faz o movimento parecer luz deslizando, não cor trocando.

No `:hover`, **repita** `background-image`, `background-size` e a cor do texto: `.nav-item:hover` usa o shorthand `background`, que zeraria a imagem e apagaria o gradiente justo na hora do hover. Sombra do hover: `0 8px 20px <sombra-colorida-28%>`.

O gradiente segura o tom fechado até ~34% de propósito, para o rótulo branco ficar sempre sobre a parte escura: `linear-gradient(100deg, <escuro> 0%, <médio> 45%, <claro> 78%, <quase-branco> 100%)`.

- Ícone 19px stroke 2 dentro de `.item-icon` (22×22, `position: relative`, `display: grid; place-items: center`, sem pastilha de fundo — só o desenho sobre o gradiente).
- **Duas faíscas** absolutas dentro do ícone: 7×7, redondas, brancas, `box-shadow: 0 0 12px rgba(255,255,255,.95)`, animação 2.2s ease-in-out infinita — `0%,100% { opacity: .35; transform: scale(.7) }`, `50% { opacity: 1; transform: scale(1.2) }`. Uma em `top: -3px; right: -4px`; a outra em `left: -4px; bottom: -1px` com `animation-delay: 700ms`.
- **Bolinha de status** à direita (`margin-left: auto`): 9×9, redonda, `background: #22c55e`, `border: 2px solid #fff`, `box-shadow: 0 0 0 3px rgba(34,197,94,.14)`.
- `@media (prefers-reduced-motion: reduce)`: zere as duas animações — gradiente e faíscas continuam visíveis, só param de se mexer.

**b) Ajuda** — `<button class="nav-item">` com ícone de interrogação 20px. Quando não houver ajuda para a tela atual, fica **`disabled`, não escondido** (sumir um item a cada navegação faria o menu inteiro pular), com `title` explicando o motivo.

**c) Configurações** — `NavLink` com engrenagem 20px, mesma classe.

**d) Card do usuário** (`.sidebar-user`), que abre um menu suspenso no clique:

```
position: relative;
cursor: pointer;
min-height: 58px;
min-width: 0;
padding: 10px;
border: 1px solid var(--border);
border-radius: 14px;
background: var(--surface);
box-shadow: var(--shadow-card);
display: flex;
align-items: center;
gap: 10px;
```

Hover: `border-color: var(--primary-border); box-shadow: var(--shadow-card-hover)`. Acessibilidade: `role="button"`, `tabIndex={0}`, `aria-haspopup="true"`, `aria-expanded`, `aria-label`.

- `.avatar`: 32×32, `border-radius: var(--radius-full)`, fundo neutro escuro com texto claro, `font-size: 12px; font-weight: 800; letter-spacing: .02em`, `display: grid; place-items: center`. Conteúdo: **iniciais** — primeira letra do primeiro nome + primeira do último; "U" quando não houver nome.
- `.user-meta`: `display: grid; gap: 1px; line-height: 1.1; min-width: 0; overflow: hidden`. `strong` = 13px/800 (nome), `span` = 11px/600 em `--text-muted` (cargo). Os dois truncam com ellipsis.
- Chevron-down 16px, `margin-left: auto`, cor `--text-muted`.

**Menu suspenso** (`.user-menu`), abrindo **para cima**:

```
position: absolute;
left: 0; right: 0;
bottom: calc(100% + 8px);
padding: 6px;
background: var(--surface);
border: 1px solid var(--border);
border-radius: 12px;
box-shadow: var(--shadow-card-hover);
display: grid;
gap: 2px;
opacity: 0;
transform: translateY(4px);
pointer-events: none;
transition: opacity 160ms ease, transform 160ms ease;
z-index: 20;
```

`.open` → `opacity: 1; transform: translateY(0); pointer-events: auto`.

Itens (`.user-menu-item`): `height: 38px; padding: 0 10px; border-radius: 8px; display: flex; align-items: center; gap: 10px; width: 100%; font-size: 13px; font-weight: 600; color: var(--text-secondary); text-align: left`, ícone 16px. Hover: `background: var(--bg); color: var(--primary)`. Variante `.danger` (Sair): hover `background: var(--danger-soft); color: var(--danger)`. Conteúdo: "Meu perfil", "Configurações" e "Sair".

## Responsivo — `@media (max-width: 900px)`

O layout nasce só para desktop; abaixo de 900px a sidebar vira off-canvas:

- O grid da página passa a `1fr`.
- Aparece uma **barra de topo** (`.topo`): `position: sticky; top: 0; z-index: 30; display: flex; align-items: center; gap: 8px; height: 56px; padding: 0 12px; background: var(--surface); border-bottom: 1px solid var(--border)`, com um botão hambúrguer de 44×44 (`border-radius: 10px`, sem fundo) e o título da tela (`font-weight: 800; letter-spacing: -0.03em`).
- Sidebar: `position: fixed; top: 0; left: 0; z-index: 40; width: 280px; max-width: 85vw; transform: translateX(-100%); transition: transform .2s ease`. Com a classe `menu-aberto` no container raiz: `transform: translateX(0)`.
- Overlay (`.overlay`), só com o menu aberto: `position: fixed; inset: 0; z-index: 35; background: rgb(0 0 0 / 45%); cursor: pointer` — clicar fecha.
- Conteúdo: `padding: 16px`.
- Clicar em qualquer item do menu fecha a sidebar (callback `onNavegar`).

## Regras de implementação

- A lista de itens vive num **arquivo de dados separado** (`nav.js`) que exporta o array; a sidebar só mapeia.
- A sidebar recebe por props `onAbrirDestaque`, `onNavegar` (fecha o off-canvas) e `onVoltar` (rota do nível acima) — ela **não decide** para onde se volta.
- O rodapé inteiro é um **componente próprio**, reutilizável por mais de uma sidebar; nunca duplicado — duplicar é o jeito garantido de um dos dois ficar para trás quando o outro mudar.
- Sem estilo inline, sem `<style>` no JSX, sem CSS por CDN.

---

>>> PREENCHER — marca

- Nome exibido: ...
- Ícone da marca (lucide): ...
- Tem botão de voltar? (sim → para qual rota): ...

>>> PREENCHER — itens do menu

Na ordem, com rótulo, rota e ícone lucide:

1. ...
2. ...
3. ...

>>> PREENCHER — cores

```
--primary: ...
--primary-content: ...
--bg: ...
--surface: ...
--border: ...
--text-primary: ...
--danger: ...
```

- Gradiente do item de destaque (4 paradas, do escuro ao quase-branco): ...
- Cor da sombra colorida desse item: ...

Entregue: o componente da sidebar, o componente do rodapé, o arquivo de dados do menu e o CSS completo.
