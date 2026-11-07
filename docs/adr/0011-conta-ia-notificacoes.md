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
As FKs entre tabelas do usuário são `RESTRICT`, então apagar o `auth.users` direto pode falhar. `public.apagar_meus_dados()` apaga na ordem de dependência (exige 2FA se ativo); depois o servidor remove o login com a chave de serviço. Exige digitar EXCLUIR e login recente (12 h).

### Importação de arquivos reutiliza a caixa de entrada
OFX/CSV entram em `transacoes_importadas` com `origem = 'arquivo'` e `conta_id` ou `cartao_id` direto. A chave de duplicado (`arq:` + hash) usa o FITID/identificador quando existe; senão data + valor + descrição normalizada + ordem.

## Consequências
- A chave de serviço (`SUPABASE_SERVICE_ROLE_KEY`) existe no servidor, mas só é usada no cron e na exclusão de conta.
- Metas de patrimônio e renda passiva não entram nos avisos (dependem de cotações; ficariam lentas no cron).
