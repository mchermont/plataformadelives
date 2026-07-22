import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import Header from "@/components/landing/Header";
import Hero from "@/components/landing/Hero";
import HowItWorks from "@/components/landing/HowItWorks";
import FeatureShowcase from "@/components/landing/FeatureShowcase";
import LiveDemo from "@/components/landing/LiveDemo";
import WhiteLabel from "@/components/landing/WhiteLabel";
import DirectorPanel from "@/components/landing/DirectorPanel";
import AudienceCta from "@/components/landing/AudienceCta";
import Faq from "@/components/landing/Faq";
import Footer from "@/components/landing/Footer";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "GoLive — lives com gamificação em tempo real",
  description:
    "Quiz, chat moderado, Q&A com aprovação, sorteio auditável e reações em tempo real, tudo com a marca do seu cliente. A plataforma de lives pra agências e empresas que querem participação, não só transmissão.",
};

// Home institucional: eventos são privados e acessados apenas pelo link
// direto enviado pelo organizador — esta página vende a plataforma, não
// lista eventos.
export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let isStaff = false;
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_platform_admin, is_moderator")
      .eq("id", user.id)
      .single();
    isStaff = (profile?.is_platform_admin || profile?.is_moderator) ?? false;
  }

  const authHref = isStaff ? "/admin" : !user ? "/login" : null;
  const authLabel = isStaff ? "Painel" : !user ? "Entrar" : null;

  return (
    <div className="gl-landing bg-[var(--gl-bg)] text-[var(--gl-ink)]">
      <Header authHref={authHref} authLabel={authLabel} />
      <main>
        <Hero />
        <HowItWorks />
        <FeatureShowcase />
        <LiveDemo />
        <WhiteLabel />
        <DirectorPanel />
        <AudienceCta />
        <Faq />
      </main>
      <Footer authHref={authHref} authLabel={authLabel} />
    </div>
  );
}
