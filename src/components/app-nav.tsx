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
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-56 flex-col border-r bg-white md:flex">
        <div className="flex items-center gap-2 border-b px-5 py-4">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-sm">
            ⚡
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-slate-900">
              {businessName}
            </p>
            <p className="text-[11px] text-slate-400">AutoFlow AI</p>
          </div>
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-blue-50 text-blue-700"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                )}
              >
                <Icon size={18} />
                {label}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Barra inferior en móvil — el dueño usa el móvil en el mostrador */}
      <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t bg-white md:hidden">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium",
                active ? "text-blue-600" : "text-slate-500"
              )}
            >
              <Icon size={20} />
              {label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
