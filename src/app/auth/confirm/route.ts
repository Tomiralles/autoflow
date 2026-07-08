import { type NextRequest, NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

// Destino compartido de los enlaces de email de Supabase (confirmación de
// registro y recuperación de contraseña). Las plantillas "Confirm signup" y
// "Reset password" deben apuntar aquí con
// {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email|recovery
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  if (token_hash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash });
    if (!error) {
      const destino = type === "recovery" ? "/restablecer" : "/onboarding";
      return NextResponse.redirect(new URL(destino, request.url));
    }
  }

  return NextResponse.redirect(
    new URL("/login?error=confirmacion", request.url)
  );
}
