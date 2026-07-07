"use client";

import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  Check,
  Copy,
  ExternalLink,
  Image as ImageIcon,
  Pencil,
  Plus,
  Upload,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { logout } from "@/app/(auth)/actions";
import {
  crearServicio,
  editarServicio,
  guardarApariencia,
  guardarNegocio,
  toggleServicio,
  type NegocioInput,
  type ServicioInput,
} from "./actions";

// ---------- URL pública ----------

// El origen (protocolo+dominio) lo calcula el servidor a partir del host
// real de la petición (ver ajustes/page.tsx) — así no depende de
// NEXT_PUBLIC_APP_URL ni hay riesgo de desajuste en la hidratación.
function UrlPublica({ url }: { url: string }) {
  const [copiado, setCopiado] = useState(false);

  const copiar = async () => {
    await navigator.clipboard.writeText(url);
    setCopiado(true);
    toast.success("Enlace copiado");
    setTimeout(() => setCopiado(false), 2000);
  };

  return (
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
  );
}

// ---------- Datos del negocio ----------

export function FormNegocio({
  businessId,
  inicial,
  slug,
  origen,
}: {
  businessId: string;
  inicial: NegocioInput;
  slug: string;
  origen: string;
}) {
  const [form, setForm] = useState(inicial);
  const [pending, startTransition] = useTransition();
  const set = (field: keyof NegocioInput, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const guardar = () =>
    startTransition(async () => {
      const r = await guardarNegocio(businessId, form);
      if (r.error) toast.error(r.error);
      else toast.success("Cambios guardados");
    });

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="aj-nombre">Nombre del negocio</Label>
        <Input
          id="aj-nombre"
          value={form.name}
          onChange={(e) => set("name", e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label>Tu página de reservas</Label>
        <p className="text-xs text-slate-500">
          Compártela con tus clientes: Instagram, WhatsApp, un cartel...
        </p>
        <UrlPublica url={`${origen}/${slug}`} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="aj-tel">Teléfono</Label>
          <Input
            id="aj-tel"
            type="tel"
            value={form.phone}
            onChange={(e) => set("phone", e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="aj-email">Email</Label>
          <Input
            id="aj-email"
            type="email"
            value={form.email}
            onChange={(e) => set("email", e.target.value)}
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="aj-dir">Dirección</Label>
        <Input
          id="aj-dir"
          value={form.address}
          onChange={(e) => set("address", e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="aj-desc">Descripción</Label>
        <Textarea
          id="aj-desc"
          rows={2}
          className="resize-none"
          placeholder="Se muestra en tu página pública"
          value={form.description}
          onChange={(e) => set("description", e.target.value)}
        />
      </div>
      <Button onClick={guardar} disabled={pending || !form.name.trim()}>
        {pending ? "Guardando..." : "Guardar cambios"}
      </Button>
    </div>
  );
}

// ---------- Apariencia ----------

// Temas listos para usar. `primary` = color de botones y acentos;
// `secondary` = fondo de la cabecera de la página pública.
const TEMAS: {
  nombre: string;
  primary: string;
  secondary: string;
}[] = [
  { nombre: "Azul", primary: "#2563EB", secondary: "#0F172A" },
  { nombre: "Verde", primary: "#059669", secondary: "#052E2B" },
  { nombre: "Coral", primary: "#F97316", secondary: "#431407" },
  { nombre: "Púrpura", primary: "#7C3AED", secondary: "#2E1065" },
  { nombre: "Rosa", primary: "#EC4899", secondary: "#4A044E" },
  { nombre: "Grafito", primary: "#334155", secondary: "#0B1120" },
];

const MAX_IMG_BYTES = 3 * 1024 * 1024; // 3 MB, igual que el bucket

export interface AparienciaInicial {
  primary_color: string;
  secondary_color: string;
  logo_url: string | null;
  hero_image_url: string | null;
}

export function FormApariencia({
  businessId,
  slug,
  inicial,
}: {
  businessId: string;
  slug: string;
  inicial: AparienciaInicial;
}) {
  const [primary, setPrimary] = useState(inicial.primary_color);
  const [secondary, setSecondary] = useState(inicial.secondary_color);
  const [logoUrl, setLogoUrl] = useState(inicial.logo_url);
  const [heroUrl, setHeroUrl] = useState(inicial.hero_image_url);
  const [pending, startTransition] = useTransition();
  const [subiendo, setSubiendo] = useState<"logo" | "hero" | null>(null);

  const logoInput = useRef<HTMLInputElement>(null);
  const heroInput = useRef<HTMLInputElement>(null);

  // Guarda en la BD el estado que se le pase (evita depender del render).
  const persistir = (next: AparienciaInicial) =>
    new Promise<boolean>((resolve) =>
      startTransition(async () => {
        const r = await guardarApariencia(businessId, slug, next);
        if (r.error) {
          toast.error(r.error);
          resolve(false);
        } else {
          resolve(true);
        }
      })
    );

  const aplicarTema = (t: (typeof TEMAS)[number]) => {
    setPrimary(t.primary);
    setSecondary(t.secondary);
  };

  const guardarColores = async () => {
    const ok = await persistir({
      primary_color: primary,
      secondary_color: secondary,
      logo_url: logoUrl,
      hero_image_url: heroUrl,
    });
    if (ok) toast.success("Apariencia guardada");
  };

  const subir = async (kind: "logo" | "hero", file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("El archivo debe ser una imagen.");
      return;
    }
    if (file.size > MAX_IMG_BYTES) {
      toast.error("La imagen es muy grande (máx. 3 MB).");
      return;
    }
    setSubiendo(kind);
    try {
      const supabase = createClient();
      const ext = (file.name.split(".").pop() || "png").toLowerCase();
      const path = `${businessId}/${kind}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("business-assets")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (upErr) {
        toast.error("No se pudo subir la imagen.");
        return;
      }
      const { data } = supabase.storage
        .from("business-assets")
        .getPublicUrl(path);
      const url = data.publicUrl;
      const next: AparienciaInicial = {
        primary_color: primary,
        secondary_color: secondary,
        logo_url: kind === "logo" ? url : logoUrl,
        hero_image_url: kind === "hero" ? url : heroUrl,
      };
      const ok = await persistir(next);
      if (ok) {
        if (kind === "logo") setLogoUrl(url);
        else setHeroUrl(url);
        toast.success(kind === "logo" ? "Logo actualizado" : "Portada actualizada");
      }
    } finally {
      setSubiendo(null);
    }
  };

  const quitar = async (kind: "logo" | "hero") => {
    const next: AparienciaInicial = {
      primary_color: primary,
      secondary_color: secondary,
      logo_url: kind === "logo" ? null : logoUrl,
      hero_image_url: kind === "hero" ? null : heroUrl,
    };
    const ok = await persistir(next);
    if (ok) {
      if (kind === "logo") setLogoUrl(null);
      else setHeroUrl(null);
      toast.success("Imagen quitada");
    }
  };

  const temaActivo = (t: (typeof TEMAS)[number]) =>
    t.primary.toLowerCase() === primary.toLowerCase() &&
    t.secondary.toLowerCase() === secondary.toLowerCase();

  return (
    <div className="space-y-6">
      {/* Temas */}
      <div className="space-y-2">
        <Label>Tema de color</Label>
        <p className="text-xs text-slate-500">
          Elige un estilo. Puedes afinarlo abajo.
        </p>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {TEMAS.map((t) => (
            <button
              key={t.nombre}
              type="button"
              onClick={() => aplicarTema(t)}
              className={`flex flex-col items-center gap-1.5 rounded-xl border-2 p-2 transition-colors ${
                temaActivo(t)
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
          ))}
        </div>
      </div>

      {/* Logo */}
      <div className="space-y-2">
        <Label>Logo</Label>
        <div className="flex items-center gap-3">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoUrl}
              alt="Logo"
              className="h-16 w-16 rounded-2xl object-cover ring-1 ring-slate-200"
            />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-slate-300">
              <ImageIcon size={22} />
            </div>
          )}
          <div className="flex flex-col gap-1.5">
            <input
              ref={logoInput}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) subir("logo", f);
                e.target.value = "";
              }}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={subiendo === "logo" || pending}
              onClick={() => logoInput.current?.click()}
            >
              <Upload size={14} />
              {subiendo === "logo"
                ? "Subiendo..."
                : logoUrl
                  ? "Cambiar logo"
                  : "Subir logo"}
            </Button>
            {logoUrl && (
              <button
                type="button"
                onClick={() => quitar("logo")}
                disabled={pending}
                className="text-left text-xs text-slate-400 hover:text-red-600"
              >
                Quitar
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Foto de portada */}
      <div className="space-y-2">
        <Label>Foto de portada</Label>
        <p className="text-xs text-slate-500">
          Se ve de fondo en la cabecera de tu página de reservas.
        </p>
        {heroUrl ? (
          <div className="relative overflow-hidden rounded-xl ring-1 ring-slate-200">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={heroUrl}
              alt="Portada"
              className="h-28 w-full object-cover"
            />
          </div>
        ) : (
          <div className="flex h-28 w-full items-center justify-center rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 text-slate-300">
            <ImageIcon size={26} />
          </div>
        )}
        <div className="flex items-center gap-3">
          <input
            ref={heroInput}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) subir("hero", f);
              e.target.value = "";
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={subiendo === "hero" || pending}
            onClick={() => heroInput.current?.click()}
          >
            <Upload size={14} />
            {subiendo === "hero"
              ? "Subiendo..."
              : heroUrl
                ? "Cambiar portada"
                : "Subir portada"}
          </Button>
          {heroUrl && (
            <button
              type="button"
              onClick={() => quitar("hero")}
              disabled={pending}
              className="text-xs text-slate-400 hover:text-red-600"
            >
              Quitar
            </button>
          )}
        </div>
      </div>

      {/* Ajuste fino de colores */}
      <div className="space-y-3 rounded-xl bg-slate-50 p-4">
        <p className="text-xs font-medium text-slate-500">
          ¿Quieres afinar los colores?
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="ap-primary" className="text-xs">
              Color principal
            </Label>
            <div className="flex items-center gap-2 rounded-md border border-input bg-white px-3 py-2">
              <input
                id="ap-primary"
                type="color"
                className="h-7 w-7 cursor-pointer rounded border-0 bg-transparent"
                value={primary}
                onChange={(e) => setPrimary(e.target.value)}
              />
              <span className="text-xs text-slate-600">{primary}</span>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ap-secondary" className="text-xs">
              Color de cabecera
            </Label>
            <div className="flex items-center gap-2 rounded-md border border-input bg-white px-3 py-2">
              <input
                id="ap-secondary"
                type="color"
                className="h-7 w-7 cursor-pointer rounded border-0 bg-transparent"
                value={secondary}
                onChange={(e) => setSecondary(e.target.value)}
              />
              <span className="text-xs text-slate-600">{secondary}</span>
            </div>
          </div>
        </div>
      </div>

      <Button onClick={guardarColores} disabled={pending}>
        {pending ? "Guardando..." : "Guardar apariencia"}
      </Button>
    </div>
  );
}

// ---------- Servicios ----------

export interface ServicioRow {
  id: string;
  name: string;
  description: string | null;
  price: number | null;
  duration_minutes: number | null;
  materials_notes: string | null;
  is_active: boolean;
}

const SERVICIO_VACIO: ServicioInput = {
  name: "",
  description: "",
  price: "",
  duration_minutes: 60,
  materials_notes: "",
};

function FormServicio({
  inicial,
  pending,
  onSave,
}: {
  inicial: ServicioInput;
  pending: boolean;
  onSave: (form: ServicioInput) => void;
}) {
  const [form, setForm] = useState(inicial);
  const set = (field: keyof ServicioInput, value: string | number) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="sv-nombre">Nombre *</Label>
        <Input
          id="sv-nombre"
          placeholder="Ej: Corte y peinado"
          value={form.name}
          onChange={(e) => set("name", e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="sv-desc">Descripción</Label>
        <Textarea
          id="sv-desc"
          rows={2}
          className="resize-none"
          value={form.description}
          onChange={(e) => set("description", e.target.value)}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="sv-precio">Precio €</Label>
          <Input
            id="sv-precio"
            type="number"
            value={form.price}
            onChange={(e) => set("price", e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="sv-dur">Duración (min)</Label>
          <Input
            id="sv-dur"
            type="number"
            value={form.duration_minutes}
            onChange={(e) =>
              set("duration_minutes", parseInt(e.target.value) || 0)
            }
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="sv-mat">Materiales a preparar</Label>
        <Textarea
          id="sv-mat"
          rows={2}
          className="resize-none"
          placeholder="Ej: tinte rubio ceniza, papel de aluminio... Se muestra en el panel del día."
          value={form.materials_notes}
          onChange={(e) => set("materials_notes", e.target.value)}
        />
      </div>
      <Button
        className="w-full"
        disabled={pending || !form.name.trim()}
        onClick={() => onSave(form)}
      >
        {pending ? "Guardando..." : "Guardar"}
      </Button>
    </div>
  );
}

export function NuevoServicioDialog({ businessId }: { businessId: string }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const guardar = (form: ServicioInput) =>
    startTransition(async () => {
      const r = await crearServicio(businessId, form);
      if (r.error) toast.error(r.error);
      else {
        toast.success("Servicio creado");
        setOpen(false);
      }
    });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Plus size={15} />
          Añadir servicio
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nuevo servicio</DialogTitle>
        </DialogHeader>
        <FormServicio
          inicial={SERVICIO_VACIO}
          pending={pending}
          onSave={guardar}
        />
      </DialogContent>
    </Dialog>
  );
}

export function FilaServicio({ servicio }: { servicio: ServicioRow }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const guardar = (form: ServicioInput) =>
    startTransition(async () => {
      const r = await editarServicio(servicio.id, form);
      if (r.error) toast.error(r.error);
      else {
        toast.success("Servicio actualizado");
        setOpen(false);
      }
    });

  const toggle = (activo: boolean) =>
    startTransition(async () => {
      const r = await toggleServicio(servicio.id, activo);
      if (r.error) toast.error(r.error);
    });

  return (
    <div className="flex items-center gap-3 p-4">
      <div className="min-w-0 flex-1">
        <p
          className={`truncate text-sm font-medium ${servicio.is_active ? "text-slate-900" : "text-slate-400 line-through"}`}
        >
          {servicio.name}
        </p>
        <p className="truncate text-xs text-slate-500">
          {[
            servicio.price != null ? `${servicio.price}€` : null,
            servicio.duration_minutes
              ? `${servicio.duration_minutes} min`
              : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <button
            title="Editar"
            className="shrink-0 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
          >
            <Pencil size={15} />
          </button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar servicio</DialogTitle>
          </DialogHeader>
          <FormServicio
            inicial={{
              name: servicio.name,
              description: servicio.description ?? "",
              price: servicio.price != null ? String(servicio.price) : "",
              duration_minutes: servicio.duration_minutes ?? 60,
              materials_notes: servicio.materials_notes ?? "",
            }}
            pending={pending}
            onSave={guardar}
          />
        </DialogContent>
      </Dialog>
      <Switch
        checked={servicio.is_active}
        onCheckedChange={toggle}
        disabled={pending}
      />
    </div>
  );
}

// ---------- Sesión ----------

export function BotonSalir() {
  return (
    <form action={logout}>
      <Button variant="outline" type="submit">
        Cerrar sesión
      </Button>
    </form>
  );
}
