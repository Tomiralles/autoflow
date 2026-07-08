"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Se llega aquí tras pulsar el enlace del email de recuperación. Supabase
// entrega la sesión de recuperación como fragmento de URL (#access_token=...),
// que solo el navegador puede leer — por eso el cambio de contraseña se
// hace aquí con el cliente de navegador, no con una server action (el
// servidor nunca ve el fragmento).
export default function RestablecerPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres.");
      return;
    }
    setPending(true);
    setError("");
    const supabase = createClient();
    const { error: err } = await supabase.auth.updateUser({ password });
    setPending(false);
    if (err) {
      setError(
        "No se pudo cambiar la contraseña. Pide un nuevo enlace desde /recuperar."
      );
      return;
    }
    router.push("/hoy");
  };

  return (
    <Card>
      <CardContent className="pt-6">
        <form onSubmit={guardar} className="space-y-4">
          <p className="text-sm text-slate-500">Elige tu nueva contraseña.</p>
          <div className="space-y-2">
            <Label htmlFor="password">Contraseña nueva</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          {error && (
            <p className="text-sm font-medium text-red-600">{error}</p>
          )}
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Guardando..." : "Guardar contraseña"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
