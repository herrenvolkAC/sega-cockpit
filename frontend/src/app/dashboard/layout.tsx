"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navigation = [
  {
    name: "FullFillment",
    shortName: "FF",
    description: "Operaciones y preparación",
    href: "/dashboard/fulfillment",
  },
  {
    name: "Productividad",
    shortName: "PR",
    description: "Rendimiento del equipo",
    href: "/dashboard/productivity",
  },
  {
    name: "Recepciones",
    shortName: "RE",
    description: "Ingreso y control",
    href: "/dashboard/recepciones",
  },
  {
    name: "Expediciones / Cargas",
    shortName: "EX",
    description: "Despacho y carga",
    href: "/dashboard/expediciones",
  },
  {
    name: "Stock & Almacenaje",
    shortName: "ST",
    description: "Stock disponible",
    href: "/dashboard/stock-almacenaje",
  },
  {
    name: "Inventario",
    shortName: "IN",
    description: "Conteos y ajustes",
    href: "/dashboard/stock",
  },
  {
    name: "Ventas",
    shortName: "VE",
    description: "Comercial",
    href: "/dashboard/sales",
  },
  {
    name: "Calidad",
    shortName: "CA",
    description: "Incidencias y calidad",
    href: "/dashboard/quality",
  },
];

const getPageTitle = (pathname: string) => {
  const currentItem = navigation.find((item) => pathname === item.href);
  return currentItem?.name ?? "Sistema de Dashboards";
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const pageTitle = getPageTitle(pathname);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <aside className="fixed inset-y-0 left-0 z-40 hidden border-r border-gray-200 bg-white/95 backdrop-blur xl:w-72 lg:block lg:w-20 dark:border-gray-700 dark:bg-gray-800/95">
        <div className="flex h-full flex-col overflow-y-auto px-3 py-4">
          <div className="mb-6 px-2">
            <div className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-gray-50 px-3 py-3 dark:border-gray-700 dark:bg-gray-900/60">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-sm font-bold text-white">
                SC
              </div>
              <div className="hidden min-w-0 xl:block">
                <p className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">
                  Sega Cockpit
                </p>
                <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                  Navegacion compacta
                </p>
              </div>
            </div>
          </div>

          <div className="mb-3 px-2 hidden xl:block">
            <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">
              Dashboards
            </h2>
          </div>

          <ul className="space-y-2 font-medium">
            {navigation.map((item) => {
              const isActive = pathname === item.href;
              return (
                <li key={item.name}>
                  <Link
                    href={item.href}
                    title={item.name}
                    className={`group flex items-center rounded-2xl border p-3 transition-all ${
                      isActive
                        ? "border-blue-200 bg-blue-50 text-blue-700 shadow-sm dark:border-blue-800 dark:bg-blue-900/40 dark:text-blue-300"
                        : "border-transparent text-gray-700 hover:border-gray-200 hover:bg-gray-100 dark:text-gray-200 dark:hover:border-gray-700 dark:hover:bg-gray-700/70"
                    }`}
                  >
                    <span
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xs font-bold ${
                        isActive
                          ? "bg-blue-600 text-white"
                          : "bg-gray-200 text-gray-700 group-hover:bg-white dark:bg-gray-700 dark:text-gray-200 dark:group-hover:bg-gray-600"
                      }`}
                    >
                      {item.shortName}
                    </span>

                    <span className="ml-3 hidden min-w-0 flex-1 xl:block">
                      <span className="block truncate text-sm font-semibold">
                        {item.name}
                      </span>
                      <span className="block truncate text-xs text-gray-500 dark:text-gray-400">
                        {item.description}
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>

          <div className="mt-auto hidden rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-4 text-sm text-gray-500 xl:block dark:border-gray-700 dark:bg-gray-900/60 dark:text-gray-400">
            En resoluciones medias la barra se comprime automaticamente para darle mas espacio al contenido.
          </div>
        </div>
      </aside>

      <div className="lg:ml-20 xl:ml-72">
        <header className="sticky top-0 z-30 border-b border-gray-200 bg-white/95 backdrop-blur dark:border-gray-700 dark:bg-gray-800/95">
          <div className="px-4 py-4 sm:px-6">
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">
                  Dashboard activo
                </p>
                <h1 className="truncate text-xl font-semibold text-gray-900 dark:text-gray-100">
                  {pageTitle}
                </h1>
              </div>

              <div className="hidden text-right lg:block">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Navegacion adaptativa
                </p>
                <p className="text-xs text-gray-400 dark:text-gray-500">
                  Sidebar compacto en desktop, accesos arriba en mobile
                </p>
              </div>
            </div>

            <nav className="mt-4 flex gap-2 overflow-x-auto pb-1 lg:hidden">
              {navigation.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={`whitespace-nowrap rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
                      isActive
                        ? "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-900/40 dark:text-blue-300"
                        : "border-gray-200 bg-white text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
                    }`}
                  >
                    {item.name}
                  </Link>
                );
              })}
            </nav>
          </div>
        </header>

        <main className="p-4 sm:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
