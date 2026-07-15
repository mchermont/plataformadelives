import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Troca o código do OAuth (Google) por uma sessão e volta para a página de origem.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/?erro=autenticacao`);
}
