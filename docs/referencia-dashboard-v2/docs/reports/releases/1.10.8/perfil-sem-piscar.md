# Validacao do perfil sem piscar - v1.10.8

## Problema corrigido

A pagina `Meu Perfil` podia exibir `Leitura` temporariamente e permanecer assim por aproximadamente um minuto quando `supabase.auth.getSession()` aguardava o lock interno do SDK.

O cache das versoes anteriores tambem podia conter `leitura` como fallback nao confirmado, mesmo para usuarios administradores, gestores ou compradores.

## Correcoes

- leitura sincrona da sessao persistida pelo Supabase;
- revalidacao remota da sessao em segundo plano;
- limite padrao de 1.800 ms para a revalidacao da sessao;
- consulta de `usuarios_perfis` iniciada sem esperar `getSession()`;
- perfil aplicado assim que a consulta termina;
- cache de perfil marcado com `perfil_verificado`;
- cache antigo `leitura` sem confirmacao e ignorado automaticamente;
- removido fallback visual e persistente que inventava perfil `Leitura`;
- bootstrap da sidebar executado antes do conteudo principal;
- badge da pagina hidratado imediatamente depois de ser parseado;
- falha de rede preserva o ultimo perfil confirmado sem piscar.

## Validacoes executadas

- `npm ci` concluido;
- `npm run build` concluido;
- `npm run validate` concluido;
- 20 testes Vitest aprovados;
- 19 testes Playwright aprovados;
- sessao persistida testada com `getSession()` permanentemente pendente;
- perfil remoto testado sem depender da conclusao de `getSession()`;
- primeiro paint testado com cache confirmado;
- cache antigo falso de `leitura` testado e rejeitado;
- `npm audit` nao foi repetido nesta execucao porque o endpoint do registry retornou erro de rede; nenhuma dependencia foi alterada nesta versao.
