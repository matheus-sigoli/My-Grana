# ADR-0007 — Carteira de investimentos completa (amplia o ADR-0003)

- **Status:** aceito
- **Data:** 2026-11-05

## Contexto
O usuário quer uma seção de investimentos que monte uma carteira completa: renda fixa, renda variável da B3, fundos e cripto, com alocação-alvo, rentabilidade, proventos, vencimentos e IR. O ADR-0003 continua valendo (Corretora é Conta; investir não é despesa); este ADR detalha o modelo.

## Decisões

### Ativos e classes
- **Ativo** pertence ao usuário. Classes: `acao`, `fii`, `etf`, `bdr`, `cripto`, `fundo`, `previdencia`, `renda_fixa`.
- **Renda fixa: cada aplicação contratada é um Ativo próprio** (um CDB 110% CDI comprado em março ≠ um CDB 100% CDI de maio), com tipo (CDB, LCI, LCA, LC, Tesouro Selic/Prefixado/IPCA+, debênture, CRI, CRA, poupança, outro), indexador (`pos_cdi`, `pre`, `ipca`, `selic`), taxa, vencimento e isenção de IR.
- B3 e cripto são identificados por ticker; o mesmo ticker pode estar em várias Corretoras.

### Operações (uma tabela)
`compra`, `venda` (renda variável/cripto: quantidade + valor total) e `aplicacao`, `resgate` (renda fixa, fundos, previdência: só valor). Todas em centavos, com taxas e IR retido.
- Mexem no **caixa da Corretora** (saldo da Conta): compra/aplicação saem, venda/resgate entram (líquidos).
- **Posição existente:** ao cadastrar algo que o usuário já tinha, a operação pode ser marcada `afeta_caixa = false`.

### Valor atual
- **B3:** cotação brapi.dev (plano grátis: 1 ativo por requisição, sem cripto/índices), cache de 15 min no servidor; token só no servidor.
- **Cripto:** API pública do Mercado Bitcoin (BRL, sem chave), cache de 5 min.
- **Renda fixa:** calculada pela taxa contratada com índices oficiais do Banco Central (SGS: CDI 12, Selic 11, IPCA 433), cache de 12 h. Cada fluxo cresce pelo fator do índice da sua data até hoje (resgate = fluxo negativo). Pré e IPCA+ usam dias úteis aproximados (seg–sex, sem feriados).
- **Ajuste manual (Avaliação):** o usuário informa o valor do extrato numa data; daí em diante o cálculo parte desse valor. Fundos e previdência usam só avaliações + fluxos (dados da CVM ficam fora).
- Se uma cotação falhar, usa a última avaliação manual ou o custo, sinalizado na tela.

### Carteira
- **Alocação:** grupos `rf_pos`, `rf_pre`, `rf_ipca`, `acoes`, `fiis`, `etfs`, `bdrs`, `fundos`, `previdencia`, `cripto`. Alvo em % por grupo; tela mostra diferença e quanto aportar para rebalancear com um valor informado.
- **Rentabilidade:** ganho = valor atual + vendas/resgates + proventos − aportes. Comparação "se o mesmo dinheiro, nas mesmas datas, estivesse a 100% do CDI" e com a inflação (IPCA). Ibovespa fica fora (não disponível no plano grátis).
- **Proventos:** dividendo, JCP, rendimento, juros, amortização. Cada provento gera uma **Receita** (categoria Investimentos) no caixa da Corretora, de forma atômica (função no banco).
- **IR (estimativa, não substitui contador):** renda fixa pela tabela regressiva (22,5% → 15%) sobre o ganho de cada aplicação, isenção para LCI/LCA/CRI/CRA/poupança/marcadas; renda variável por preço médio com apuração mensal (ações: isenção de vendas até R$ 20 mil/mês, 15%; FII 20%; ETF/BDR 15%; cripto: isenção até R$ 35 mil/mês, 15%). Day trade, IOF e compensação de prejuízo entre meses ficam fora da v1.

## Consequências
- Cálculos financeiros ficam num módulo puro em TypeScript (`src/lib/investimentos/`), testado sem rede.
- Duas chaves externas: `BRAPI_TOKEN` (servidor). Mercado Bitcoin e Banco Central não pedem chave.
- O saldo das Contas passa a somar o efeito em caixa das operações de investimento.
