# Validacao do auth guard antes do primeiro paint - v1.10.11

## Problema corrigido

Ao abrir uma rota interna em uma aba anonima, o HTML da plataforma podia ser pintado antes de `auth.js` terminar a verificacao da sessao. Isso causava um flash do dashboard antes do redirecionamento para `login.html`.

## Implementacao

- Todas as 11 paginas protegidas iniciam com `data-auth-state="checking"`.
- Um estilo inline no `<head>` oculta o `body[data-auth="required"]` antes do CSS externo.
- Um bootstrap sincronico roda antes do primeiro paint e le a sessao persistida.
- Sem sessao, executa `location.replace()` para o login antes de exibir o shell.
- Sessao expirada permanece oculta ate a renovacao do SDK.
- A mera existencia de uma chave `sb-*-auth-token` nao libera mais a plataforma.
- Convites e recuperacao de senha continuam sendo direcionados para `definir-senha.html`.
- O validador bloqueia a remocao do guard ou sua movimentacao para depois do CSS/body.

## Validacoes executadas

- `npm ci`: aprovado, 242 pacotes.
- `npm run build`: aprovado.
- `npm run validate`: aprovado.
- Vitest: 26 testes aprovados.
- Playwright: 23 testes aprovados.
- Teste anonimo: zero amostras de conteudo protegido visivel.
- Teste de sessao expirada: shell oculto ate a renovacao.
- `npm audit --audit-level=low`: zero vulnerabilidades.

## Resultado

A plataforma nao e mais exibida antes da tela de login em navegacao anonima ou sem sessao valida.
