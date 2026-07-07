import { Zap } from "lucide-react";

// Layout compartido de login/registro: tarjeta centrada sobre fondo suave
export default function AuthLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-coral text-coral-fg shadow-sm">
            <Zap size={24} strokeWidth={2.5} />
          </div>
          <h1 className="text-2xl font-bold text-brand-ink">AutoFlow AI</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Tu negocio en piloto automático
          </p>
        </div>
        {children}
      </div>
    </main>
  );
}
