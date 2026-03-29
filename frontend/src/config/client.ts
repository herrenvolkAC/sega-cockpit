/**
 * Client-specific configuration.
 * All values are read from NEXT_PUBLIC_* environment variables so they
 * are embedded at build time and available in Client Components.
 *
 * Each client deployment sets its own .env.local with the values below.
 */

export type ModuleKey =
  | "fulfillment"
  | "productivity"
  | "recepciones"
  | "expediciones"
  | "stock-almacenaje"
  | "stock"
  | "slotting"
  | "ocupacion"
  | "satisfaccion-oc";

const ALL_MODULES: ModuleKey[] = [
  "fulfillment",
  "productivity",
  "recepciones",
  "expediciones",
  "stock-almacenaje",
  "stock",
  "slotting",
  "ocupacion",
  "satisfaccion-oc",
];

function parseEnabledModules(value: string | undefined): Set<ModuleKey> {
  if (!value) return new Set(ALL_MODULES);
  const parsed = value
    .split(",")
    .map((s) => s.trim())
    .filter((s): s is ModuleKey => ALL_MODULES.includes(s as ModuleKey));
  return parsed.length > 0 ? new Set(parsed) : new Set(ALL_MODULES);
}

export const clientConfig = {
  /** Client's display name shown in the sidebar and browser title */
  name: process.env.NEXT_PUBLIC_CLIENT_NAME ?? "SEGA Cockpit",
  /** Subset of modules this client has licensed / configured */
  enabledModules: parseEnabledModules(process.env.NEXT_PUBLIC_ENABLED_MODULES),
};
