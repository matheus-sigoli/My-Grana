-- M1 — Base do Organizaê (já aplicada no projeto Supabase "Organizae").
-- Contas, Categorias (1 nível de subcategoria + padrão por usuário), Lançamentos e view de saldos.

create schema if not exists private;

create type public.tipo_conta as enum ('corrente','poupanca','carteira','corretora');
create type public.tipo_categoria as enum ('receita','despesa');
create type public.tipo_lancamento as enum ('receita','despesa','transferencia');
create type public.status_lancamento as enum ('previsto','efetivado');

-- CONTAS
create table public.contas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  nome text not null check (char_length(nome) between 1 and 60),
  tipo public.tipo_conta not null default 'corrente',
  saldo_inicial_centavos bigint not null default 0,
  cor text not null default '#0f766e',
  arquivada boolean not null default false,
  created_at timestamptz not null default now(),
  unique (user_id, id)
);
create index contas_user_idx on public.contas(user_id);

-- CATEGORIAS (1 nível de subcategoria)
create table public.categorias (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  nome text not null check (char_length(nome) between 1 and 40),
  tipo public.tipo_categoria not null,
  parent_id uuid,
  cor text not null default '#64748b',
  icone text,
  arquivada boolean not null default false,
  created_at timestamptz not null default now(),
  unique (user_id, id),
  foreign key (user_id, parent_id) references public.categorias(user_id, id) on delete restrict
);
create index categorias_user_idx on public.categorias(user_id);
create index categorias_parent_idx on public.categorias(user_id, parent_id);

create or replace function private.valida_categoria() returns trigger
language plpgsql set search_path = '' as $$
declare p record;
begin
  if new.parent_id is not null then
    select parent_id, tipo into p from public.categorias where id = new.parent_id and user_id = new.user_id;
    if p.parent_id is not null then
      raise exception 'Subcategoria só pode ter 1 nível';
    end if;
    if p.tipo <> new.tipo then
      raise exception 'Subcategoria deve ter o mesmo tipo da categoria-mãe';
    end if;
    if exists (select 1 from public.categorias c where c.parent_id = new.id) then
      raise exception 'Categoria com subcategorias não pode virar subcategoria';
    end if;
  end if;
  return new;
end $$;
create trigger categorias_valida before insert or update on public.categorias
for each row execute function private.valida_categoria();

-- LANÇAMENTOS
create table public.lancamentos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  tipo public.tipo_lancamento not null,
  status public.status_lancamento not null default 'efetivado',
  descricao text not null check (char_length(descricao) between 1 and 120),
  valor_centavos bigint not null check (valor_centavos > 0),
  data date not null default current_date,
  conta_id uuid not null,
  conta_destino_id uuid,
  categoria_id uuid,
  observacao text,
  created_at timestamptz not null default now(),
  foreign key (user_id, conta_id) references public.contas(user_id, id) on delete restrict,
  foreign key (user_id, conta_destino_id) references public.contas(user_id, id) on delete restrict,
  foreign key (user_id, categoria_id) references public.categorias(user_id, id) on delete restrict,
  constraint lancamento_consistente check (
    (tipo = 'transferencia' and conta_destino_id is not null and conta_destino_id <> conta_id and categoria_id is null)
    or (tipo in ('receita','despesa') and conta_destino_id is null and categoria_id is not null)
  )
);
create index lancamentos_user_data_idx on public.lancamentos(user_id, data desc);
create index lancamentos_conta_idx on public.lancamentos(user_id, conta_id);
create index lancamentos_conta_destino_idx on public.lancamentos(user_id, conta_destino_id);
create index lancamentos_categoria_idx on public.lancamentos(user_id, categoria_id);

create or replace function private.valida_lancamento_categoria() returns trigger
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
create trigger lancamentos_valida before insert or update on public.lancamentos
for each row execute function private.valida_lancamento_categoria();

-- SALDOS (view respeita RLS)
create view public.saldos_contas with (security_invoker = true) as
select c.id as conta_id, c.user_id, c.nome, c.tipo, c.cor, c.arquivada, c.saldo_inicial_centavos,
  c.saldo_inicial_centavos
  + coalesce(sum(case
      when l.tipo = 'receita' and l.conta_id = c.id then l.valor_centavos
      when l.tipo = 'despesa' and l.conta_id = c.id then -l.valor_centavos
      when l.tipo = 'transferencia' and l.conta_id = c.id then -l.valor_centavos
      when l.tipo = 'transferencia' and l.conta_destino_id = c.id then l.valor_centavos
      else 0 end), 0)::bigint as saldo_centavos
from public.contas c
left join public.lancamentos l
  on l.user_id = c.user_id and l.status = 'efetivado' and (l.conta_id = c.id or l.conta_destino_id = c.id)
group by c.id;

-- RLS
alter table public.contas enable row level security;
alter table public.categorias enable row level security;
alter table public.lancamentos enable row level security;

do $$ declare t text; begin
  foreach t in array array['contas','categorias','lancamentos'] loop
    execute format('create policy "%1$s_select_proprio" on public.%1$I for select to authenticated using ((select auth.uid()) = user_id)', t);
    execute format('create policy "%1$s_insert_proprio" on public.%1$I for insert to authenticated with check ((select auth.uid()) = user_id)', t);
    execute format('create policy "%1$s_update_proprio" on public.%1$I for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)', t);
    execute format('create policy "%1$s_delete_proprio" on public.%1$I for delete to authenticated using ((select auth.uid()) = user_id)', t);
  end loop;
end $$;

revoke all on public.contas, public.categorias, public.lancamentos, public.saldos_contas from anon;
grant select, insert, update, delete on public.contas, public.categorias, public.lancamentos to authenticated;
grant select on public.saldos_contas to authenticated;

-- CATEGORIAS PADRÃO para cada novo usuário
create or replace function private.criar_categorias_padrao() returns trigger
language plpgsql security definer set search_path = '' as $$
declare uid uuid := new.id; pid uuid;
begin
  insert into public.categorias(user_id,nome,tipo,cor,icone) values (uid,'Alimentação','despesa','#ea580c','utensils') returning id into pid;
  insert into public.categorias(user_id,nome,tipo,parent_id,cor) values (uid,'Mercado','despesa',pid,'#ea580c'),(uid,'Restaurante','despesa',pid,'#ea580c'),(uid,'Delivery','despesa',pid,'#ea580c');
  insert into public.categorias(user_id,nome,tipo,cor,icone) values (uid,'Moradia','despesa','#2563eb','home') returning id into pid;
  insert into public.categorias(user_id,nome,tipo,parent_id,cor) values (uid,'Aluguel','despesa',pid,'#2563eb'),(uid,'Contas da casa','despesa',pid,'#2563eb'),(uid,'Internet e celular','despesa',pid,'#2563eb');
  insert into public.categorias(user_id,nome,tipo,cor,icone) values (uid,'Transporte','despesa','#7c3aed','car') returning id into pid;
  insert into public.categorias(user_id,nome,tipo,parent_id,cor) values (uid,'Combustível','despesa',pid,'#7c3aed'),(uid,'Aplicativo','despesa',pid,'#7c3aed'),(uid,'Transporte público','despesa',pid,'#7c3aed');
  insert into public.categorias(user_id,nome,tipo,cor,icone) values (uid,'Saúde','despesa','#dc2626','heart') returning id into pid;
  insert into public.categorias(user_id,nome,tipo,parent_id,cor) values (uid,'Farmácia','despesa',pid,'#dc2626'),(uid,'Consultas','despesa',pid,'#dc2626');
  insert into public.categorias(user_id,nome,tipo,cor,icone) values
    (uid,'Educação','despesa','#0891b2','book'),
    (uid,'Lazer','despesa','#db2777','smile'),
    (uid,'Compras','despesa','#ca8a04','bag'),
    (uid,'Assinaturas','despesa','#4f46e5','repeat'),
    (uid,'Outros gastos','despesa','#64748b','dots');
  insert into public.categorias(user_id,nome,tipo,cor,icone) values
    (uid,'Salário','receita','#16a34a','wallet'),
    (uid,'Freelance','receita','#059669','briefcase'),
    (uid,'Investimentos','receita','#0d9488','trending'),
    (uid,'Outras receitas','receita','#65a30d','dots');
  return new;
end $$;
revoke execute on function private.criar_categorias_padrao() from public, anon, authenticated;

create trigger on_auth_user_created_categorias
after insert on auth.users
for each row execute function private.criar_categorias_padrao();
