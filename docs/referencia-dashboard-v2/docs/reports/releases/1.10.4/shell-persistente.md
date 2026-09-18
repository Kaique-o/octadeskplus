# validacao do shell persistente 1.10.4

## problema corrigido

na troca de paginas a Skyler era criada somente depois que o bundle JavaScript carregava. Isso empurrava a area de configuracao e usuario no rodape da sidebar. Ao mesmo tempo o usuario voltava para `--` e o perfil era consultado novamente.

## implementacao

- launcher da Skyler presente diretamente nos 11 HTMLs internos;
- posicao da Skyler reservada antes do primeiro paint;
- bootstrap sincrono do nome cargo e iniciais pelo cache local;
- validacao do cache contra o usuario da sessao Supabase;
- perfil real revalidado em segundo plano;
- memoizacao da sessao e perfil para impedir consultas duplicadas no mesmo documento;
- permissoes locais aplicadas antes da revalidacao de rede;
- conversa id mensagens e estado aberto da Skyler preservados no `sessionStorage`;
- cache de usuario removido no logout;
- validador bloqueia retorno do launcher dinamico e dos placeholders `--`.

## resultados

- `npm ci`: aprovado com 242 pacotes;
- `npm run build`: aprovado;
- 466 icones SVG inline no primeiro paint;
- `npm run validate`: aprovado;
- Vitest: 13 testes aprovados;
- Playwright: 15 testes aprovados;
- `npm audit`: zero vulnerabilidades;
- zero launcher duplicado da Skyler;
- zero pagina interna sem bootstrap sincrono do usuario.

## comportamento esperado

na primeira abertura sem cache o rodape ja aparece completo com os textos neutros `Usuario` e `Compras`. Depois que o perfil e carregado ele e salvo. Nas navegacoes seguintes nome cargo iniciais configuracao e Skyler aparecem imediatamente e permanecem na mesma posicao enquanto os dados reais sao revalidados em segundo plano.
