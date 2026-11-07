-- Restrições de formato no banco: valem mesmo para quem chamar a API do Supabase direto (sem o app).

alter table public.contas
  add constraint contas_cor_hex check (cor ~ '^#[0-9a-fA-F]{6}$'),
  add constraint contas_saldo_inicial_limite check (abs(saldo_inicial_centavos) <= 100000000000);

alter table public.categorias
  add constraint categorias_cor_hex check (cor ~ '^#[0-9a-fA-F]{6}$'),
  add constraint categorias_icone_curto check (icone is null or char_length(icone) <= 30);

alter table public.lancamentos
  add constraint lancamentos_valor_limite check (valor_centavos <= 100000000000),
  add constraint lancamentos_data_faixa check (data between date '2000-01-01' and date '2100-12-31'),
  add constraint lancamentos_observacao_curta check (observacao is null or char_length(observacao) <= 500);

-- O tipo de uma categoria (receita/despesa) não muda depois de criada:
-- lançamentos antigos dependem dele e a regra de consistência seria burlada.
create or replace function private.bloqueia_troca_tipo_categoria() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.tipo is distinct from old.tipo then
    raise exception 'O tipo da categoria não pode ser alterado';
  end if;
  return new;
end $$;

create trigger categorias_tipo_fixo before update of tipo on public.categorias
for each row execute function private.bloqueia_troca_tipo_categoria();

-- Ninguém transfere linhas para outro dono, nem pela API.
create or replace function private.bloqueia_troca_dono() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.user_id is distinct from old.user_id then
    raise exception 'Não é permitido trocar o dono do registro';
  end if;
  return new;
end $$;

create trigger contas_dono_fixo before update of user_id on public.contas
for each row execute function private.bloqueia_troca_dono();
create trigger categorias_dono_fixo before update of user_id on public.categorias
for each row execute function private.bloqueia_troca_dono();
create trigger lancamentos_dono_fixo before update of user_id on public.lancamentos
for each row execute function private.bloqueia_troca_dono();
