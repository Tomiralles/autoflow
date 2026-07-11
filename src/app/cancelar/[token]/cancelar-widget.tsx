"use client";

import { useState, useTransition } from "react";
import { CalendarX2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cancelarCita } from "./actions";

export function CancelarWidget({ token }: { token: string }) {
  const [hecho, setHecho] = useState(false);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  const cancelar = () =>
    startTransition(async () => {
      setError("");
      const r = await cancelarCita(token);
      if (r.error) setError(r.error);
      else setHecho(true);
    });

  if (hecho) {
    return (
      <div className="space-y-3 text-center">
        <CheckCircle2 size={40} className="mx-auto text-green-600" />
        <p className="text-base font-semibold text-slate-900">
          Cita cancelada
        </p>
        <p className="text-sm text-slate-500">
          Gracias por avisar — así ese hueco puede aprovecharlo otra persona.
          ¡Te esperamos en otra ocasión!
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <Button
        variant="destructive"
        className="w-full rounded-xl py-3 text-base font-bold"
        disabled={pending}
        onClick={cancelar}
      >
        <CalendarX2 size={18} />
        {pending ? "Cancelando..." : "Sí, cancelar mi cita"}
      </Button>
      {error && (
        <p className="text-center text-sm font-medium text-red-600">{error}</p>
      )}
    </div>
  );
}
