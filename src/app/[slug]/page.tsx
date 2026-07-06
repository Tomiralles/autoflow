import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MapPin, Phone } from "lucide-react";
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
  const { data } = await supabase.rpc("get_public_business", { p_slug: slug });
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
  const social = (settings.show_social !== false && biz.social_links) || null;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Cabecera con la identidad del negocio */}
      <div style={{ backgroundColor: secundario }} className="px-5 py-8 text-center">
        {settings.show_hero !== false && biz.logo_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={biz.logo_url}
            alt={biz.name}
            className="mx-auto mb-3 h-16 w-16 rounded-2xl object-cover"
          />
        )}
        <h1 className="text-2xl font-bold text-white">{biz.name}</h1>
        {biz.description && (
          <p className="mx-auto mt-1 max-w-sm text-sm text-white/70">
            {biz.description}
          </p>
        )}
        <div className="mt-3 flex items-center justify-center gap-4 text-xs text-white/70">
          {settings.show_phone !== false && biz.phone && (
            <a
              href={`tel:${biz.phone}`}
              className="flex items-center gap-1 hover:text-white"
            >
              <Phone size={12} /> {biz.phone}
            </a>
          )}
          {settings.show_address !== false && biz.address && (
            <span className="flex items-center gap-1">
              <MapPin size={12} /> {biz.address}
            </span>
          )}
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

      <p className="pb-6 text-center text-[11px] text-slate-300">
        Reservas con AutoFlow AI
      </p>
    </div>
  );
}
