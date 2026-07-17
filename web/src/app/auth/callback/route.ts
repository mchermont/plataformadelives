import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Troca o código do OAuth/link mágico por uma sessão.
 * O origin vem dos headers de proxy (x-forwarded-*): atrás do Railway,
 * request.url aponta para o host interno (localhost:8080).
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto") ?? "https";
  const origin = forwardedHost ? `${forwardedProto}://${forwardedHost}` : url.origin;

  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // Sem código ou troca falhou (link expirado/já usado) → login com aviso
  return NextResponse.redirect(`${origin}/login?erro=link-expirado`);
}
