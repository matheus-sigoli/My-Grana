-- ADR-0012: recebedor das transações importadas + regras aprendidas por recebedor.

alter table public.transacoes_importadas
  add column recebedor text check (recebedor is null or char_length(recebedor) between 1 and 120);

create table public.regras_recebedor (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  chave text not null check (char_length(chave) between 1 and 120),      -- recebedor normalizado (sem acento, minúsculo)
  nome text not null check (char_length(nome) between 1 and 120),        -- como aparece no extrato
  tipo text not null check (tipo in ('receita', 'despesa')),
  categoria_id uuid,
  recorrencia_id uuid,
  usos integer not null default 1 check (usos >= 1),
  updated_at timestamptz not null default now(),
  unique (user_id, chave, tipo),
  foreign key (user_id, categoria_id) references public.categorias(user_id, id) on delete cascade,
  foreign key (user_id, recorrencia_id) references public.recorrencias(user_id, id) on delete cascade,
  constraint regra_tem_destino check (categoria_id is not null or recorrencia_id is not null)
);
create index regras_recebedor_categoria_idx on public.regras_recebedor(user_id, categoria_id);
create index regras_recebedor_recorrencia_idx on public.regras_recebedor(user_id, recorrencia_id);

alter table public.regras_recebedor enable row level security;
create policy "regras_recebedor_select_proprio" on public.regras_recebedor for select to authenticated using ((select auth.uid()) = user_id);
create policy "regras_recebedor_insert_proprio" on public.regras_recebedor for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "regras_recebedor_update_proprio" on public.regras_recebedor for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "regras_recebedor_delete_proprio" on public.regras_recebedor for delete to authenticated using ((select auth.uid()) = user_id);
create policy "regras_recebedor_exige_2fa" on public.regras_recebedor as restrictive for all to authenticated using ((select public.mfa_ok())) with check ((select public.mfa_ok()));
revoke all on public.regras_recebedor from anon;
grant select, insert, update, delete on public.regras_recebedor to authenticated;
create trigger regras_recebedor_dono_fixo before update of user_id on public.regras_recebedor for each row execute function private.bloqueia_troca_dono();

-- "Apagar meus dados" não precisa mudar: regras_recebedor some em cascata ao apagar categorias e recorrências
-- (FKs on delete cascade) e ao excluir o usuário do Auth.

-- Conversão feita uma vez para o usuário (07/11/2026, aprovada por ele): os lançamentos "GASTOS CARTAO DE CREDITO"
-- viraram pagamentos_fatura do cartão pago pela conta, na fatura com vencimento mais próximo (8 linhas).
