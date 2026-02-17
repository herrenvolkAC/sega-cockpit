"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navigation = [
  { name: "FullFillment", href: "/dashboard/fulfillment" },
  { name: "Inventario", href: "/dashboard/inventory" },
  { name: "Ventas", href: "/dashboard/sales" },
  { name: "Calidad", href: "/dashboard/quality" },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Sidebar Navigation */}
      <aside className="fixed left-0 top-0 z-40 w-64 h-screen bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700">
        <div className="h-full px-3 py-4 overflow-y-auto">
          <div className="mb-8">
            <h2 className="px-3 text-lg font-semibold text-gray-900 dark:text-gray-100">
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
                    className={`flex items-center p-3 rounded-lg transition-colors ${
                      isActive
                        ? "bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300"
                        : "text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700"
                    }`}
                  >
                    <span className="flex-1">{item.name}</span>
                    {isActive && (
                      <span className="inline-flex items-center justify-center w-2 h-2 ms-3 text-blue-600 bg-blue-100 rounded-full dark:bg-blue-900 dark:text-blue-300">
                        <span className="sr-only">Active</span>
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </aside>

      {/* Main Content */}
      <div className="ml-64">
        {/* Top Bar */}
        <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
          <div className="px-6 py-4 flex items-center justify-between">
            <div className="flex-1">
              <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                Sistema de Dashboards
              </h1>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
