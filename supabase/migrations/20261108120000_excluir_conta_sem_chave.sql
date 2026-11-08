-- ADR-0011 (revisado em 08/11/2026): excluir conta e zerar dados sem depender da chave de serviço.
-- Antes, remover o login exigia SUPABASE_SERVICE_ROLE_KEY no servidor; sem ela a exclusão ficava "indisponível".
-- Agora tudo roda no banco, sempre para o próprio usuário (auth.uid()), com 2FA (se ativo) e login recente (12 h).

-- Categorias padrão viram uma função reaproveitável (cadastro novo e "apagar meus dados").
create or replace function private.semear_categorias(uid uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare pid uuid;
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
end $$;
revoke execute on function private.semear_categorias(uuid) from public, anon, authenticated;

create or replace function private.criar_categorias_padrao() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform private.semear_categorias(new.id);
  return new;
end $$;

-- Apaga todos os dados de um usuário, em ordem de dependência. Interna: só as funções abaixo chamam.
create or replace function private.apagar_dados(u uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.regras_recebedor where user_id = u;
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
revoke execute on function private.apagar_dados(uuid) from public, anon, authenticated;

-- Confere quem chama: logado, 2FA (se ativo) e login nas últimas 12 h. Devolve o id.
create or replace function private.dono_confirmado() returns uuid
language plpgsql security definer set search_path = '' as $$
declare u uuid := auth.uid(); ultimo timestamptz;
begin
  if u is null then raise exception 'Não autenticado' using errcode = '42501'; end if;
  if not public.mfa_ok() then raise exception 'Confirme o código do autenticador' using errcode = '42501'; end if;
  select last_sign_in_at into ultimo from auth.users where id = u;
  if ultimo is null or ultimo < now() - interval '12 hours' then
    raise exception 'login_antigo' using errcode = 'P0001';
  end if;
  return u;
end $$;
revoke execute on function private.dono_confirmado() from public, anon, authenticated;

-- "Apagar meus dados": zera tudo, mantém o login e devolve as categorias padrão.
create or replace function public.apagar_meus_dados() returns void
language plpgsql security definer set search_path = '' as $$
declare u uuid := private.dono_confirmado();
begin
  perform private.apagar_dados(u);
  perform private.semear_categorias(u);
end $$;
revoke execute on function public.apagar_meus_dados() from public, anon;
grant execute on function public.apagar_meus_dados() to authenticated;

-- "Excluir minha conta": zera tudo e remove o login (sessões e fatores 2FA somem em cascata no Auth).
create or replace function public.excluir_minha_conta() returns void
language plpgsql security definer set search_path = '' as $$
declare u uuid := private.dono_confirmado();
begin
  perform private.apagar_dados(u);
  delete from auth.users where id = u;
end $$;
revoke execute on function public.excluir_minha_conta() from public, anon;
grant execute on function public.excluir_minha_conta() to authenticated;
