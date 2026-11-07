# ADR-0003 — Corretora é uma Conta; investir não é despesa

- **Status:** aceito
- **Data:** 2026-11-04

## Contexto
A v1 tem Carteira de investimentos (Ações, FIIs, CDB) com operações e cotação automática. Precisamos ligar investimentos ao fluxo de dinheiro das Contas sem distorcer gastos.

## Decisão
- **Corretora** é um tipo de **Conta**, com saldo em caixa.
- Mandar dinheiro do banco para a corretora é **Transferência**.
- **Operação** de compra/venda movimenta o caixa da Corretora e a **Posição**; não é Receita/Despesa.
- **Provento** é Receita no caixa da Corretora (categoria Investimentos).
- **Patrimônio** = saldos das Contas + valor de mercado das Posições − faturas em aberto.
- Cotação de Ação/FII vem de API externa (candidata: brapi.dev), com cache; CDB é calculado por taxa (% do CDI) com CDI de fonte pública.

## Alternativas descartadas
- *Aporte como despesa "Investimento":* infla gastos e o saldo não fecha.
- *Carteira isolada das Contas:* caixa da corretora fica fora do controle; patrimônio não bate.

## Consequências
- Preço médio é derivado das Operações (recalcula ao editar uma operação antiga).
- Dependência de API externa: o app deve funcionar (com última cotação conhecida) se ela cair.
- IR/DARF e proventos automáticos ficam fora da v1.
