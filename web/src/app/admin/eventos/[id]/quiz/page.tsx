import { redirect } from "next/navigation";

// O quiz agora vive no bloco "Atividades interativas" do painel Diretor.
export default async function QuizAdminPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/admin/eventos/${id}/live`);
}
