# ADR-0002 — Recorrência é uma regra; ocorrências só viram linha quando tocadas

- **Status:** aceito
- **Data:** 2026-11-04

## Contexto
O usuário cadastra contas a pagar/receber que se repetem (aluguel, salário, assinaturas) e quer ver previstos e projeção do saldo. Valores mudam ao longo do tempo (aluguel sobe em março).

## Decisão
- **Recorrência** é guardada como regra (valor, conta/cartão, categoria, frequência, data inicial, data final opcional).
- **Ocorrências** são calculadas na leitura para o período consultado e exibidas como Previsto.
- Uma Ocorrência vira **Lançamento** salvo (com `recorrencia_id` + data da ocorrência) quando é efetivada, editada ou excluída individualmente ("pular esta").
- "Esta e as próximas" encerra a regra antiga e cria uma nova a partir da data.

## Alternativas descartadas
- *Gerar 12 meses no banco:* edição "as próximas" vira update em massa; precisa de job para estender; tabela incha.
- *Gerar só o próximo mês via job:* sem projeção longa no dashboard; depende de job agendado.

## Consequências
- Consultas de período (lista do mês, dashboard, orçamento) precisam juntar Lançamentos salvos + Ocorrências calculadas, removendo as já materializadas. Essa lógica fica num único módulo/função.
- Sem jobs agendados para recorrência.

## Adendo (2026-11-05) — implementação e aportes recorrentes
- Uma Recorrência pode gerar **Lançamento** (receita/despesa/transferência) ou **Aporte** num Ativo (vira Operação de aplicação/compra).
- Quando chega o dia, a ocorrência fica **Prevista até o usuário confirmar** (pode ajustar valor/data) ou **pular**. Nada é efetivado sozinho.
- Ocorrências tratadas ficam em `ocorrencias_tratadas` (recorrência + data + confirmada/pulada + o lançamento/operação gerado). As demais continuam só calculadas.
- Frequências: semanal, mensal (dia do mês; meses curtos usam o último dia) e anual.
