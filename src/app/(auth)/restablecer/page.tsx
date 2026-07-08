"use client";

import { useActionState } from "react";
import { restablecerPassword, type AuthState } from "../actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Se llega aquí tras pulsar el enlace del email de recuperación, que ya
// deja una sesión de recuperación activa (ver /auth/confirm). No hace
// falta la contraseña antigua.
export default function RestablecerPage() {
  const [state, formAction, pending] = useActionState<AuthState, FormData>(
    restablecerPassword,
    {}
  );

  return (
    <Card>
      <CardContent className="pt-6">
        <form action={formAction} className="space-y-4">
          <p className="text-sm text-slate-500">Elige tu nueva contraseña.</p>
          <div className="space-y-2">
            <Label htmlFor="password">Contraseña nueva</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              required
            />
          </div>
          {state.error && (
            <p className="text-sm font-medium text-red-600">{state.error}</p>
          )}
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Guardando..." : "Guardar contraseña"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
