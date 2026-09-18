# Validacao do menu sem flash de permissoes - v1.10.10

## Problema corrigido

Usuarios com modulos bloqueados recebiam inicialmente o HTML com o menu completo. O modulo de permissoes escondia os itens somente depois de carregar sessao, perfil e configuracao do Supabase, causando exposicao visual temporaria a cada troca de pagina.

## Implementacao

- Cada item operacional do menu possui `data-module`.
- Um bootstrap sincronico executa no `<head>` antes do CSS e da sidebar.
- O cache de permissoes passou a usar envelope versionado e marcado como verificado.
- Modulos negados sao removidos no primeiro paint.
- Sem cache verificado, o menu operacional permanece fechado ate a confirmacao do backend.
- A consulta de permissoes possui timeout padrao de 2500 ms.
- Falha de rede utiliza somente cache previamente confirmado; nunca libera todos os modulos por fallback.
- O build valida a existencia do bootstrap e das nove chaves de modulo em todas as sidebars.

## Validacoes executadas

- `npm run build`: aprovado.
- `npm run validate`: aprovado.
- Vitest: 25 testes aprovados.
- Playwright: 21 testes aprovados.
- Caso Mohamad com Budget, Transferencias e Rupturas bloqueados: aprovado.
- Caso sem cache verificado: zero modulos operacionais visiveis.
- Timeout de consulta de permissoes: aprovado.

## Observacao operacional

No primeiro acesso apos publicar esta versao, o cache legado nao e considerado confiavel. O menu pode permanecer fechado por alguns instantes ate o Supabase confirmar as permissoes. Depois da primeira confirmacao, as proximas paginas usam o cache verificado e os itens autorizados aparecem imediatamente, sem mostrar itens bloqueados.
