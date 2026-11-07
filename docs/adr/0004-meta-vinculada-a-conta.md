# ADR-0004 — Meta de economia é vinculada a uma Conta

- **Status:** aceito
- **Data:** 2026-11-04

## Contexto
Usuário quer metas ("Viagem: R$5.000 até julho") com progresso.

## Decisão
Cada **Meta** aponta para uma **Conta** (tipicamente Poupança/Caixinha). Progresso = saldo atual dessa conta ÷ valor-alvo. Guardar para a meta é Transferência para a conta.

## Alternativas descartadas
- *Reserva virtual dentro do saldo:* exige conceito de "saldo livre vs reservado" em toda tela; dinheiro que não existe em lugar nenhum.
- *Aportes manuais independentes:* progresso não bate com nenhum saldo real.

## Consequências
- Uma conta vinculada a meta não deve ser usada para gastos do dia a dia (aviso na UI, não bloqueio).
- Meta pode sugerir "quanto guardar por mês" = (alvo − saldo) ÷ meses restantes.
