import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { friendlyError } from "@/lib/friendlyError";

/**
 * Convida alguém pra equipe de um cliente/agência: reaproveita a RPC
 * `invite_to_client`/`invite_to_agency` (já existente, security definer,
 * é ela quem valida permissão via `is_client_admin`/`is_agency_admin` —
 * não duplicamos essa checagem aqui) rodando com a sessão de quem chamou.
 * A diferença é que, quando a RPC retorna "invited" (e-mail novo, sem
 * conta ainda — se já existisse conta ela já teria sido adicionada
 * direto, sem precisar de convite), essa rota MANDA o e-mail de verdade
 * via Admin API do Supabase (mesmo SMTP já configurado no projeto). Antes
 * disso só existia o convite pendente no banco, sem nenhum aviso pra
 * pessoa — ela só entrava se alguém avisasse por fora.
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const { orgKind, orgId, email, role } = await req.json();
    if ((orgKind !== "client" && orgKind !== "agency") || !orgId || !email || !role) {
      return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
    }
    const cleanEmail = String(email).trim().toLowerCase();

    const { data: result, error: rpcError } = await supabase.rpc(`invite_to_${orgKind}`, {
      [`p_${orgKind}_id`]: orgId,
      p_email: cleanEmail,
      p_role: role,
    });
    if (rpcError) {
      return NextResponse.json({ error: friendlyError(rpcError.message) }, { status: 400 });
    }

    if (result === "invited") {
      try {
        const admin = createAdminClient();
        const { error: emailError } = await admin.auth.admin.inviteUserByEmail(cleanEmail);
        // "already been registered" é esperado se a pessoa criou conta entre
        // a checagem da RPC e agora — nesse caso ela já foi adicionada como
        // membro direto na próxima tentativa, não precisa travar por isso.
        if (emailError && !emailError.message?.toLowerCase().includes("already been registered")) {
          console.error("Erro ao enviar e-mail de convite:", emailError.message);
        }
      } catch (err) {
        console.error("Erro ao enviar e-mail de convite:", err instanceof Error ? err.message : err);
      }
    }

    return NextResponse.json({ success: true, result });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro interno";
    return NextResponse.json({ error: friendlyError(message) }, { status: 500 });
  }
}
