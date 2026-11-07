# MyGrana — Design

Modo: **Operate** (app de uso diário). A ambição aparece em precisão, números legíveis e um único gesto de marca: a **moeda**.

## Ideia
A moeda ipê com um "G" é a marca do **MyGrana**: o dinheiro que é seu, guardado no lugar certo. Ela vira:
- o ícone do app e o símbolo ao lado do nome (`components/logo.tsx`, cores fixas — funciona nos dois temas);
- a cor de ação (amarelo-ipê) — só o botão principal e a moeda usam essa cor;
- a animação de marca (a moeda cai e assenta no anel) e a do estado vazio (uma moeda cai na caderneta).

O marcador de resultado continua sendo a seta (^ sobrou / ˇ faltou) no painel.

## Cores
| Nome | Hex | Papel |
|---|---|---|
| Papel | `#F3F5F4` | fundo (frio, não creme) |
| Folha | `#FFFFFF` | superfícies |
| Tinta | `#0F1B17` | texto e o bloco escuro do saldo |
| Suave | `#56635D` | texto secundário |
| Linha | `#DCE2DF` | bordas de painéis e campos |
| Mata | `#0E4D3A` | marca: links, item ativo, foco |
| Ipê | `#F6C343` | ação principal (texto em Tinta) e a moeda |
| Receita | `#17803D` | entradas |
| Despesa | `#C2410C` | saídas |

### Tema escuro
Os tokens (`--t-*` em `globals.css`) trocam de valor; o código usa só os nomes (`bg-papel`, `text-tinta`…), nunca hex.
Ativa por `data-tema="escuro"` no `<html>` (cookie `tema`) ou pelo sistema quando o usuário escolhe "Sistema".

| Token | Claro | Escuro |
|---|---|---|
| fundo | `#F3F5F4` | `#0A1210` |
| papel | `#FFFFFF` | `#111C19` |
| tinta | `#0F1B17` | `#E7EEEA` |
| suave | `#56635D` | `#9AABA3` |
| linha | `#DCE2DF` | `#22322D` |
| marca | `#0E4D3A` | `#6FD3AC` |
| marca-clara | `#E2EEE9` | `#163029` |
| receita | `#17803D` | `#5FD48A` |
| despesa | `#C2410C` | `#FF8F5E` |
| destaque (bloco do saldo) | `#0F1B17` | `#172722` |

Regras do escuro: o bloco do saldo usa `bg-destaque` (nunca `bg-tinta`, que vira claro); estado ativo é `bg-tinta text-papel`; Ipê não muda, e texto sobre Ipê é sempre `#0F1B17` fixo.

Regras: uma cor de ação (Ipê); gráficos usam só Receita/Despesa — categorias aparecem por nome, com um ponto de cor discreto, nunca barras arco-íris. Sem gradientes, sem sombras em repouso; superfícies se separam por um passo de tom.

## Tipografia
- **Bricolage Grotesque** (600–800): títulos e o número grande do saldo, tracking −0.02em.
- **Plus Jakarta Sans**: todo o resto, `tabular-nums` em valores.
- Rótulos em sentence case, sem caixa-alta espaçada.
- Escala: 12 / 14 / 16 / 20 / 28 / clamp(40px, 6vw, 64px).

## Forma
- Botões e controles segmentados: pílula (`rounded-full`).
- Painéis: raio 16px, borda Linha, sem sombra.
- Campos: raio 10px, foco com anel Mata.

## Movimento
- Lottie só onde explica algo: marca (login), estado vazio, confirmação de salvo, carregamento.
- Todas respeitam `prefers-reduced-motion` (mostram o quadro final, parado).
