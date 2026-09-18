# Validacao — Home com 5 itens criticos por pagina

## Alteracao

- A tabela **Itens Mais Criticos** da home inicia com `por_pagina = 5`.
- O seletor da home oferece `5`, `15`, `25` e `50` registros.
- As demais telas preservam seus tamanhos configurados.
- O componente de paginacao aceita tamanhos por pagina configuraveis sem divergencia visual entre o valor consultado e o valor exibido.

## Criterios de aceite

- A primeira RPC da home recebe `pagina = 1` e `por_pagina = 5`.
- A tabela renderiza no maximo cinco registros por consulta inicial.
- O seletor apresenta `5 por pagina` como valor ativo.
- A paginacao continua funcional quando houver mais de cinco itens.
