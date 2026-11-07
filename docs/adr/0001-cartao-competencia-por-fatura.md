# ADR-0001 — Compra no cartão conta como despesa por fatura; saldo cai só no pagamento

- **Status:** aceito
- **Data:** 2026-11-04

## Contexto
O MyGrana tem Contas com saldo e Cartões de crédito com Fatura e parcelamento. Precisamos decidir quando uma compra no cartão afeta (a) os gastos do mês no dashboard e (b) o saldo das Contas.

## Decisão
- Cada **Parcela** é uma **Despesa** registrada no mês da **Fatura** em que cai, com a Categoria da compra.
- Compras no cartão **não** alteram saldo de Conta.
- O **Pagamento de fatura** é uma **Transferência** Conta → Cartão: reduz o saldo da Conta, mas não é contado como despesa (evita contar o gasto duas vezes).

## Alternativas descartadas
- *Despesa única no pagamento da fatura:* perde a categoria de cada compra; o dashboard por categoria fica inútil.
- *Valor total na data da compra:* compra parcelada distorce o mês da compra e zera os seguintes.

## Consequências
- O sistema precisa calcular a qual Fatura uma compra pertence (data da compra × dia de fechamento do cartão).
- Parcelamento gera N Despesas ligadas a uma compra de origem (editar/excluir a compra afeta todas).
- Dashboard de "gastos do mês" soma Despesas de Contas + Parcelas das Faturas do mês, e ignora Transferências.
