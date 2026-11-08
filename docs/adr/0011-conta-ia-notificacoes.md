# ADR-0011 — 2FA no banco, IA opt-in, avisos calculados e exclusão de conta

- **Status:** aceito
- **Data:** 2026-11-07

## Decisões

### 2FA obrigatório também no banco
Quem ativa o autenticador (TOTP do Supabase Auth) só lê e escreve com sessão **aal2**. Além do redirecionamento no app (`requireUser` → `/verificar-2fa`), toda tabela tem uma policy **restritiva** `using ((select public.mfa_ok()))`. Assim, um token aal1 roubado não abre dados mesmo chamando a API direto.

### Avisos são calculados, não guardados
Faturas a vencer, contas atrasadas, orçamento em 80%/100%, saldo negativo e prazo de meta saem dos dados na hora (`lib/avisos.ts`). Não há tabela de notificações para manter em sincronia. O push é um **resumo diário** (Vercel Cron → `/api/cron/avisos`, protegido por `CRON_SECRET`), que lê com a chave de serviço sempre filtrando por `user_id`.

### Assistente com IA: opt-in, resumo visível, limite no banco
- Desligado por padrão; o consentimento fica em `preferencias.ia_ativada` e é conferido no servidor.
- A IA recebe um **resumo** (nomes dados pelo usuário, saldos, totais por mês, 10 maiores gastos, metas, vencimentos). Nunca: senha, e-mail, números de conta/cartão, ids, dados de conexão bancária. O JSON exato fica visível na tela.
- 20 perguntas/dia contadas por `public.registrar_uso_ia()` (security definer); o usuário só lê o contador.
- A resposta é exibida como texto puro. Sem recomendação de compra/venda de ativos (ADR-0009).

### Exclusão de conta em ordem
As FKs entre tabelas do usuário são `RESTRICT`, então os dados são apagados em ordem de dependência (`private.apagar_dados`).

**Revisado em 08/11/2026:** a exclusão dependia da chave de serviço para remover o login e, sem ela configurada, ficava "indisponível". Agora tudo roda no banco, sempre para o próprio usuário (`auth.uid()`), conferindo 2FA (se ativo) e login nas últimas 12 h (`private.dono_confirmado`):
- `public.apagar_meus_dados()` — "Apagar minhas informações": zera tudo, mantém o login e devolve as categorias padrão (`private.semear_categorias`, a mesma do cadastro). Confirmação: digitar APAGAR.
- `public.excluir_minha_conta()` — apaga os dados e o próprio registro em `auth.users` (sessões e fatores somem em cascata). Confirmação: digitar EXCLUIR.

### Importação de arquivos reutiliza a caixa de entrada
OFX/CSV entram em `transacoes_importadas` com `origem = 'arquivo'` e `conta_id` ou `cartao_id` direto. A chave de duplicado (`arq:` + hash) usa o FITID/identificador quando existe; senão data + valor + descrição normalizada + ordem.

## Consequências
- A chave de serviço (`SUPABASE_SERVICE_ROLE_KEY`) é opcional e só é usada no cron de avisos por push.
- Metas de patrimônio e renda passiva não entram nos avisos (dependem de cotações; ficariam lentas no cron).
