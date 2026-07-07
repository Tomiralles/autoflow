"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarDays,
  Home,
  Settings,
  Users,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Menú fijo de 5 entradas, sin submenús y sin jerga CRM (decisión de diseño).
const NAV = [
  { href: "/hoy", label: "Hoy", icon: Home },
  { href: "/citas", label: "Citas", icon: CalendarDays },
  { href: "/clientes", label: "Clientes", icon: Users },
  { href: "/automatico", label: "Automático", icon: Zap },
  { href: "/ajustes", label: "Ajustes", icon: Settings },
];

export function AppNav({ businessName }: { businessName: string }) {
  const pathname = usePathname();

  return (
    <>
      {/* Sidebar de escritorio */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col bg-brand-ink md:flex">
        <div className="flex items-center gap-3 px-5 py-5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-coral text-coral-fg shadow-sm">
            <Zap size={18} strokeWidth={2.5} />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-white">
              {businessName}
            </p>
            <p className="text-[11px] font-medium tracking-wide text-slate-400">
              AutoFlow AI
            </p>
          </div>
        </div>
        <nav className="flex-1 space-y-1 px-3 py-2">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-coral text-coral-fg shadow-sm"
                    : "text-slate-300 hover:bg-white/10 hover:text-white"
                )}
              >
                <Icon size={18} strokeWidth={2.25} />
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="px-5 py-4 text-[11px] text-slate-500">
          Tú a lo tuyo. Nosotros al resto.
        </div>
      </aside>

      {/* Barra inferior en móvil — el dueño usa el móvil en el mostrador */}
      <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] md:hidden">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium transition-colors",
                active ? "text-coral" : "text-slate-400"
              )}
            >
              <Icon size={20} strokeWidth={active ? 2.5 : 2} />
              {label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
