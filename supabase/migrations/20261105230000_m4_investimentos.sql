-- M4 — Carteira de investimentos (ADR-0003 + ADR-0007)

create type public.classe_ativo as enum ('acao','fii','etf','bdr','cripto','fundo','previdencia','renda_fixa');
create type public.tipo_rf as enum ('cdb','lci','lca','lc','tesouro_selic','tesouro_prefixado','tesouro_ipca','debenture','cri','cra','poupanca','outro');
create type public.indexador as enum ('pos_cdi','selic','pre','ipca');
create type public.tipo_operacao as enum ('compra','venda','aplicacao','resgate');
create type public.tipo_provento as enum ('dividendo','jcp','rendimento','juros','amortizacao');
create type public.grupo_alocacao as enum ('rf_pos','rf_pre','rf_ipca','acoes','fiis','etfs','bdrs','fundos','previdencia','cripto');

-- ATIVOS --------------------------------------------------------------------
create table public.ativos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  classe public.classe_ativo not null,
  nome text not null check (char_length(nome) between 1 and 80),
  ticker text check (ticker ~ '^[A-Z0-9]{2,12}$'),
  tipo_rf public.tipo_rf,
  indexador public.indexador,
  taxa numeric(9,4) check (taxa between -100 and 1000),
  vencimento date check (vencimento between date '2000-01-01' and date '2200-12-31'),
  isento_ir boolean not null default false,
  arquivado boolean not null default false,
  created_at timestamptz not null default now(),
  unique (user_id, id),
  constraint ativo_consistente check (
    (classe in ('acao','fii','etf','bdr','cripto') and ticker is not null and tipo_rf is null and indexador is null)
    or (classe = 'renda_fixa' and ticker is null and tipo_rf is not null and indexador is not null and taxa is not null)
    or (classe in ('fundo','previdencia') and ticker is null and tipo_rf is null and indexador is null)
  )
);
create unique index ativos_ticker_unico on public.ativos(user_id, classe, ticker) where ticker is not null;
create index ativos_user_idx on public.ativos(user_id);

-- OPERAÇÕES -----------------------------------------------------------------
create table public.operacoes_investimento (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  ativo_id uuid not null,
  conta_id uuid not null,
  tipo public.tipo_operacao not null,
  data date not null check (data between date '2000-01-01' and date '2100-12-31'),
  quantidade numeric(24,8) check (quantidade > 0 and quantidade < 1e15),
  valor_centavos bigint not null check (valor_centavos > 0 and valor_centavos <= 100000000000),
  taxas_centavos bigint not null default 0 check (taxas_centavos between 0 and 100000000000),
  ir_centavos bigint not null default 0 check (ir_centavos between 0 and 100000000000),
  afeta_caixa boolean not null default true,
  observacao text check (observacao is null or char_length(observacao) <= 300),
  created_at timestamptz not null default now(),
  foreign key (user_id, ativo_id) references public.ativos(user_id, id) on delete cascade,
  foreign key (user_id, conta_id) references public.contas(user_id, id) on delete restrict,
  constraint operacao_consistente check (
    (tipo in ('compra','venda') and quantidade is not null)
    or (tipo in ('aplicacao','resgate') and quantidade is null)
  )
);
create index operacoes_ativo_idx on public.operacoes_investimento(user_id, ativo_id, data);
create index operacoes_conta_idx on public.operacoes_investimento(user_id, conta_id);

-- Tipo de operação compatível com a classe do ativo.
create or replace function private.valida_operacao() returns trigger
language plpgsql set search_path = '' as $$
declare c public.classe_ativo;
begin
  select classe into c from public.ativos where id = new.ativo_id and user_id = new.user_id;
  if c in ('acao','fii','etf','bdr','cripto') and new.tipo not in ('compra','venda') then
    raise exception 'Renda variável e cripto usam compra e venda';
  end if;
  if c in ('renda_fixa','fundo','previdencia') and new.tipo not in ('aplicacao','resgate') then
    raise exception 'Renda fixa, fundos e previdência usam aplicação e resgate';
  end if;
  return new;
end $$;
create trigger operacoes_valida before insert or update on public.operacoes_investimento
for each row execute function private.valida_operacao();

-- AVALIAÇÕES (valor do extrato numa data) -------------------------------------
create table public.avaliacoes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  ativo_id uuid not null,
  data date not null check (data between date '2000-01-01' and date '2100-12-31'),
  valor_centavos bigint not null check (valor_centavos between 0 and 100000000000),
  created_at timestamptz not null default now(),
  foreign key (user_id, ativo_id) references public.ativos(user_id, id) on delete cascade,
  unique (ativo_id, data)
);
create index avaliacoes_ativo_idx on public.avaliacoes(user_id, ativo_id, data desc);

-- PROVENTOS (cada um gera uma Receita no caixa da corretora) -----------------
create table public.proventos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  ativo_id uuid not null,
  conta_id uuid not null,
  lancamento_id uuid not null,
  tipo public.tipo_provento not null,
  data date not null check (data between date '2000-01-01' and date '2100-12-31'),
  valor_centavos bigint not null check (valor_centavos > 0 and valor_centavos <= 100000000000),
  created_at timestamptz not null default now(),
  foreign key (user_id, ativo_id) references public.ativos(user_id, id) on delete cascade,
  foreign key (user_id, conta_id) references public.contas(user_id, id) on delete restrict,
  foreign key (lancamento_id) references public.lancamentos(id) on delete cascade,
  unique (lancamento_id)
);
create index proventos_ativo_idx on public.proventos(user_id, ativo_id, data);
create index proventos_conta_idx on public.proventos(user_id, conta_id);

-- Apagar o provento apaga a receita gerada.
create or replace function private.apaga_lancamento_do_provento() returns trigger
language plpgsql set search_path = '' as $$
begin
  delete from public.lancamentos where id = old.lancamento_id and user_id = old.user_id;
  return old;
end $$;
create trigger proventos_apaga_lancamento after delete on public.proventos
for each row execute function private.apaga_lancamento_do_provento();

-- Registra provento + receita de forma atômica. SECURITY INVOKER: RLS vale normalmente.
create or replace function public.registrar_provento(
  p_ativo_id uuid, p_conta_id uuid, p_tipo public.tipo_provento, p_data date, p_valor_centavos bigint
) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_cat uuid;
  v_nome text;
  v_lanc uuid;
  v_id uuid;
begin
  if v_uid is null then raise exception 'Não autenticado'; end if;
  select nome into v_nome from public.ativos where id = p_ativo_id and user_id = v_uid;
  if v_nome is null then raise exception 'Ativo não encontrado'; end if;

  select id into v_cat from public.categorias
   where user_id = v_uid and tipo = 'receita' and nome = 'Investimentos' and parent_id is null
   order by arquivada, created_at limit 1;
  if v_cat is null then
    insert into public.categorias(user_id, nome, tipo, cor) values (v_uid, 'Investimentos', 'receita', '#0d9488')
    returning id into v_cat;
  end if;

  insert into public.lancamentos(user_id, tipo, descricao, valor_centavos, data, conta_id, categoria_id)
  values (v_uid, 'receita', left('Provento · ' || v_nome, 120), p_valor_centavos, p_data, p_conta_id, v_cat)
  returning id into v_lanc;

  insert into public.proventos(user_id, ativo_id, conta_id, lancamento_id, tipo, data, valor_centavos)
  values (v_uid, p_ativo_id, p_conta_id, v_lanc, p_tipo, p_data, p_valor_centavos)
  returning id into v_id;
  return v_id;
end $$;
revoke execute on function public.registrar_provento(uuid, uuid, public.tipo_provento, date, bigint) from public, anon;
grant execute on function public.registrar_provento(uuid, uuid, public.tipo_provento, date, bigint) to authenticated;

-- ALOCAÇÃO-ALVO ---------------------------------------------------------------
create table public.alocacao_alvo (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  grupo public.grupo_alocacao not null,
  percentual numeric(5,2) not null check (percentual between 0 and 100),
  primary key (user_id, grupo)
);

-- RLS + dono fixo em tudo ------------------------------------------------------
do $$ declare t text; begin
  foreach t in array array['ativos','operacoes_investimento','avaliacoes','proventos','alocacao_alvo'] loop
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

-- SALDOS: agora com o efeito em caixa das operações de investimento ----------------
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
  )::bigint as saldo_centavos
from public.contas c;
