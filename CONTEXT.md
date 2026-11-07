# MyGrana — Contexto do Domínio

App web de controle financeiro pessoal com dashboard. Multiusuário: cada **Usuário** tem login e só enxerga os próprios dados.

> Este arquivo é a linguagem ubíqua do projeto. Código, banco, telas e conversas usam estes termos com estes significados.

## Glossário

### Pessoas e lugares do dinheiro

**Usuário** — pessoa com conta no MyGrana (login). Dono de todos os dados abaixo; nada é compartilhado entre usuários.

**Conta** — lugar onde o dinheiro do usuário fica e tem **saldo**. Tipos:
- **Corrente** — Nubank, Itaú…
- **Poupança / Caixinha** — reserva separada (pode estar vinculada a uma Meta).
- **Carteira** — dinheiro vivo.
- **Corretora** — XP, Rico…; tem **saldo em caixa** e guarda a Carteira de investimentos (ver Investimentos).

**Cartão de crédito** — meio de pagamento com limite, dia de fechamento, dia de vencimento e conta de pagamento padrão. Não tem saldo como uma Conta; acumula compras em **Faturas**. ([ADR-0010](docs/adr/0010-cartao-tabela-propria-e-competencia.md))

**Competência** — mês em que um lançamento conta nos gastos: o mês da data, ou, no cartão, o mês da fatura em que a compra (ou parcela) cai.

**Limite usado** — tudo que foi comprado no cartão, inclusive parcelas futuras, menos o que já foi pago.

**Patrimônio líquido** — saldos das Contas + Carteira de investimentos − limite usado dos cartões.

**Patrimônio** — soma dos saldos de todas as Contas + valor de mercado das Posições − faturas em aberto.

### Movimentos

**Lançamento** — qualquer movimento de dinheiro registrado. Tipos:
- **Receita** — dinheiro que entra numa Conta. Tem Categoria.
- **Despesa** — dinheiro que sai, de uma Conta ou num Cartão. Tem Categoria.
- **Transferência** — dinheiro que muda de lugar entre Contas/Cartão do próprio usuário. **Não é** receita nem despesa e não aparece em gráficos de gasto.

**Status do lançamento:**
- **Previsto** — vai acontecer (conta a pagar / a receber). **Não** mexe no saldo.
- **Efetivado** — aconteceu. Mexe no saldo.

**Recorrência** — regra que repete um lançamento (ex.: "aluguel R$1.500, todo dia 10, sem fim"). Não é um lançamento: suas **Ocorrências** são calculadas a partir da regra.

**Recorrência de aporte** — Recorrência que, ao ser confirmada, vira uma Operação de aplicação/compra num Ativo (ex.: VGBL todo mês).

**Confirmar / pular** — ao chegar o dia, a Ocorrência fica prevista até o usuário confirmar (ajustando valor e data) ou pular. Nada é efetivado sozinho.

**Ocorrência** — uma data concreta de uma Recorrência. Enquanto não é tocada, existe só calculada (aparece como Previsto). Ao ser efetivada ou editada, vira um Lançamento salvo, ligado à Recorrência.
- Editar "**só esta**" → materializa só essa Ocorrência com os novos dados.
- Editar "**esta e as próximas**" → encerra a regra atual na data anterior e cria uma nova regra a partir desta.

### Cartão de crédito

**Compra no cartão** — Despesa feita num Cartão, à vista ou **parcelada**.

**Parcela** — cada pedaço de uma compra parcelada. Cada parcela é uma Despesa que cai na Fatura do seu mês. (R$300 em 3x → 3 parcelas de R$100 em 3 faturas.)

**Fatura** — conjunto das despesas de um Cartão num ciclo (entre dois fechamentos), com vencimento e valor total. Estados: aberta → fechada → paga.

**Pagamento de fatura** — dinheiro saindo de uma Conta para quitar uma Fatura. É uma **Transferência** (Conta → Cartão), não uma Despesa.

### Classificação e planejamento

**Categoria** — classificação de Receitas e Despesas. Cada categoria é de Receita **ou** de Despesa. Até 1 nível de **Subcategoria** (Alimentação › Mercado). Novo usuário recebe um conjunto padrão; pode renomear, criar e **arquivar** (não apagar se tiver lançamentos).

**Orçamento** — limite mensal de gasto por Categoria-mãe (ex.: Alimentação até R$1.200/mês). Avisos em 80% e 100%. Conta Despesas efetivadas + previstas do mês (parcelas pelo mês da fatura).

**Meta** — objetivo de economia com valor-alvo e prazo opcional (ex.: "Viagem: R$5.000 até julho"). É **vinculada a uma Conta**; o progresso é o saldo dessa conta. Guardar dinheiro para a meta = Transferência para essa conta.
- **Meta de patrimônio** — o progresso é o Patrimônio líquido.
- **Meta de renda passiva** — valor por mês; o progresso é a média mensal de Proventos dos últimos 12 meses.

**Fluxo de caixa** — projeção do saldo total das Contas mês a mês: + recorrências de receita − despesas recorrentes − faturas a vencer − aportes.

**Aviso** — fato que pede ação (fatura vencendo, conta atrasada, orçamento em 80%/100%, saldo negativo, prazo de meta). Calculado na hora; o push manda um resumo por dia. ([ADR-0011](docs/adr/0011-conta-ia-notificacoes.md))

**Sugestão de recorrência** — lançamento que aparece em 3+ dos últimos 6 meses com descrição parecida e valor a até 15% da mediana; o usuário decide se vira Recorrência.

### Open Finance

**Conexão bancária** — autorização de um banco feita pelo Open Finance via Pluggy (no uso pessoal, pelo **Meu Pluggy**). Pertence a um usuário e pode ser removida a qualquer momento (o acesso é revogado). ([ADR-0008](docs/adr/0008-open-finance-meu-pluggy.md))

**Conta externa** — conta do banco trazida pela Conexão. O usuário a **vincula** a uma Conta do MyGrana e escolhe a partir de qual data importar.

**Caixa de entrada** — onde chegam as **Transações importadas** do banco. Nada vira Lançamento sem passar por ela: o usuário confere a categoria sugerida, importa ou ignora. Se a transação bater com uma Ocorrência prevista, a caixa sugere confirmá-la.

### Importação

**Importação** — envio de um arquivo de extrato (OFX ou CSV) de uma Conta ou Fatura de cartão. Passa por uma **tela de revisão** antes de virar Lançamentos.

**Duplicado** — linha importada que já existe. OFX: mesmo `FITID` na mesma Conta. CSV: mesma data + valor + descrição normalizada na mesma Conta/Cartão.

**Regra de categorização** — "descrição contém X → Categoria Y", criada a partir das escolhas do usuário na revisão; sugere a categoria nas próximas importações.

### Investimentos

**Ativo** — algo investível do usuário. Classes: **Ação**, **FII**, **ETF**, **BDR** (B3, por ticker), **Cripto** (por símbolo), **Fundo**, **Previdência** e **Renda fixa**. Na renda fixa, **cada aplicação contratada é um Ativo** (tipo, indexador, taxa, vencimento). ([ADR-0007](docs/adr/0007-carteira-de-investimentos.md))

**Indexador** — como a renda fixa rende: pós-fixado (% do CDI), Selic, prefixado (% a.a.) ou IPCA + %.

**Operação** — movimento de um Ativo dentro de uma Corretora: **compra/venda** (renda variável e cripto, com quantidade) ou **aplicação/resgate** (renda fixa, fundos, previdência). Mexe no caixa da Corretora, exceto quando marcada como posição que o usuário já tinha. Não é Despesa nem Receita.

**Avaliação** — valor de um Ativo informado pelo usuário numa data (do extrato). A partir dela o valor é recalculado; fundos e previdência dependem só delas.

**Posição** — o quanto o usuário tem de um Ativo numa Corretora: quantidade, **preço médio** (calculado das Operações) e valor de mercado (quantidade × cotação; CDB: valor atualizado pela taxa).

**Provento** — dividendo, JCP, rendimento, juros ou amortização. Registrado manualmente; gera uma Receita (categoria Investimentos) no caixa da Corretora.

**Alocação-alvo** — percentual desejado por grupo (RF pós, RF pré, RF IPCA, ações, FIIs, ETFs, BDRs, fundos, previdência, cripto). A diferença para a alocação atual orienta onde aportar (**rebalanceamento**).

**Rentabilidade** — ganho da carteira (valor atual + vendas + proventos − aportes), comparado com o mesmo dinheiro aplicado a 100% do CDI e com a inflação.

**Carteira de investimentos** — conjunto das Posições do usuário (todas as Corretoras), com alocação por tipo e por ativo.

**Cotação** — preço atual de um ativo de B3 (brapi.dev) ou cripto (Mercado Bitcoin), em cache.

**Nota da carteira** — 0 a 10, soma de critérios visíveis: diversificação (3), rendimento vs CDI/inflação (3), reserva de emergência (2), custos (1), aderência à meta (1). ([ADR-0009](docs/adr/0009-nota-e-diagnostico-sem-recomendacao.md))

**Diagnóstico** — fatos por ativo (resultado, comparação com CDI e inflação nos mesmos fluxos, peso, taxas, vencimento) e uma classificação **Em dia / Atenção / Revisar**. Não recomenda comprar, manter ou vender.

**Gasto mensal médio** — média das despesas dos últimos meses completos (até 6); base da reserva de emergência.

**IR estimado** — imposto previsto: tabela regressiva na renda fixa; apuração mensal na renda variável e cripto. É estimativa, não substitui contador.

## Regras do domínio

1. Saldo da Conta = Receitas efetivadas − Despesas efetivadas ± Transferências efetivadas ± Operações (corretora).
2. Compra no cartão **não** mexe em saldo de Conta; só o Pagamento de fatura mexe. ([ADR-0001](docs/adr/0001-cartao-competencia-por-fatura.md))
3. Gastos do mês: parcelas contam no mês da Fatura em que caem; Transferências, Pagamentos de fatura e Operações nunca contam.
4. Previsto nunca altera saldo; o dashboard mostra **saldo atual** e **saldo previsto no fim do mês**.
5. Recorrências não geram linhas no banco até serem tocadas. ([ADR-0002](docs/adr/0002-recorrencia-como-regra.md))
6. Corretora é Conta; investir é Transferência + Operação, nunca Despesa. ([ADR-0003](docs/adr/0003-corretora-e-conta.md), [ADR-0007](docs/adr/0007-carteira-de-investimentos.md))
7. Meta lê o saldo de uma Conta; não existe dinheiro reservado "virtual". ([ADR-0004](docs/adr/0004-meta-vinculada-a-conta.md))

8. Moeda única: **BRL** na v1. Valores guardados em centavos (inteiro).
9. Lançamento importado nunca é salvo sem passar pela revisão. ([ADR-0006](docs/adr/0006-importacao-ofx-csv.md))

## Dashboard (v1)
- **Resumo do mês:** saldo atual, saldo previsto no fim do mês, receitas × despesas, próximas contas a pagar, faturas abertas.
- **Gastos por categoria + Orçamento:** por categoria-mãe, com progresso de cada orçamento.
- **Evolução 12 meses:** receitas vs despesas por mês + linha do Patrimônio.
- **Investimentos e Metas:** patrimônio total, alocação da carteira (Ação/FII/CDB), rentabilidade, progresso das metas.

## Stack
Next.js (App Router, TypeScript) + Tailwind/shadcn · Supabase (Postgres, Auth, RLS por usuário) · Vercel · PWA. ([ADR-0005](docs/adr/0005-stack.md))

## Conta
**Verificação em duas etapas** — código de app autenticador (TOTP). Ativada, o banco só libera dados para sessões que passaram pelo código.

**Assistente** — IA opt-in que responde sobre os próprios dados a partir de um resumo visível; nunca recebe senhas nem números de conta.

## Em aberto
- Importar fatura de cartão com "Loja X 2/3": criar/ligar a compra parcelada automaticamente? (M5)
- Cartões vindos do Open Finance: validar o sinal dos valores de cartão na Pluggy com dados reais antes de importar.
- Detectar automaticamente transferências entre as próprias contas na caixa de entrada.
