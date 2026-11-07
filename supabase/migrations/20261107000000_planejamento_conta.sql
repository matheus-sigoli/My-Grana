-- M3 Planejamento (orçamento, metas), M5 importação de arquivos, M8 notificações push,
-- M9 IA (limite de uso), M10 conta (preferências, 2FA obrigatório no banco, apagar meus dados).

-- ORÇAMENTOS: limite mensal por categoria-mãe de despesa ---------------------------------
create table public.orcamentos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  categoria_id uuid not null,
  valor_centavos bigint not null check (valor_centavos > 0 and valor_centavos <= 100000000000),
  created_at timestamptz not null default now(),
  unique (user_id, categoria_id),
  foreign key (user_id, categoria_id) references public.categorias(user_id, id) on delete cascade
);

create or replace function private.valida_orcamento() returns trigger
language plpgsql set search_path = '' as $$
declare c record;
begin
  select tipo, parent_id into c from public.categorias where id = new.categoria_id and user_id = new.user_id;
  if c.tipo is distinct from 'despesa' or c.parent_id is not null then
    raise exception 'Orçamento só em categoria-mãe de despesa';
  end if;
  return new;
end $$;
create trigger orcamentos_valida before insert or update on public.orcamentos
for each row execute function private.valida_orcamento();

-- METAS (ADR-0004): economia lê o saldo de uma Conta; patrimônio e renda passiva leem os totais --------
create type public.tipo_meta as enum ('economia', 'patrimonio', 'renda_passiva');
create table public.metas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  nome text not null check (char_length(nome) between 1 and 80),
  tipo public.tipo_meta not null,
  valor_alvo_centavos bigint not null check (valor_alvo_centavos > 0 and valor_alvo_centavos <= 100000000000),
  prazo date check (prazo is null or prazo between date '2000-01-01' and date '2100-12-31'),
  conta_id uuid,
  created_at timestamptz not null default now(),
  unique (user_id, id),
  foreign key (user_id, conta_id) references public.contas(user_id, id) on delete restrict,
  constraint meta_consistente check ((tipo = 'economia') = (conta_id is not null))
);
create index metas_user_idx on public.metas(user_id);
create index metas_conta_idx on public.metas(user_id, conta_id);

-- IMPORTAÇÃO DE ARQUIVOS (ADR-0006): a mesma caixa de entrada do Open Finance -----------------------
create type public.origem_importacao as enum ('openfinance', 'arquivo');
alter table public.transacoes_importadas
  add column origem public.origem_importacao not null default 'openfinance',
  add column conta_id uuid,
  add column cartao_id uuid,
  alter column conta_externa_id drop not null,
  add foreign key (user_id, conta_id) references public.contas(user_id, id) on delete cascade,
  add foreign key (user_id, cartao_id) references public.cartoes(user_id, id) on delete cascade,
  add constraint transacao_destino check (
    (origem = 'openfinance' and conta_externa_id is not null and conta_id is null and cartao_id is null)
    or (origem = 'arquivo' and conta_externa_id is null and ((conta_id is not null) <> (cartao_id is not null)))
  );
create index transacoes_conta_direta_idx on public.transacoes_importadas(user_id, conta_id);
create index transacoes_cartao_idx on public.transacoes_importadas(user_id, cartao_id);

-- NOTIFICAÇÕES PUSH: uma linha por navegador/aparelho inscrito ----------------------------------
create table public.inscricoes_push (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  endpoint text not null unique check (endpoint ~ '^https://' and char_length(endpoint) <= 1000),
  p256dh text not null check (char_length(p256dh) between 1 and 200),
  auth text not null check (char_length(auth) between 1 and 100),
  created_at timestamptz not null default now()
);
create index inscricoes_push_user_idx on public.inscricoes_push(user_id);

-- PREFERÊNCIAS: painel configurável e consentimento da IA ----------------------------------------
create table public.preferencias (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  ia_ativada boolean not null default false,
  painel_blocos text[] not null default array['previstos','cartoes','orcamento','metas','categorias','contas','grafico','recentes'],
  updated_at timestamptz not null default now(),
  constraint blocos_validos check (
    cardinality(painel_blocos) <= 12
    and painel_blocos <@ array['previstos','cartoes','orcamento','metas','categorias','contas','grafico','recentes']
  )
);

-- RLS + dono fixo nas tabelas novas (mesmo padrão das anteriores) ------------------------------------
do $$ declare t text; begin
  foreach t in array array['orcamentos','metas','inscricoes_push','preferencias'] loop
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

-- USO DA IA: contador diário que o usuário lê, mas só a função escreve (não dá para zerar o limite) --
create table public.uso_ia (
  user_id uuid not null references auth.users(id) on delete cascade,
  dia date not null,
  pedidos integer not null default 0 check (pedidos >= 0),
  primary key (user_id, dia)
);
alter table public.uso_ia enable row level security;
create policy "uso_ia_select_proprio" on public.uso_ia for select to authenticated using ((select auth.uid()) = user_id);
revoke all on public.uso_ia from anon, authenticated;
grant select on public.uso_ia to authenticated;

create or replace function public.registrar_uso_ia() returns integer
language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  if auth.uid() is null then raise exception 'Não autenticado'; end if;
  insert into public.uso_ia (user_id, dia, pedidos)
  values (auth.uid(), (now() at time zone 'America/Sao_Paulo')::date, 1)
  on conflict (user_id, dia) do update set pedidos = public.uso_ia.pedidos + 1
  returning pedidos into n;
  return n;
end $$;
revoke execute on function public.registrar_uso_ia() from public, anon;
grant execute on function public.registrar_uso_ia() to authenticated;

-- 2FA OBRIGATÓRIO NO BANCO: quem ativou o autenticador só lê/escreve com sessão aal2 ---------------
-- (defesa em profundidade: o app também redireciona para a verificação)
create or replace function public.mfa_ok() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((auth.jwt() ->> 'aal') = 'aal2', false)
      or not exists (select 1 from auth.mfa_factors f where f.user_id = auth.uid() and f.status = 'verified');
$$;
revoke execute on function public.mfa_ok() from public, anon;
grant execute on function public.mfa_ok() to authenticated;

do $$ declare t text; begin
  foreach t in array array[
    'contas','categorias','lancamentos','ativos','operacoes_investimento','avaliacoes','proventos','alocacao_alvo',
    'recorrencias','ocorrencias_tratadas','conexoes_bancarias','contas_externas','transacoes_importadas','cartoes',
    'pagamentos_fatura','orcamentos','metas','inscricoes_push','preferencias','uso_ia'
  ] loop
    execute format('create policy "%1$s_exige_2fa" on public.%1$I as restrictive for all to authenticated using ((select public.mfa_ok())) with check ((select public.mfa_ok()))', t);
  end loop;
end $$;

-- APAGAR MEUS DADOS: em ordem de dependência (as FKs entre tabelas do usuário são RESTRICT) ------------
create or replace function public.apagar_meus_dados() returns void
language plpgsql security definer set search_path = '' as $$
declare u uuid := auth.uid();
begin
  if u is null then raise exception 'Não autenticado'; end if;
  if not public.mfa_ok() then raise exception 'Confirme o código do autenticador'; end if;
  delete from public.ocorrencias_tratadas where user_id = u;
  delete from public.transacoes_importadas where user_id = u;
  delete from public.contas_externas where user_id = u;
  delete from public.conexoes_bancarias where user_id = u;
  delete from public.recorrencias where user_id = u;
  delete from public.proventos where user_id = u;
  delete from public.avaliacoes where user_id = u;
  delete from public.operacoes_investimento where user_id = u;
  delete from public.alocacao_alvo where user_id = u;
  delete from public.pagamentos_fatura where user_id = u;
  delete from public.lancamentos where user_id = u;
  delete from public.ativos where user_id = u;
  delete from public.metas where user_id = u;
  delete from public.orcamentos where user_id = u;
  delete from public.cartoes where user_id = u;
  delete from public.categorias where user_id = u and parent_id is not null;
  delete from public.categorias where user_id = u;
  delete from public.contas where user_id = u;
  delete from public.inscricoes_push where user_id = u;
  delete from public.preferencias where user_id = u;
  delete from public.uso_ia where user_id = u;
end $$;
revoke execute on function public.apagar_meus_dados() from public, anon;
grant execute on function public.apagar_meus_dados() to authenticated;
