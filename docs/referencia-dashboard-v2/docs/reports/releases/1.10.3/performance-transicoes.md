# validacao de performance e transicoes 1.10.3

## correcoes aplicadas

- mensagem unica de erro de consulta em todas as nove telas;
- retry mantido no indicador de estado da pagina;
- aliases `/home` e `/dashboard` convertidos de redirect 301 para rewrite 200;
- redirects de login logout convite e redefinicao usam `location.replace`;
- espera pos-redefinicao reduzida de 800 ms para 180 ms;
- animacao em cascata dos cards removida;
- transicao entre paginas reduzida a crossfade curto de opacidade;
- prefetch de documentos internos em hover foco toque e tempo ocioso;
- maior chunk compartilhado carregado com `modulepreload`;
- cache imutavel para chunks e fontes via `_headers` da Cloudflare;
- indicador de carregamento refeito com `transform` acelerado por composicao;
- blur do backdrop da Skyler removido;
- painel da Skyler usa deslocamento curto em vez de atravessar toda a tela;
- reaplicacao tardia de permissoes de 900 ms substituida pelo proximo frame;
- debounce da busca reduzido de 350 ms para 240 ms.

## validacoes executadas

- `npm run check`: aprovado;
- build: aprovado;
- validacao estrutural: aprovada;
- Vitest: 10 testes aprovados;
- Playwright: 15 testes aprovados;
- icones SVG inline: 455;
- HTMLs com performance hints: 13;
- vulnerabilidades npm: 0.

## observacao

O prefetch aquece somente o HTML estatico. Ele nao executa RPCs nem scripts da pagina de destino antes do clique.
