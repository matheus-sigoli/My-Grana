-- Cartões de crédito, compras parceladas, competência e pagamento de fatura (ADR-0001 + ADR-0010)

create table public.cartoes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  nome text not null check (char_length(nome) between 1 and 60),
  limite_centavos bigint not null default 0 check (limite_centavos between 0 and 100000000000),
  dia_fechamento smallint not null check (dia_fechamento between 1 and 31),
  dia_vencimento smallint not null check (dia_vencimento between 1 and 31),
  conta_pagamento_id uuid,
  cor text not null default '#4f46e5' check (cor ~ '^#[0-9a-fA-F]{6}$'),
  arquivado boolean not null default false,
  created_at timestamptz not null default now(),
  unique (user_id, id),
  foreign key (user_id, conta_pagamento_id) references public.contas(user_id, id) on delete set null (conta_pagamento_id)
);
create index cartoes_user_idx on public.cartoes(user_id);
create index cartoes_conta_idx on public.cartoes(user_id, conta_pagamento_id);

-- Lançamentos: despesa pode sair de uma Conta OU de um Cartão; parcelas agrupadas; competência explícita.
alter table public.lancamentos
  alter column conta_id drop not null,
  add column cartao_id uuid,
  add column grupo_parcelas uuid,
  add column parcela smallint check (parcela between 1 and 120),
  add column total_parcelas smallint check (total_parcelas between 1 and 120),
  add column competencia date,
  add foreign key (user_id, cartao_id) references public.cartoes(user_id, id) on delete restrict;

alter table public.lancamentos drop constraint lancamento_consistente;
alter table public.lancamentos add constraint lancamento_consistente check (
  (tipo = 'transferencia' and conta_id is not null and cartao_id is null and conta_destino_id is not null and conta_destino_id <> conta_id and categoria_id is null)
  or (tipo = 'receita' and conta_id is not null and cartao_id is null and conta_destino_id is null and categoria_id is not null)
  or (tipo = 'despesa' and (conta_id is null) <> (cartao_id is null) and conta_destino_id is null and categoria_id is not null)
);
alter table public.lancamentos add constraint parcelas_consistentes check (
  (grupo_parcelas is null and parcela is null and total_parcelas is null)
  or (grupo_parcelas is not null and cartao_id is not null and parcela is not null and total_parcelas is not null and parcela <= total_parcelas)
);
create index lancamentos_cartao_idx on public.lancamentos(user_id, cartao_id, competencia);
create index lancamentos_grupo_idx on public.lancamentos(user_id, grupo_parcelas);
create index lancamentos_competencia_idx on public.lancamentos(user_id, competencia);

-- Mês da fatura (1º dia do mês de vencimento) de uma compra feita em `p_data`.
-- Compra no dia do fechamento ou depois vai para a fatura seguinte.
create or replace function public.mes_da_fatura(p_data date, p_fechamento int, p_vencimento int)
returns date language sql immutable set search_path = '' as $$
  select (date_trunc('month', p_data)
          + make_interval(months => (case when extract(day from p_data) >= p_fechamento then 1 else 0 end)
                                  + (case when p_vencimento <= p_fechamento then 1 else 0 end)))::date
$$;

-- Competência: mês da data para conta; mês da fatura (+ parcela) para cartão.
create or replace function private.calcula_competencia() returns trigger
language plpgsql set search_path = '' as $$
declare f int; v int;
begin
  if new.cartao_id is null then
    new.competencia := date_trunc('month', new.data)::date;
  else
    select dia_fechamento, dia_vencimento into f, v from public.cartoes where id = new.cartao_id and user_id = new.user_id;
    new.competencia := (public.mes_da_fatura(new.data, f, v) + make_interval(months => coalesce(new.parcela, 1) - 1))::date;
  end if;
  return new;
end $$;
create trigger lancamentos_competencia before insert or update of data, cartao_id, parcela on public.lancamentos
for each row execute function private.calcula_competencia();

update public.lancamentos set competencia = date_trunc('month', data)::date where competencia is null;
alter table public.lancamentos alter column competencia set not null;

-- Mudar fechamento/vencimento recalcula a competência das compras do cartão.
create or replace function private.recalcula_competencia_cartao() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.dia_fechamento is distinct from old.dia_fechamento or new.dia_vencimento is distinct from old.dia_vencimento then
    update public.lancamentos set competencia =
      (public.mes_da_fatura(data, new.dia_fechamento, new.dia_vencimento) + make_interval(months => coalesce(parcela, 1) - 1))::date
    where cartao_id = new.id and user_id = new.user_id;
  end if;
  return new;
end $$;
create trigger cartoes_recalcula after update on public.cartoes
for each row execute function private.recalcula_competencia_cartao();

-- Pagamento de fatura: sai da conta, NÃO é despesa (a despesa já está nas compras).
create table public.pagamentos_fatura (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  cartao_id uuid not null,
  fatura date not null check (extract(day from fatura) = 1),
  conta_id uuid not null,
  data date not null check (data between date '2000-01-01' and date '2100-12-31'),
  valor_centavos bigint not null check (valor_centavos > 0 and valor_centavos <= 100000000000),
  created_at timestamptz not null default now(),
  foreign key (user_id, cartao_id) references public.cartoes(user_id, id) on delete cascade,
  foreign key (user_id, conta_id) references public.contas(user_id, id) on delete restrict
);
create index pagamentos_cartao_idx on public.pagamentos_fatura(user_id, cartao_id, fatura);
create index pagamentos_conta_idx on public.pagamentos_fatura(user_id, conta_id);

do $$ declare t text; begin
  foreach t in array array['cartoes','pagamentos_fatura'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "%1$s_select_proprio" on public.%1$I for select to authenticated using ((select auth.uid()) = user_id)', t);
    execute format('create policy "%1$s_insert_proprio" on public.%1$I for insert to authenticated with check ((select auth.uid()) = user_id)', t);
    execute format('create policy "%1$s_update_proprio" on public.%1$I for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)', t);
    execute format('create policy "%1$s_delete_proprio" on public.%1$I for delete to authenticated using ((select auth.uid()) = user_id)', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('create trigger %1$s_dono_fixo before update of user_id on public.%1$I for each row execute function private.bloqueia_troca_dono()', t);
  end loop;
end $$;

-- Saldo das contas agora desconta pagamentos de fatura.
create or replace view public.saldos_contas with (security_invoker = true) as
select c.id as conta_id, c.user_id, c.nome, c.tipo, c.cor, c.arquivada, c.saldo_inicial_centavos,
  (c.saldo_inicial_centavos
   + coalesce((select sum(case
        when l.tipo = 'receita' then l.valor_centavos
        when l.tipo = 'despesa' then -l.valor_centavos
        when l.tipo = 'transferencia' and l.conta_id = c.id then -l.valor_centavos
        when l.tipo = 'transferencia' and l.conta_destino_id = c.id then l.valor_centavos
        else 0 end)
      from public.lancamentos l
      where l.user_id = c.user_id and l.status = 'efetivado' and (l.conta_id = c.id or l.conta_destino_id = c.id)), 0)
   + coalesce((select sum(case
        when o.tipo in ('compra','aplicacao') then -(o.valor_centavos + o.taxas_centavos)
        else o.valor_centavos - o.taxas_centavos - o.ir_centavos end)
      from public.operacoes_investimento o
      where o.user_id = c.user_id and o.conta_id = c.id and o.afeta_caixa), 0)
   - coalesce((select sum(p.valor_centavos) from public.pagamentos_fatura p where p.user_id = c.user_id and p.conta_id = c.id), 0)
  )::bigint as saldo_centavos
from public.contas c;

-- Recorrências também podem cair no cartão (assinaturas).
alter table public.recorrencias
  alter column conta_id drop not null,
  add column cartao_id uuid,
  add foreign key (user_id, cartao_id) references public.cartoes(user_id, id) on delete restrict;
alter table public.recorrencias drop constraint recorrencia_consistente;
alter table public.recorrencias add constraint recorrencia_consistente check (
  (tipo = 'despesa' and categoria_id is not null and conta_destino_id is null and ativo_id is null and (conta_id is null) <> (cartao_id is null))
  or (tipo = 'receita' and conta_id is not null and cartao_id is null and categoria_id is not null and conta_destino_id is null and ativo_id is null)
  or (tipo = 'transferencia' and conta_id is not null and cartao_id is null and conta_destino_id is not null and conta_destino_id <> conta_id and categoria_id is null and ativo_id is null)
  or (tipo = 'aporte' and conta_id is not null and cartao_id is null and ativo_id is not null and categoria_id is null and conta_destino_id is null)
);
create index recorrencias_cartao_idx on public.recorrencias(user_id, cartao_id);
