-- Recorrências (ADR-0002 + adendo) e Open Finance via Pluggy (ADR-0008)

create type public.frequencia as enum ('semanal','mensal','anual');
create type public.tipo_recorrencia as enum ('receita','despesa','transferencia','aporte');
create type public.situacao_ocorrencia as enum ('confirmada','pulada');
create type public.situacao_importacao as enum ('pendente','importada','ignorada');

-- RECORRÊNCIAS ---------------------------------------------------------------
create table public.recorrencias (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  tipo public.tipo_recorrencia not null,
  descricao text not null check (char_length(descricao) between 1 and 120),
  valor_centavos bigint not null check (valor_centavos > 0 and valor_centavos <= 100000000000),
  frequencia public.frequencia not null default 'mensal',
  data_inicio date not null check (data_inicio between date '2000-01-01' and date '2100-12-31'),
  data_fim date check (data_fim is null or data_fim >= data_inicio),
  conta_id uuid not null,
  conta_destino_id uuid,
  categoria_id uuid,
  ativo_id uuid,
  ativa boolean not null default true,
  created_at timestamptz not null default now(),
  unique (user_id, id),
  foreign key (user_id, conta_id) references public.contas(user_id, id) on delete restrict,
  foreign key (user_id, conta_destino_id) references public.contas(user_id, id) on delete restrict,
  foreign key (user_id, categoria_id) references public.categorias(user_id, id) on delete restrict,
  foreign key (user_id, ativo_id) references public.ativos(user_id, id) on delete cascade,
  constraint recorrencia_consistente check (
    (tipo in ('receita','despesa') and categoria_id is not null and conta_destino_id is null and ativo_id is null)
    or (tipo = 'transferencia' and conta_destino_id is not null and conta_destino_id <> conta_id and categoria_id is null and ativo_id is null)
    or (tipo = 'aporte' and ativo_id is not null and categoria_id is null and conta_destino_id is null)
  )
);
create index recorrencias_user_idx on public.recorrencias(user_id) where ativa;
create index recorrencias_conta_idx on public.recorrencias(user_id, conta_id);
create index recorrencias_conta_destino_idx on public.recorrencias(user_id, conta_destino_id);
create index recorrencias_categoria_idx on public.recorrencias(user_id, categoria_id);
create index recorrencias_ativo_idx on public.recorrencias(user_id, ativo_id);

-- Categoria do tipo certo (mesma regra dos lançamentos).
create or replace function private.valida_recorrencia_categoria() returns trigger
language plpgsql set search_path = '' as $$
declare t public.tipo_categoria;
begin
  if new.categoria_id is not null then
    select tipo into t from public.categorias where id = new.categoria_id and user_id = new.user_id;
    if t::text <> new.tipo::text then
      raise exception 'Categoria de % não pode ser usada em %', t, new.tipo;
    end if;
  end if;
  return new;
end $$;
create trigger recorrencias_valida before insert or update on public.recorrencias
for each row execute function private.valida_recorrencia_categoria();

-- Ocorrências já tratadas (confirmadas ou puladas). As demais só existem calculadas.
-- Apagar o lançamento/operação gerado devolve a ocorrência para "prevista".
create table public.ocorrencias_tratadas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  recorrencia_id uuid not null,
  data_ocorrencia date not null,
  situacao public.situacao_ocorrencia not null,
  lancamento_id uuid references public.lancamentos(id) on delete cascade,
  operacao_id uuid references public.operacoes_investimento(id) on delete cascade,
  created_at timestamptz not null default now(),
  foreign key (user_id, recorrencia_id) references public.recorrencias(user_id, id) on delete cascade,
  unique (recorrencia_id, data_ocorrencia),
  constraint tratada_consistente check (
    (situacao = 'pulada' and lancamento_id is null and operacao_id is null)
    or (situacao = 'confirmada' and (lancamento_id is not null) <> (operacao_id is not null))
  )
);
create index ocorrencias_lanc_idx on public.ocorrencias_tratadas(lancamento_id);
create index ocorrencias_op_idx on public.ocorrencias_tratadas(operacao_id);
create index ocorrencias_user_idx on public.ocorrencias_tratadas(user_id, recorrencia_id);

-- OPEN FINANCE ---------------------------------------------------------------
create table public.conexoes_bancarias (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  pluggy_item_id text not null unique check (char_length(pluggy_item_id) between 1 and 64),
  instituicao text not null check (char_length(instituicao) between 1 and 120),
  status text check (status is null or char_length(status) <= 40),
  erro text check (erro is null or char_length(erro) <= 300),
  ultima_sincronizacao timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, id)
);
create index conexoes_user_idx on public.conexoes_bancarias(user_id);

create table public.contas_externas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  conexao_id uuid not null,
  pluggy_account_id text not null unique check (char_length(pluggy_account_id) between 1 and 64),
  nome text not null check (char_length(nome) between 1 and 120),
  tipo text check (tipo is null or char_length(tipo) <= 40),
  numero text check (numero is null or char_length(numero) <= 40),
  saldo_centavos bigint,
  conta_id uuid,
  importar_desde date not null default current_date,
  created_at timestamptz not null default now(),
  unique (user_id, id),
  foreign key (user_id, conexao_id) references public.conexoes_bancarias(user_id, id) on delete cascade,
  foreign key (user_id, conta_id) references public.contas(user_id, id) on delete set null (conta_id)
);
create index contas_externas_conexao_idx on public.contas_externas(user_id, conexao_id);
create index contas_externas_conta_idx on public.contas_externas(user_id, conta_id);

create table public.transacoes_importadas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  conta_externa_id uuid not null,
  pluggy_transaction_id text not null check (char_length(pluggy_transaction_id) between 1 and 64),
  data date not null,
  descricao text not null check (char_length(descricao) between 1 and 200),
  valor_centavos bigint not null check (valor_centavos <> 0 and abs(valor_centavos) <= 100000000000),
  categoria_externa text check (categoria_externa is null or char_length(categoria_externa) <= 80),
  situacao public.situacao_importacao not null default 'pendente',
  lancamento_id uuid references public.lancamentos(id) on delete set null,
  created_at timestamptz not null default now(),
  foreign key (user_id, conta_externa_id) references public.contas_externas(user_id, id) on delete cascade,
  unique (user_id, pluggy_transaction_id)
);
create index transacoes_pendentes_idx on public.transacoes_importadas(user_id, situacao, data);
create index transacoes_conta_idx on public.transacoes_importadas(user_id, conta_externa_id);
create index transacoes_lanc_idx on public.transacoes_importadas(lancamento_id);

-- RLS + dono fixo -----------------------------------------------------------------
do $$ declare t text; begin
  foreach t in array array['recorrencias','ocorrencias_tratadas','conexoes_bancarias','contas_externas','transacoes_importadas'] loop
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

-- Lançamento/operação vinculado a uma ocorrência só pode apontar para algo do mesmo usuário.
create or replace function private.valida_ocorrencia_dono() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.lancamento_id is not null and not exists (select 1 from public.lancamentos where id = new.lancamento_id and user_id = new.user_id) then
    raise exception 'Lançamento não encontrado';
  end if;
  if new.operacao_id is not null and not exists (select 1 from public.operacoes_investimento where id = new.operacao_id and user_id = new.user_id) then
    raise exception 'Operação não encontrada';
  end if;
  return new;
end $$;
create trigger ocorrencias_valida_dono before insert or update on public.ocorrencias_tratadas
for each row execute function private.valida_ocorrencia_dono();

create or replace function private.valida_importacao_dono() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.lancamento_id is not null and not exists (select 1 from public.lancamentos where id = new.lancamento_id and user_id = new.user_id) then
    raise exception 'Lançamento não encontrado';
  end if;
  return new;
end $$;
create trigger transacoes_valida_dono before insert or update on public.transacoes_importadas
for each row execute function private.valida_importacao_dono();
