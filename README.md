# MyGrana

Controle financeiro pessoal + dashboard. Next.js 15 · Supabase · Vercel.

Domínio e decisões: [`CONTEXT.md`](CONTEXT.md), [`docs/adr/`](docs/adr), [`docs/roadmap.md`](docs/roadmap.md).

## Rodar no seu computador

Precisa de Node.js 20 ou mais novo.

```bash
copy .env.example .env.local   # no PowerShell/CMD (Mac/Linux: cp .env.example .env.local)
npm install
npm run dev
```

Abra http://localhost:3000, crie uma conta e confirme pelo link que chega no e-mail.

O `.env.example` já vem preenchido e aponta para o projeto Supabase **MyGrana** (região São Paulo). A chave ali é a *publicável*: pode ficar no navegador, porque quem protege os dados é o RLS do banco.

## O que tem no M1

- Cadastro, login e confirmação por e-mail (Supabase Auth)
- **Contas** (corrente, poupança/caixinha, carteira, corretora) com saldo inicial, cor, arquivar
- **Categorias** de receita e despesa, 1 nível de subcategoria; 24 categorias padrão criadas no cadastro
- **Lançamentos**: receita, despesa e transferência entre contas; filtro por mês, conta, tipo e busca
- **Painel**: saldo em contas, receitas × despesas do mês, gastos por categoria, saldo por conta, últimos 6 meses, lançamentos recentes

## Banco

Migração em `supabase/migrations/`. Toda tabela tem RLS (`user_id = auth.uid()`), e as chaves estrangeiras compostas `(user_id, id)` impedem um lançamento de apontar para a conta de outro usuário. Saldos vêm da view `saldos_contas` (`security_invoker`). Dinheiro é sempre inteiro em centavos.

## Publicar na Vercel

O projeto já tem `vercel.json` (região São Paulo, cron diário dos avisos às 8h).

1. Importe o repositório na Vercel (ou `npx vercel` na pasta).
2. Variáveis de ambiente — veja `.env.example`. Obrigatórias: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_SITE_URL`. Opcionais (cada uma liga um recurso): `SUPABASE_SERVICE_ROLE_KEY` (push diário), `ANTHROPIC_API_KEY` (assistente), `NEXT_PUBLIC_VAPID_PUBLIC_KEY` + `VAPID_PRIVATE_KEY` + `VAPID_SUBJECT` (push), `CRON_SECRET`, `BRAPI_TOKEN`, `PLUGGY_CLIENT_ID` + `PLUGGY_CLIENT_SECRET`.
3. No Supabase → Authentication → URL Configuration, troque o *Site URL* pelo domínio da Vercel e adicione `https://SEU-DOMINIO/auth/confirm` nas *Redirect URLs*.

Sem uma variável opcional, o recurso correspondente some da interface (nada de mensagem técnica para o cliente).

## Testes

```bash
npm test            # cálculo, análise, cartões, planejamento/importação/simuladores (pure TS)
npm run typecheck
```

## Design

Direção registrada em [`DESIGN.md`](DESIGN.md): fundo frio, tinta escura, amarelo-ipê como única cor de ação e o circunflexo do **ê** como marca e indicador (^ sobrou, ˇ faltou).

Animações Lottie em `public/animacoes/` (marca, estado vazio, salvo, carregando), tocadas pelo player leve `lottie-web` (SVG, sem `eval`). Respeitam "reduzir movimento" do sistema. Para regerar, edite o script descrito no topo de cada JSON ou peça ao Claude.

## Segurança

- **RLS** em todas as tabelas + chaves estrangeiras compostas `(user_id, id)`: um usuário não consegue ler, editar nem apontar para dados de outro (testado).
- **Restrições no banco** (valem até para chamadas diretas à API): cor em hex, limites de valor/data/texto, dono e tipo de categoria imutáveis.
- **CSP com nonce** por requisição (`src/lib/seguranca.ts` + `src/middleware.ts`), HSTS, `nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`.
- **Server Actions** validam tudo no servidor (UUIDs, tamanhos, formatos) e montam a lista de campos explicitamente. O Next bloqueia Server Actions vindas de outra origem (proteção CSRF).
- Erros do banco não são mostrados crus; login e cadastro não revelam se um e-mail já tem conta.

**Ajustes no painel do Supabase** (Authentication → Providers/Policies):
1. Senha mínima: 8 caracteres.
2. Ativar *Leaked password protection* (bloqueia senhas vazadas; pode exigir plano Pro).
3. Em produção: *Site URL* e *Redirect URLs* com o domínio real, e `NEXT_PUBLIC_SITE_URL` definido na Vercel.

## Investimentos (M4)

Carteira completa em `/investimentos`: renda fixa (CDB, LCI/LCA, Tesouro, debêntures, CRI/CRA…), ações, FIIs, ETFs, BDRs, cripto, fundos e previdência. Decisões em [`docs/adr/0007-carteira-de-investimentos.md`](docs/adr/0007-carteira-de-investimentos.md).

- **Renda fixa** é calculada pela taxa contratada (% do CDI, Selic, pré, IPCA+) com índices oficiais do Banco Central; dá para corrigir com o valor do extrato.
- **Cotações:** B3 pela [brapi.dev](https://brapi.dev) (crie um token grátis e coloque `BRAPI_TOKEN` no `.env.local`; plano grátis: 15 mil requisições/mês, cache de 30 min). Cripto pelo Mercado Bitcoin (sem chave).
- **Carteira:** alocação × meta com calculadora de aporte, rentabilidade comparada com o CDI e a inflação, proventos (viram receita na conta), vencimentos e IR estimado.
- Cálculos em `src/lib/investimentos/calculo.ts`, testados com `npm run test:calculo`.

## Recorrentes, Open Finance, nota e análise

- **Recorrentes** (`/recorrentes`): contas a pagar, receitas, transferências e **aportes** que se repetem. Ficam previstos até você confirmar (ajustando valor e data) ou pular; o painel mostra o saldo previsto para o fim do mês.
- **Open Finance** (`/conexoes`): conecte o banco pelo **Meu Pluggy** (grátis para uso pessoal). Configure `PLUGGY_CLIENT_ID` e `PLUGGY_CLIENT_SECRET` no `.env.local` (conta em dashboard.pluggy.ai). As movimentações caem em **Revisar importações** (`/revisar`), com categoria sugerida, antes de virarem lançamentos. Para abrir a outras pessoas é preciso contrato pago com a Pluggy. Ver ADR-0008.
- **Nota e análise** (`/investimentos/analise`): nota 0–10 por critérios visíveis e diagnóstico factual de cada ativo. Não é consultoria e não recomenda compra ou venda. Ver ADR-0009.
- Testes: `npm test` (cálculos, recorrências, nota e diagnóstico).
