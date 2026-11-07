"use client";
import { useActionState, useState } from "react";
import { salvarCategoria } from "@/app/(app)/categorias/actions";
import { BotaoEnviar } from "@/components/botao-enviar";
import { Erro } from "@/components/erro";
import { ESTADO_INICIAL, type Categoria, type TipoCategoria } from "@/lib/tipos";

const CORES: [string, string][] = [["#ea580c", "Laranja"], ["#2563eb", "Azul"], ["#7c3aed", "Roxo"], ["#dc2626", "Vermelho"], ["#0891b2", "Turquesa"], ["#db2777", "Rosa"], ["#ca8a04", "Mostarda"], ["#4f46e5", "Anil"], ["#16a34a", "Verde"], ["#0d9488", "Verde-água"], ["#64748b", "Cinza"]];

export function FormCategoria({ categoria, maes, temFilhas = false }: { categoria?: Categoria; maes: Categoria[]; temFilhas?: boolean }) {
  const [estado, acao] = useActionState(salvarCategoria, ESTADO_INICIAL);
  const [tipo, setTipo] = useState<TipoCategoria>(categoria?.tipo ?? "despesa");
  const opcoesMae = maes.filter((m) => m.tipo === tipo && m.id !== categoria?.id && !m.arquivada);

  return (
    <form action={acao} className="space-y-4">
      {categoria && <input type="hidden" name="id" value={categoria.id} />}
      <div className="grid grid-cols-2 gap-1 rounded-full bg-fundo p-1" role="radiogroup" aria-label="Tipo">
        {(["despesa", "receita"] as const).map((t) => (
          <label key={t} className={`${categoria ? "pointer-events-none" : "cursor-pointer"} flex min-h-10 items-center justify-center rounded-full text-sm font-bold capitalize has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-marca ${tipo === t ? (t === "despesa" ? "bg-despesa text-white" : "bg-receita text-white") : "text-suave"}`}>
            <input type="radio" name="tipo" value={t} checked={tipo === t} onChange={() => setTipo(t)} disabled={!!categoria && categoria.tipo !== t} className="sr-only" />
            {t}
          </label>
        ))}
      </div>
      <div>
        <label className="rotulo" htmlFor="nome">Nome</label>
        <input id="nome" name="nome" defaultValue={categoria?.nome} required maxLength={40} className="campo" />
      </div>
      <div>
        <label className="rotulo" htmlFor="parent_id">Dentro de (opcional)</label>
        <select id="parent_id" name="parent_id" defaultValue={categoria?.parent_id ?? ""} disabled={temFilhas} className="campo" key={tipo}>
          <option value="">— É uma categoria principal —</option>
          {opcoesMae.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
        </select>
        {temFilhas && <p className="mt-1 text-xs text-suave">Tem subcategorias, então continua sendo principal.</p>}
      </div>
      <fieldset>
        <legend className="rotulo">Cor</legend>
        <div className="flex flex-wrap gap-2">
          {CORES.map(([c, nome], i) => (
            <label key={c} className="cursor-pointer" title={nome}>
              <input type="radio" name="cor" value={c} aria-label={nome} defaultChecked={categoria ? categoria.cor === c || (i === 0 && !CORES.some(([x]) => x === categoria.cor)) : i === 0} className="peer sr-only" />
              <span className="block size-8 rounded-full ring-offset-2 peer-checked:ring-2 peer-checked:ring-tinta peer-focus-visible:outline-2 peer-focus-visible:outline-offset-4 peer-focus-visible:outline-marca" style={{ background: c }} aria-hidden="true" />
            </label>
          ))}
        </div>
      </fieldset>
      <Erro msg={estado.erro} />
      <BotaoEnviar>{categoria ? "Salvar" : "Criar categoria"}</BotaoEnviar>
    </form>
  );
}
