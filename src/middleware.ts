import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { montarCsp } from "@/lib/seguranca";

export async function middleware(request: NextRequest) {
  const nonce = btoa(crypto.randomUUID());
  const csp = montarCsp(nonce);

  // O Next lê a CSP do cabeçalho da requisição e aplica o nonce nos próprios scripts.
  const headers = new Headers(request.headers);
  headers.set("x-nonce", nonce);
  headers.set("content-security-policy", csp);

  const response = await updateSession(request, headers);
  response.headers.set("content-security-policy", csp);
  return response;
}

export const config = {
  matcher: [
    {
      source: "/((?!_next/static|_next/image|favicon.ico|icon.svg|manifest.webmanifest|sw.js|animacoes/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|json)$).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
