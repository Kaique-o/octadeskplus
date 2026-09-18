# deploy da camada de seguranca multiempresa

## pre deploy

1. faca backup do banco;
2. execute `npm run test:db:fresh` em ambiente local;
3. confira se cada valor de `empresa_nome` corresponde a uma empresa valida;
4. corrija duplicidades apontadas pela migration, sem apagar dados no escuro;
5. configure `SKYLER_API_URL` como rota relativa same-origin.

## deploy

1. aplique as migrations em ordem;
2. publique `dist/` gerada por `npm run build`;
3. confirme a presenca dos headers com uma requisicao HTTPS;
4. teste um admin, um usuario com uma empresa e um usuario sem modulo;
5. valide que consultas diretas as tabelas operacionais retornam falta de
   privilegio e que as RPCs retornam somente o escopo permitido.

## administracao de empresas

Na aba Configuracoes > Acesso, selecione o usuario e marque as empresas
permitidas. O botao Salvar permissoes grava perfil, escopo empresarial e modulos
por RPC administrativa. Desmarcar todas as empresas nega todo dado operacional
ao administrativo.

Administradores sempre possuem escopo global. A RPC impede remover o ultimo
administrador ativo.

## rollback

A migration e transacional. Se falhar durante a aplicacao, o PostgreSQL reverte
o arquivo inteiro. Depois de aplicada com sucesso, nao faca rollback manual de
RLS ou grants isoladamente: restaure o backup ou publique uma migration de
reversao revisada.
