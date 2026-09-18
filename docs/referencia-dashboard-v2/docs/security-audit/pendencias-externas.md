# Pendências fora deste repositório

Três achados da auditoria não fecham só com código: dependem de ação no n8n, no painel do Supabase ou
de confirmação com quem mantém o fluxo da Skyler. O que dava para fazer no repositório já foi feito e
está listado em cada item.

## 1. Webhook da Skyler sem autenticação — achado nº 4 (alta)

**Estado:** aberto. O node de webhook em `SKYLER_UPSTREAM_URL` está com `Authentication=None`, então
quem descobrir a URL executa o workflow sem passar pelo proxy — e o payload que trafega leva o e-mail
do usuário autenticado e o contexto da tela (KPIs, filtros, itens visíveis).

**Já feito aqui:** `SKYLER_API_TOKEN` entrou na lista de variáveis obrigatórias de
`validateEnvironment` (`functions/api/skyler/chat.js`). Antes, com a variável vazia, o Worker
encaminhava sem cabeçalho de autenticação em silêncio; agora a rota responde 503 e registra o erro,
sem fazer nenhuma chamada externa. Coberto por `scripts/test-cloudflare-worker.mjs`.

**O que falta (no n8n):** reativar o Header Auth no node do webhook. A armadilha que travou a
tentativa anterior está registrada no código: criar a credencial e **salvar numa única ação**, sem
reabrir o campo `Value` depois — reabrir grava o placeholder `__n8n_BLANK_VALUE_...` como se fosse o
valor real. Se o n8n permitir, vale também restringir por IP de origem da Cloudflare.

**Como confirmar:** um `curl` direto ao `SKYLER_UPSTREAM_URL`, sem o header, tem de ser recusado; e a
Skyler pela aplicação tem de continuar respondendo normalmente.

## 2. Persistência de `conversa_id` no fluxo — achado nº 7 (baixa)

**Estado:** mitigado aqui, confirmação pendente.

O `conversa_id` vinha do cliente sem validação e sem vínculo com a sessão: bastava enviar o id de
outra pessoa. Se o workflow mantiver histórico por id, isso é leitura de conversa alheia — **não dá
para confirmar por este repositório**, porque o workflow da Skyler não está em `integrations/n8n/`
(os 14 fluxos versionados são de ingestão).

**Já feito aqui:** o Worker passou a prefixar o id com o `user.id` já validado antes de subir, e a
remover o prefixo antes de devolver ao cliente. Um id forjado vira `<user.id>:<id>` e não colide com
o de outra pessoa, independentemente do que o upstream faça.

**O que falta:** confirmar com quem mantém o fluxo se há persistência por `conversa_id`. Se houver, o
fluxo deve recusar conversa cujo dono não seja o `usuario.id` que já vai no payload.

## 3. Rotação da chave anon do Supabase — achado nº 10 (informativa)

**Estado:** decisão pendente, sem urgência.

A chave anon e a referência do projeto (`hldeqhkcnbywtorijhvl`) ficaram no histórico do git, em
`scripts/build.js` (arquivo já removido do `HEAD`). O payload do JWT decodifica para `"role": "anon"`:
é a chave pública, que vai para o bundle do navegador por desenho e cuja proteção é o RLS. **Não é
segredo vazado.**

**Não recomendamos reescrever o histórico** por causa de uma chave anon — o custo (todos os clones
divergem) não se justifica.

**O que pondera a favor de rotacionar:** o que fica exposto é o endereço exato da instância a sondar,
somado a uma chave válida para bater nela. Isso torna o RLS a única barreira — que é justamente o que
o achado nº 1 tinha comprometido. Com o nº 1 corrigido, a premissa volta a valer.

**Decisão a registrar:** rotacionar no painel do Supabase por conveniência operacional, ou registrar
aqui a escolha de não rotacionar e o motivo. O `HEAD` já está limpo: `supabase-client.js` lê tudo de
`import.meta.env` e nenhum `.env`/`.dev.vars` está sob controle de versão.
