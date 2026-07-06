import { getBusinessOrRedirect } from "@/lib/business";
import { AppNav } from "@/components/app-nav";

// Shell del área privada: valida sesión+negocio una vez y pinta la navegación.
export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const business = await getBusinessOrRedirect();

  return (
    <div className="min-h-screen bg-slate-50">
      <AppNav businessName={business.name} />
      <main className="pb-20 md:pb-6 md:pl-56">{children}</main>
    </div>
  );
}
