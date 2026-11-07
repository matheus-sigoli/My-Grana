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
