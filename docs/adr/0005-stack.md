# ADR-0005 — Next.js + Supabase + Vercel

- **Status:** aceito
- **Data:** 2026-11-04

## Decisão
- **Front/servidor:** Next.js (App Router, TypeScript), Tailwind + shadcn/ui, gráficos no cliente.
- **Banco e login:** Supabase — Postgres, Supabase Auth, **RLS em todas as tabelas** filtrando por `user_id = auth.uid()`.
- **Deploy:** Vercel. Web responsivo, instalável como PWA.
- **Cotações:** chamada à API de mercado feita no servidor (Route Handler/Server Action) com cache; a chave da API nunca vai para o navegador.
- **Dinheiro:** inteiro em centavos (`bigint`), nunca float.

## Consequências
- Isolamento entre usuários garantido no banco (RLS), não só na aplicação.
- Cálculos pesados (saldos, ocorrências de recorrência, posições) ficam em funções/views no Postgres ou num módulo de domínio único no servidor.
