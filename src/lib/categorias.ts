import type { Categoria, TipoCategoria } from "./tipos";

export type GrupoCategoria = { mae: Categoria; filhas: Categoria[] };

/** Agrupa categorias em mães → subcategorias, ordenadas por nome. */
export function agrupar(cats: Categoria[], tipo?: TipoCategoria, incluirArquivadas = false): GrupoCategoria[] {
  const lista = cats.filter((c) => (!tipo || c.tipo === tipo) && (incluirArquivadas || !c.arquivada));
  const ord = (a: Categoria, b: Categoria) => a.nome.localeCompare(b.nome, "pt-BR");
  return lista
    .filter((c) => !c.parent_id)
    .sort(ord)
    .map((mae) => ({ mae, filhas: lista.filter((f) => f.parent_id === mae.id).sort(ord) }));
}

/** id da categoria-mãe (ou a própria, se já for mãe) */
export function idMae(cats: Map<string, Categoria>, id: string | null) {
  if (!id) return null;
  const c = cats.get(id);
  return c?.parent_id ?? c?.id ?? null;
}
