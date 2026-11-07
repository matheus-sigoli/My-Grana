# ADR-0010 — Cartão em tabela própria, competência no lançamento e pagamento de fatura separado

- **Status:** aceito (implementa o ADR-0001)
- **Data:** 2026-11-06

## Decisões
- **Cartão** é uma tabela própria (`cartoes`: limite, dia de fechamento, dia de vencimento, conta de pagamento padrão), não um tipo de Conta — ele não tem saldo.
- **Despesa** sai de uma Conta **ou** de um Cartão (exatamente um). Receitas e transferências só em Contas. Estornos no cartão ficam para depois.
- **Competência** (`lancamentos.competencia`, 1º dia do mês) é calculada **no banco** por trigger:
  - conta → mês da data;
  - cartão → mês do vencimento da fatura (`mes_da_fatura`) + (parcela − 1).
  - Regra da fatura: compra **no dia do fechamento ou depois** vai para a fatura seguinte; se o vencimento cai antes do fechamento no calendário, a fatura vence no mês seguinte ao fechamento.
  - Mudar fechamento/vencimento do cartão recalcula a competência das compras.
- Gastos do mês, painel, gráficos e lista de lançamentos usam a **competência**.
- **Compra parcelada** = N lançamentos com o mesmo `grupo_parcelas`, mesma data de compra, centavos que sobram na 1ª parcela. Editar ou excluir uma parcela vale para a compra inteira.
- **Pagamento de fatura** é uma tabela própria (`pagamentos_fatura`): tira da Conta, não é Despesa. Pode ser parcial; vários pagamentos por fatura.
- **Limite usado** = tudo comprado (inclusive parcelas futuras) − tudo pago.
- **Patrimônio líquido** = saldos das Contas + carteira − limite usado dos cartões.
- Recorrências de despesa podem cair no cartão (assinaturas); confirmar gera a compra no cartão.

## Fora por enquanto
- Cartões vindos do Open Finance (o sinal dos valores de cartão na Pluggy precisa ser validado com dados reais).
- Estornos/créditos na fatura, juros de rotativo, anuidade automática.
