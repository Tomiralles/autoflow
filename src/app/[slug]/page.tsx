import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BellRing, CalendarCheck, Clock3, MapPin, Phone } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { ReservaWidget, type PublicBusiness } from "./reserva-widget";

interface PageProps {
  params: Promise<{ slug: string }>;
}

interface PublicPayload extends Omit<PublicBusiness, "show_prices"> {
  description: string | null;
  address: string | null;
  email: string | null;
  logo_url: string | null;
  hero_image_url: string | null;
  secondary_color: string;
  social_links: Record<string, string> | null;
  public_page_settings: {
    show_prices?: boolean;
    show_phone?: boolean;
    show_address?: boolean;
    show_hero?: boolean;
    show_social?: boolean;
    policies_text?: string;
  } | null;
}

async function getPublicBusiness(slug: string): Promise<PublicPayload | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_public_business", {
    p_slug: slug,
  });
  if (error) {
    // Un fallo real (Supabase caído, env var mal puesta) no debe
    // confundirse con "este negocio no existe" — que quede en logs.
    console.error(`[pagina publica] RPC get_public_business falló para "${slug}":`, error);
  }
  return data as PublicPayload | null;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const biz = await getPublicBusiness(slug);
  if (!biz) return { title: "AutoFlow AI" };
  return {
    title: `${biz.name} — Reserva tu cita`,
    description: biz.description ?? `Reserva online en ${biz.name}`,
  };
}

export default async function PublicPage({ params }: PageProps) {
  const { slug } = await params;
  const biz = await getPublicBusiness(slug);
  if (!biz) notFound();

  const settings = biz.public_page_settings ?? {};
  const secundario = biz.secondary_color || "#0F172A";
  const color = biz.primary_color || "#3B82F6";
  const social = (settings.show_social !== false && biz.social_links) || null;
  const mostrarHero = settings.show_hero !== false;
  const heroImg = mostrarHero ? biz.hero_image_url : null;
  // Sin foto de portada: dos manchas de color suaves con el color de
  // acento sobre el color de cabecera, en vez de un color plano soso.
  const fondoDecorativo = `radial-gradient(130% 110% at 105% -15%, ${color}45, transparent 55%), radial-gradient(130% 110% at -15% 115%, ${color}30, transparent 55%), ${secundario}`;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Cabecera con la identidad del negocio */}
      <header
        style={heroImg ? { backgroundColor: secundario } : { background: fondoDecorativo }}
        className="relative overflow-hidden rounded-b-[2rem] px-5 pb-12 pt-10 text-center shadow-sm"
      >
        {heroImg && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={heroImg}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
            />
            <div
              className="absolute inset-0"
              style={{
                background: `linear-gradient(to bottom, ${secundario}99, ${secundario}e6)`,
              }}
            />
          </>
        )}
        <div className="relative">
          {mostrarHero && biz.logo_url && (
            // Fondo blanco fijo: cualquier logo (con transparencia o
            // colores que no combinen con el tema) se ve limpio siempre.
            <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-2xl bg-white p-2 shadow-sm ring-4 ring-white/20">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={biz.logo_url}
                alt={biz.name}
                className="h-full w-full object-contain"
              />
            </div>
          )}
          <h1 className="text-3xl font-bold tracking-tight text-white">
            {biz.name}
          </h1>
          {biz.description && (
            <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-white/75">
              {biz.description}
            </p>
          )}
          {((settings.show_phone !== false && biz.phone) ||
            (settings.show_address !== false && biz.address)) && (
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              {settings.show_phone !== false && biz.phone && (
                <a
                  href={`tel:${biz.phone}`}
                  className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-sm transition-colors hover:bg-white/20"
                >
                  <Phone size={12} /> {biz.phone}
                </a>
              )}
              {settings.show_address !== false && biz.address && (
                <span className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-xs font-medium text-white/90 backdrop-blur-sm">
                  <MapPin size={12} /> {biz.address}
                </span>
              )}
            </div>
          )}
        </div>
      </header>

      {/* Banda de confianza — tranquiliza al cliente y luce la automatización.
          `relative` es necesario: la cabecera de arriba también es
          `relative` (por la foto de portada absoluta), así que sin esto
          la cabecera se pintaría encima y taparía este bloque pese a ir
          después en el HTML. */}
      <div className="relative mx-auto -mt-6 max-w-md px-5">
        <div className="flex items-stretch justify-between gap-2 rounded-2xl border border-slate-100 bg-white p-3 shadow-sm">
          {[
            { icon: CalendarCheck, label: "Confirmación\nal momento" },
            { icon: BellRing, label: "Te recordamos\ntu cita" },
            { icon: Clock3, label: "Reservas\nen 1 minuto" },
          ].map(({ icon: Icon, label }) => (
            <div
              key={label}
              className="flex flex-1 flex-col items-center gap-1.5 text-center"
            >
              <span
                className="flex h-9 w-9 items-center justify-center rounded-full"
                style={{ backgroundColor: `${color}15`, color }}
              >
                <Icon size={17} />
              </span>
              <span className="whitespace-pre-line text-[11px] font-medium leading-tight text-slate-600">
                {label}
              </span>
            </div>
          ))}
        </div>
      </div>

      <ReservaWidget
        business={{
          name: biz.name,
          slug: biz.slug,
          phone: biz.phone,
          primary_color: biz.primary_color,
          working_hours: biz.working_hours,
          services: biz.services,
          staff: biz.staff,
          show_prices: settings.show_prices !== false,
        }}
      />

      {(settings.policies_text || social) && (
        <div className="mx-auto max-w-md space-y-3 px-5 pb-10 text-center">
          {settings.policies_text && (
            <p className="whitespace-pre-wrap text-xs text-slate-400">
              {settings.policies_text}
            </p>
          )}
          {social && (
            <div className="flex items-center justify-center gap-3 text-xs">
              {Object.entries(social).map(([red, url]) =>
                url ? (
                  <a
                    key={red}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="capitalize text-slate-400 underline hover:text-slate-600"
                  >
                    {red}
                  </a>
                ) : null
              )}
            </div>
          )}
        </div>
      )}

      <p className="pb-8 text-center text-[11px] text-slate-300">
        Reservas con <span className="font-semibold text-slate-400">AutoFlow AI</span>
      </p>
    </div>
  );
}
