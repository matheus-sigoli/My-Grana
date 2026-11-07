# ADR-0012 — Recebedor, regras aprendidas e pagamento de fatura vindo do extrato

- **Status:** aceito
- **Data:** 2026-11-07

## Contexto
O extrato do Bradesco importado (PDF) trazia o pagamento do cartão como "GASTOS CARTAO DE CREDITO"; importado como Despesa, ele contava duas vezes o gasto (as compras já estavam no cartão). E todo Pix chegava só como "PIX ENVIADO"/"PIX RECEBIDO": o nome de quem recebeu fica na linha de baixo ("DES: FULANO 03/11", "REM: …") e era descartado.

## Decisões
1. **Pagamento de fatura reconhecido.** Descrições de pagamento de cartão viram `pagamentos_fatura` do cartão cujo "pago com" é a conta do extrato, na fatura com vencimento mais próximo da data (janela de ±10 dias; empate → a fatura com saldo em aberto mais perto do valor). Sem cartão candidato, a revisão pede para escolher. Os 8 pagamentos que já tinham virado despesa foram convertidos.
2. **Recebedor é coluna própria** (`transacoes_importadas.recebedor`), não parte da descrição. Assim a chave de duplicado (que usa a descrição) não muda: reimportar o mesmo PDF **preenche o recebedor** das linhas já existentes em vez de duplicá-las (e acrescenta o nome ao lançamento, se a descrição dele ainda for a do banco).
3. **Regra de recebedor** (`regras_recebedor`: recebedor normalizado + tipo → categoria **ou** recorrência). Aprendida a cada importação com recebedor (última escolha vence), editável na tela Recebedores. **Só preenche a revisão** — a revisão continua obrigatória (ADR-0006).
4. Destinos de regra nesta versão: Categoria e Recorrência. Transferência entre contas próprias, aporte/resgate de investimento e "ignorar sempre" continuam manuais.

## Consequências
- Linhas sem recebedor continuam com a sugestão de categoria pelo histórico da descrição.
- Recorrência via regra é confirmada mesmo com valor diferente do previsto (o recebedor é a prova), desde que haja ocorrência prevista a até 7 dias.
