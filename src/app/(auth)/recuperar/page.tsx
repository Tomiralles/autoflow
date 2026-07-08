"use client";

import { useActionState } from "react";
import Link from "next/link";
import { solicitarRecuperacion, type AuthState } from "../actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function RecuperarPage() {
  const [state, formAction, pending] = useActionState<AuthState, FormData>(
    solicitarRecuperacion,
    {}
  );

  return (
    <Card>
      <CardContent className="pt-6">
        {state.message ? (
          <p className="text-center text-sm text-slate-600">{state.message}</p>
        ) : (
          <form action={formAction} className="space-y-4">
            <p className="text-sm text-slate-500">
              Escribe tu email y te mandamos un enlace para poner una
              contraseña nueva.
            </p>
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
            {state.error && (
              <p className="text-sm font-medium text-red-600">{state.error}</p>
            )}
            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? "Enviando..." : "Enviar enlace"}
            </Button>
          </form>
        )}
        <p className="mt-4 text-center text-sm text-slate-500">
          <Link href="/login" className="font-semibold text-coral hover:underline">
            Volver a iniciar sesión
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
