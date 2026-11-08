# ADR-0006 — Importação de OFX/CSV com revisão obrigatória

- **Status:** aceito
- **Data:** 2026-11-04

## Decisão
- Entrada manual + importação de arquivos **OFX** e **CSV** (Open Finance fora da v1).
- Toda importação gera um lote em **revisão**: o usuário confirma, ajusta categoria ou descarta cada linha.
- **Duplicados:** OFX por `FITID` na Conta; CSV por data + valor + descrição normalizada.
- **Regras de categorização** aprendidas das escolhas do usuário sugerem categoria nas próximas importações.

## Alternativas descartadas
- *Open Finance (Pluggy/Belvo):* pago e com contrato; reavaliar se virar produto comercial.
- *Só manual:* atrito alto de uso.

## Consequências
- Um parser por formato/banco para CSV (layouts variam); OFX é padrão.

## Atualização (07/11/2026): PDF
Extrato e fatura em **PDF** também são aceitos (é o formato mais fácil de baixar nos apps de banco).
- O texto é extraído no servidor com `unpdf` (PDF.js), PDF.js atual não usa eval; até 40 páginas e 15 s; o arquivo não é guardado.
- As linhas são remontadas pela posição na página e lidas por heurística (`lerTextoExtrato`): data no começo da linha ou como título do dia, descrição, primeiro valor (o último costuma ser o saldo); sinal por "-", "D/C", título da seção (entradas/saídas) ou palavras como "recebido"/"compra".
- PDF com senha ou escaneado (imagem) recebe uma mensagem explicando o que fazer — nunca pedimos a senha do PDF.
- Como cada banco monta o PDF de um jeito, a revisão na caixa de entrada continua obrigatória.

## Atualização (08/11/2026): extrato em colunas Crédito/Débito
Extratos como o do Bradesco não têm sinal no valor: ele fica na coluna **Crédito** (entrou) ou **Débito** (saiu), com o **Saldo** ao lado. Ler só o texto perdia a coluna — créditos viravam débitos e o nº do documento virava descrição.
- `lerTabelaExtrato` usa a posição dos pedaços de texto no PDF: acha o cabeçalho Crédito/Débito/Saldo e põe cada valor na coluna mais próxima. A coluna decide o sinal.
- O saldo confere cada linha (saldo − saldo anterior = valor). Se a diferença for o valor com sinal trocado, o saldo manda. Linhas "Total" e "Saldo anterior" não viram lançamento.
- Histórico em cima da linha do valor vira a descrição; o complemento embaixo vira o recebedor ("DES:"/"REM:" ou um nome só com letras; códigos como o do caixa eletrônico são ignorados). Linha sem data herda a data da anterior.
- Sem esse cabeçalho, continua a leitura por texto — que agora também usa o saldo ao lado (quando existe) para decidir entrada ou saída.
