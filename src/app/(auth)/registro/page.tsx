"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signup, type AuthState } from "../actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function RegistroPage() {
  const [state, formAction, pending] = useActionState<AuthState, FormData>(
    signup,
    {}
  );

  return (
    <Card>
      <CardContent className="pt-6">
        {state.message ? (
          <div className="space-y-3 py-4 text-center">
            <div className="text-4xl">📬</div>
            <p className="text-sm text-slate-700">{state.message}</p>
          </div>
        ) : (
          <>
            <form action={formAction} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="full_name">Tu nombre</Label>
                <Input
                  id="full_name"
                  name="full_name"
                  autoComplete="name"
                  placeholder="María García"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  placeholder="tu@negocio.com"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Contraseña</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  placeholder="Mínimo 8 caracteres"
                  required
                />
              </div>
              {state.error && (
                <p className="text-sm font-medium text-red-600">
                  {state.error}
                </p>
              )}
              <Button type="submit" className="w-full" disabled={pending}>
                {pending ? "Creando cuenta..." : "Crear cuenta"}
              </Button>
            </form>
            <p className="mt-4 text-center text-sm text-slate-500">
              ¿Ya tienes cuenta?{" "}
              <Link
                href="/login"
                className="font-semibold text-blue-600 hover:underline"
              >
                Inicia sesión
              </Link>
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
