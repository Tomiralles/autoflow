import { type NextRequest, NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

// Destino del enlace de confirmación del email de registro.
// Nota: la plantilla "Confirm signup" de Supabase debe apuntar aquí con
// {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  if (token_hash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash });
    if (!error) {
      return NextResponse.redirect(new URL("/onboarding", request.url));
    }
  }

  return NextResponse.redirect(
    new URL("/login?error=confirmacion", request.url)
  );
}
