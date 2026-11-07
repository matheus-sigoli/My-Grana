import { type EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

const TIPOS_OTP: EmailOtpType[] = ["signup", "email", "invite", "magiclink", "recovery", "email_change"];

// Recebe o link do e-mail de confirmação (fluxo PKCE com ?code= ou ?token_hash=&type=).
// Sempre redireciona para dentro do próprio site (nada de ?next= vindo da URL: evita open redirect).
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const supabase = await createClient();

  if (code && code.length < 256) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}/`);
  } else if (tokenHash && tokenHash.length < 256 && type && TIPOS_OTP.includes(type)) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) return NextResponse.redirect(`${origin}/`);
  }
  return NextResponse.redirect(`${origin}/login?erro=link`);
}
