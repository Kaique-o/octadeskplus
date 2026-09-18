# validacao shell e perfil v1.10.6

## problemas corrigidos

- skyler aparecendo duplicada durante a transicao entre documentos;
- mais de um launcher ou painel quando o componente era inicializado novamente;
- perfil de acesso voltando para placeholder ou valor generico;
- consulta de `usuarios_perfis` aguardando a rede por dezenas de segundos;
- pagina meu perfil iniciando em leitura e alterando muito tempo depois.

## implementacao

- a view transition da sidebar exibe apenas o snapshot novo;
- a skyler usa uma instancia global por documento;
- launchers paineis e backdrops duplicados sao removidos antes do bind;
- o nivel de acesso usa cache local e metadados da sessao no primeiro paint;
- a consulta remota de perfil possui timeout configuravel por `PROFILE_TIMEOUT_MS`;
- o timeout padrao e 2500 ms e mantem o ultimo cache visivel;
- a pagina de perfil consome o mesmo cache antes de iniciar a revalidacao;
- atualizacoes remotas iguais ao cache nao reescrevem o dom.

## validacoes

- build e validacao estrutural;
- teste de deduplicacao com dois launchers dois paineis e inicializacao repetida;
- teste do timeout de perfil sem aguardar um minuto;
- teste de hidratacao imediata do badge de acesso na pagina meu perfil;
- suite e2e das telas internas com exatamente uma skyler por pagina.
