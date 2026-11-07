"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

export type Tema = "sistema" | "claro" | "escuro";
const TEMAS: Tema[] = ["sistema", "claro", "escuro"];

/** Guarda a preferência num cookie (1 ano). "sistema" apaga o cookie e segue o aparelho. */
export async function definirTema(tema: Tema) {
  if (!TEMAS.includes(tema)) return;
  const c = await cookies();
  if (tema === "sistema") c.delete("tema");
  else c.set("tema", tema, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax", httpOnly: true, secure: process.env.NODE_ENV === "production" });
  revalidatePath("/", "layout");
}
