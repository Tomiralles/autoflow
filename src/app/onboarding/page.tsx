"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Copy, ExternalLink } from "lucide-react";
import {
  crearNegocio,
  completarOnboarding,
  type ServiceInput,
} from "./actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { TEMAS } from "@/lib/temas";
import {
  HorarioEditor,
  HORARIO_POR_DEFECTO,
  type Horario,
} from "@/components/horario-editor";

const SECTORS = [
  { id: "estetica", label: "💆 Clínica / Estética" },
  { id: "taller", label: "🔧 Taller Mecánico" },
  { id: "peluqueria", label: "✂️ Peluquería / Barbería" },
  { id: "retail", label: "🛍️ Tienda Retail" },
  { id: "servicios", label: "💼 Servicios Profesionales" },
  { id: "otro", label: "🏢 Otro" },
];

const STEPS = ["Tu negocio", "Servicios", "¡Listo!"];

function generarSlug(nombre: string): string {
  return nombre
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .slice(0, 30);
}

const SERVICIO_VACIO: ServiceInput = {
  name: "",
  description: "",
  price: "",
  duration_minutes: 60,
};

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [slugEditado, setSlugEditado] = useState(false);
  const [slugError, setSlugError] = useState("");
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [biz, setBiz] = useState({
    name: "",
    slug: "",
    sector: "servicios",
    phone: "",
    primary_color: TEMAS[0].primary,
    secondary_color: TEMAS[0].secondary,
  });
  const [horario, setHorario] = useState<Horario>(HORARIO_POR_DEFECTO);
  const [services, setServices] = useState<ServiceInput[]>([
    { ...SERVICIO_VACIO },
  ]);

  const updateBiz = (field: string, value: string) =>
    setBiz((prev) => ({ ...prev, [field]: value }));

  const handleCrearNegocio = async () => {
    setSaving(true);
    setSlugError("");
    try {
      const result = await crearNegocio({ ...biz, working_hours: horario });
      if (result.slugTaken) {
        setSlugError("Esta URL ya está en uso. Elige otra.");
      } else if (result.error) {
        toast.error(result.error);
      } else if (result.businessId) {
        setBusinessId(result.businessId);
        setStep(1);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleFinalizar = async () => {
    if (!businessId) return;
    setSaving(true);
    try {
      const result = await completarOnboarding(businessId, services);
      if (result.error) {
        toast.error(result.error);
      } else {
        setStep(2);
      }
    } finally {
      setSaving(false);
    }
  };

  const updateService = (
    idx: number,
    field: keyof ServiceInput,
    value: string | number
  ) => {
    setServices((prev) =>
      prev.map((s, i) => (i === idx ? { ...s, [field]: value } : s))
    );
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-lg">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-coral text-2xl shadow-sm">
            ⚡
          </div>
          <h1 className="text-2xl font-bold text-brand-ink">
            Bienvenido a AutoFlow AI
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Configura tu negocio en 2 pasos
          </p>
        </div>

        {/* Indicador de pasos */}
        <div className="mb-8 flex items-center justify-center gap-2">
          {STEPS.map((label, i) => (
            <div key={label} className="flex items-center gap-2">
              {i > 0 && <span className="text-slate-300">›</span>}
              <div
                className={`rounded-xl px-3 py-2 text-xs font-semibold transition-all ${
                  i === step
                    ? "bg-coral text-coral-fg"
                    : i < step
                      ? "bg-green-100 text-green-700"
                      : "bg-slate-100 text-slate-500"
                }`}
              >
                {label}
              </div>
            </div>
          ))}
        </div>

        {step === 0 && (
          <Card>
            <CardContent className="space-y-5 pt-6">
              <h2 className="font-bold text-slate-900">
                Cuéntanos sobre tu negocio
              </h2>
              <div className="space-y-2">
                <Label htmlFor="name">Nombre del negocio *</Label>
                <Input
                  id="name"
                  placeholder="Ej: Clínica Estética María"
                  value={biz.name}
                  onChange={(e) => {
                    updateBiz("name", e.target.value);
                    if (!slugEditado)
                      updateBiz("slug", generarSlug(e.target.value));
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="slug">URL pública</Label>
                <div className="flex items-center overflow-hidden rounded-md border border-input focus-within:ring-2 focus-within:ring-ring">
                  <span className="shrink-0 border-r bg-slate-50 px-3 py-2 text-sm text-slate-400">
                    /
                  </span>
                  <input
                    id="slug"
                    className="w-full bg-transparent px-3 py-2 text-sm outline-none"
                    placeholder="mi-clinica"
                    value={biz.slug}
                    onChange={(e) => {
                      setSlugEditado(true);
                      setSlugError("");
                      updateBiz(
                        "slug",
                        e.target.value
                          .toLowerCase()
                          .replace(/\s+/g, "-")
                          .replace(/[^a-z0-9-]/g, "")
                      );
                    }}
                  />
                </div>
                {slugError && (
                  <p className="text-xs font-medium text-red-600">
                    {slugError}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Tipo de negocio *</Label>
                <div className="grid grid-cols-2 gap-2">
                  {SECTORS.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => updateBiz("sector", s.id)}
                      className={`rounded-xl border-2 px-3 py-2.5 text-left text-sm font-medium transition-all ${
                        biz.sector === s.id
                          ? "border-coral bg-coral-soft text-coral"
                          : "border-slate-200 text-slate-700 hover:border-slate-300"
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Teléfono de contacto</Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="+34 600 000 000"
                  value={biz.phone}
                  onChange={(e) => updateBiz("phone", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Tema de color</Label>
                <p className="text-xs text-slate-500">
                  Así se verá tu página de reservas. Puedes cambiarlo cuando
                  quieras.
                </p>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                  {TEMAS.map((t) => {
                    const activo = biz.primary_color === t.primary;
                    return (
                      <button
                        key={t.nombre}
                        type="button"
                        onClick={() => {
                          updateBiz("primary_color", t.primary);
                          updateBiz("secondary_color", t.secondary);
                        }}
                        className={`flex flex-col items-center gap-1.5 rounded-xl border-2 p-2 transition-colors ${
                          activo
                            ? "border-slate-900"
                            : "border-slate-100 hover:border-slate-300"
                        }`}
                      >
                        <span
                          className="flex h-10 w-full items-center justify-center rounded-lg"
                          style={{ backgroundColor: t.secondary }}
                        >
                          <span
                            className="h-4 w-4 rounded-full ring-2 ring-white/30"
                            style={{ backgroundColor: t.primary }}
                          />
                        </span>
                        <span className="text-[11px] font-medium text-slate-600">
                          {t.nombre}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Horario de apertura</Label>
                <p className="text-xs text-slate-500">
                  Por defecto: lunes a sábado de 9:00 a 19:00, domingo
                  cerrado. Cámbialo si el tuyo es distinto.
                </p>
                <HorarioEditor value={horario} onChange={setHorario} />
              </div>
              <Button
                className="w-full"
                disabled={saving || !biz.name.trim()}
                onClick={handleCrearNegocio}
              >
                {saving ? "Creando..." : "Continuar →"}
              </Button>
            </CardContent>
          </Card>
        )}

        {step === 1 && (
          <Card>
            <CardContent className="space-y-5 pt-6">
              <div>
                <h2 className="font-bold text-slate-900">
                  Añade tus servicios
                </h2>
                <p className="mt-0.5 text-sm text-slate-500">
                  Los clientes los verán en tu página pública
                </p>
              </div>
              <div className="space-y-4">
                {services.map((service, idx) => (
                  <div key={idx} className="space-y-3 rounded-xl bg-slate-50 p-4">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-slate-700">
                        Servicio {idx + 1}
                      </p>
                      {services.length > 1 && (
                        <button
                          type="button"
                          className="text-xs font-medium text-red-500"
                          onClick={() =>
                            setServices((prev) =>
                              prev.filter((_, i) => i !== idx)
                            )
                          }
                        >
                          Eliminar
                        </button>
                      )}
                    </div>
                    <Input
                      className="bg-white"
                      placeholder="Nombre del servicio *"
                      value={service.name}
                      onChange={(e) =>
                        updateService(idx, "name", e.target.value)
                      }
                    />
                    <Textarea
                      rows={2}
                      className="resize-none bg-white"
                      placeholder="Descripción breve"
                      value={service.description}
                      onChange={(e) =>
                        updateService(idx, "description", e.target.value)
                      }
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        type="number"
                        className="bg-white"
                        placeholder="Precio €"
                        value={service.price}
                        onChange={(e) =>
                          updateService(idx, "price", e.target.value)
                        }
                      />
                      <Input
                        type="number"
                        className="bg-white"
                        placeholder="Duración (min)"
                        value={service.duration_minutes}
                        onChange={(e) =>
                          updateService(
                            idx,
                            "duration_minutes",
                            parseInt(e.target.value) || 0
                          )
                        }
                      />
                    </div>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() =>
                  setServices((prev) => [...prev, { ...SERVICIO_VACIO }])
                }
                className="w-full rounded-xl border-2 border-dashed border-slate-300 py-2.5 text-sm font-medium text-slate-500 transition-colors hover:border-coral hover:text-coral"
              >
                + Añadir otro servicio
              </button>
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setStep(0)}>
                  Atrás
                </Button>
                <Button
                  className="flex-1"
                  disabled={saving}
                  onClick={handleFinalizar}
                >
                  {saving ? "Guardando..." : "Finalizar configuración"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {step === 2 && <PasoFinal slug={biz.slug} router={router} />}
      </div>
    </main>
  );
}

// Momento de venta: el dueño acaba de configurar su negocio y es el
// instante ideal para que copie/comparta su enlace (Instagram, WhatsApp).
function PasoFinal({
  slug,
  router,
}: {
  slug: string;
  router: ReturnType<typeof useRouter>;
}) {
  const [copiado, setCopiado] = useState(false);
  const url =
    typeof window !== "undefined" ? `${window.location.origin}/${slug}` : "";

  const copiar = async () => {
    await navigator.clipboard.writeText(url);
    setCopiado(true);
    toast.success("Enlace copiado");
    setTimeout(() => setCopiado(false), 2000);
  };

  return (
    <Card>
      <CardContent className="space-y-5 pt-8 pb-8 text-center">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-green-100 text-4xl">
          ✓
        </div>
        <div>
          <h2 className="text-xl font-bold text-slate-900">
            ¡Tu negocio está listo!
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            Tus recordatorios y seguimientos automáticos ya están activados.
          </p>
        </div>
        <div className="space-y-2 text-left">
          <Label>Tu página de reservas</Label>
          <p className="text-xs text-slate-500">
            Compártela en Instagram, WhatsApp o un cartel del local.
          </p>
          <div className="flex items-center gap-2">
            <p className="min-w-0 flex-1 truncate rounded-md border bg-slate-50 px-3 py-2 text-sm text-slate-700">
              {url}
            </p>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={copiar}
              title="Copiar enlace"
            >
              {copiado ? <Check size={15} /> : <Copy size={15} />}
            </Button>
            <Button type="button" variant="outline" size="icon" asChild>
              <a href={url} target="_blank" rel="noopener noreferrer" title="Ver página">
                <ExternalLink size={15} />
              </a>
            </Button>
          </div>
        </div>
        <Button className="w-full" onClick={() => router.push("/hoy")}>
          Ir a mi panel →
        </Button>
      </CardContent>
    </Card>
  );
}
