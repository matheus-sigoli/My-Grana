# ADR-0008 — Open Finance via Pluggy (Meu Pluggy), com caixa de entrada para revisão

- **Status:** aceito (substitui a parte "Open Finance fora da v1" do ADR-0006)
- **Data:** 2026-11-05

## Contexto
O usuário quer acompanhar movimentações do banco atualizadas sem digitar. Agregadores de Open Finance cobram caro para produção (Pluggy ~R$ 2.500/mês, Belvo ~R$ 6.000/mês, mai/2026). O **Meu Pluggy** é gratuito para a pessoa conectar as próprias contas; o app lê esses dados pela API da Pluggy com a conta de desenvolvedor (sandbox/trial).

## Decisão
- Integração com a **API da Pluggy** (servidor) + **Pluggy Connect** (widget no navegador). Para uso pessoal, o usuário escolhe o conector "Meu Pluggy".
- Chaves `PLUGGY_CLIENT_ID` / `PLUGGY_CLIENT_SECRET` só no servidor. O connect token é emitido com `clientUserId = id do usuário`; ao salvar uma conexão, o servidor confere na Pluggy que o item pertence a esse usuário (impede "sequestrar" o item de outra pessoa).
- **Conexão** (item da Pluggy) → **Contas bancárias externas**, que o usuário vincula a uma Conta do MyGrana.
- Sincronização sob demanda ("Sincronizar agora") e automática ao abrir a página se a última tiver mais de 6 h. Sem webhooks na v1 (exigiriam URL pública e verificação de assinatura).
- Transações chegam numa **caixa de entrada** (Transação importada), nunca direto como Lançamento — mantém a regra 9 do CONTEXT (ADR-0006). A caixa sugere categoria (pela categoria da Pluggy e pelas regras do usuário) e sugere **confirmar uma ocorrência prevista** quando valor e data batem (ADR-0002).
- Duplicados: id da transação na Pluggy é único por usuário.

## Consequências
- Abrir para outras pessoas exige contrato pago com a Pluggy (ou outro agregador) — fica para quando virar produto.
- A CSP precisa liberar o widget (`*.pluggy.ai`) só na página de conexões.
