import { cookies } from "next/headers";
import type { Tema } from "@/app/tema/actions";

export async function temaAtual(): Promise<Tema> {
  const v = (await cookies()).get("tema")?.value;
  return v === "claro" || v === "escuro" ? v : "sistema";
}
