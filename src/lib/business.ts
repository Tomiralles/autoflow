import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export interface Business {
  id: string;
  name: string;
  slug: string;
  sector: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  description: string | null;
  primary_color: string;
  plan: string;
  plan_status: string;
  onboarding_completed: boolean;
  public_page_settings: Record<string, unknown>;
}

// Carga el negocio del usuario con sesión, o redirige a donde toque.
// Único punto de entrada de las páginas privadas del área de la app.
export async function getBusinessOrRedirect(): Promise<Business> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: businesses } = await supabase
    .from("businesses")
    .select(
      "id, name, slug, sector, phone, email, address, description, primary_color, plan, plan_status, onboarding_completed, public_page_settings"
    )
    .eq("owner_id", user.id)
    .limit(1);

  const business = businesses?.[0];
  if (!business || !business.onboarding_completed) redirect("/onboarding");
  return business;
}
