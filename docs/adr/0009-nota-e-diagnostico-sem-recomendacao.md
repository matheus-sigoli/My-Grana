# ADR-0009 — Nota da carteira e diagnóstico factual (sem "compre/venda")

- **Status:** aceito
- **Data:** 2026-11-05

## Contexto
O usuário quer uma nota da carteira e uma análise de "vale a pena continuar investindo". Dizer a outras pessoas para manter ou vender um investimento é consultoria de valores mobiliários, que exige registro na CVM (Resolução CVM 19/2021).

## Decisão
- **Nota 0–10 por critérios visíveis**, cada um com pontos, explicação e "como subir":
  - Diversificação (3): grupos relevantes, peso do maior ativo, concentração (HHI). Títulos públicos, poupança e renda fixa pós/Selic não contam como concentração (risco de emissor baixo; acima do limite do FGC, avaliar à parte).
  - Rendimento (3): carteira vs mesmo dinheiro a 100% do CDI e vs inflação. Com menos de 3 meses de histórico, conta como neutro (2 de 3).
  - Reserva de emergência (2): renda fixa pós/Selic vs 6× o gasto mensal médio real (lançamentos dos últimos 6 meses).
  - Custos (1): taxas pagas ÷ aportes.
  - Aderência à meta (1): distância entre alocação atual e alvo.
- **Diagnóstico por ativo, só com fatos**: tempo investido, resultado vs CDI e vs inflação no mesmo período e com os mesmos fluxos, peso na carteira, taxas, vencimento, IR se resgatar agora, cotação disponível. Classificação **Em dia / Atenção / Revisar** a partir de sinais objetivos. O texto descreve; não diz comprar, manter ou vender.
- Aviso fixo: o MyGrana não é consultoria; decisões são do usuário.

## Consequências
- Funções puras em `src/lib/investimentos/analise.ts`, testadas.
- Pesos e limites ficam em constantes documentadas para ajuste futuro.
