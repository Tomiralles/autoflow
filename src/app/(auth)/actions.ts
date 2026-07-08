"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export interface AuthState {
  error?: string;
  message?: string;
}

// Tras iniciar sesión: al onboarding si aún no hay negocio configurado,
// al panel del día si ya lo hay.
async function destinoTrasLogin(): Promise<string> {
  const supabase = await createClient();
  const { data: businesses } = await supabase
    .from("businesses")
    .select("id, onboarding_completed")
    .limit(1);

  const business = businesses?.[0];
  if (!business || !business.onboarding_completed) return "/onboarding";
  return "/hoy";
}

export async function login(
  _prev: AuthState,
  formData: FormData
): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Escribe tu email y tu contraseña." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    if (error.code === "email_not_confirmed") {
      return { error: "Confirma tu correo antes de entrar (revisa tu bandeja)." };
    }
    return { error: "Email o contraseña incorrectos." };
  }

  redirect(await destinoTrasLogin());
}

export async function signup(
  _prev: AuthState,
  formData: FormData
): Promise<AuthState> {
  const fullName = String(formData.get("full_name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!fullName || !email || !password) {
    return { error: "Rellena todos los campos." };
  }
  if (password.length < 8) {
    return { error: "La contraseña debe tener al menos 8 caracteres." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName },
      emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/confirm`,
    },
  });

  if (error) {
    if (error.code === "user_already_exists") {
      return { error: "Ya existe una cuenta con ese email. Inicia sesión." };
    }
    if (error.code === "over_email_send_rate_limit") {
      return {
        error:
          "Demasiados intentos seguidos. Espera unos minutos y vuelve a intentarlo.",
      };
    }
    return { error: "No se pudo crear la cuenta. Inténtalo de nuevo." };
  }

  // Si Supabase exige confirmar el correo no devuelve sesión todavía
  if (!data.session) {
    return {
      message:
        "Cuenta creada. Revisa tu correo y pulsa el enlace de confirmación para entrar.",
    };
  }

  redirect("/onboarding");
}

export async function solicitarRecuperacion(
  _prev: AuthState,
  formData: FormData
): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim();
  if (!email) return { error: "Escribe tu email." };

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/restablecer`,
  });

  if (error?.code === "over_email_send_rate_limit") {
    return { error: "Demasiados intentos seguidos. Espera unos minutos." };
  }
  // No confirmamos ni desmentimos si el email existe: mismo mensaje siempre.
  return {
    message:
      "Si ese email tiene una cuenta, te hemos enviado un enlace para recuperar el acceso.",
  };
}

export async function logout(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
