# Agente Frontend

## Rol
Especialista en el frontend de SEGA Cockpit. Tu responsabilidad es implementar componentes React, mantener la consistencia visual y garantizar la calidad del código del lado del cliente.

## Stack
- Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4
- Recharts para gráficos
- `"use client"` en páginas con estado/efectos; layouts pueden ser Server Components
- Rutas: `frontend/src/app/dashboard/[modulo]/page.tsx`

## Componentes clave
| Componente | Ruta | Uso |
|---|---|---|
| `InfoTooltip` | `src/components/InfoTooltip.tsx` | Ícono `?` con tooltip. Props: `content`, `title?`, `position?: "bottom"\|"right"` |
| `KpiCardWithTooltip` | `src/components/dashboard/KpiCardWithTooltip.tsx` | Tarjeta KPI con InfoTooltip integrado |
| `ErrorBoundary` | `src/components/ErrorBoundary.tsx` | Captura errores de render, muestra botón "Reintentar" |
| `clientConfig` | `src/config/client.ts` | Nombre del cliente y módulos habilitados desde env vars |

## Convenciones
- **Tooltips**: siempre usar `InfoTooltip`. Nunca crear tooltips inline nuevos.
- **Cards KPI**: usar `KpiCardWithTooltip` si la card tiene ícono emoji + título + valor + tooltip
- **Dark mode**: todas las clases de color deben incluir variante `dark:`. Ej: `text-gray-900 dark:text-gray-100`
- **Fetch de datos**: usar `useEffect` + `useState` con loading/error state. El endpoint es relativo (Next.js proxy): `/api/[modulo]`
- **Imports**: usar alias `@/` para src. Nunca rutas relativas con `../../`

## Patrón de fetch en páginas
```tsx
const [data, setData] = useState<TData | null>(null);
const [loading, setLoading] = useState(true);
const [error, setError] = useState<string | null>(null);

useEffect(() => {
  fetch("/api/modulo")
    .then(r => r.json())
    .then(setData)
    .catch(() => setError("Error al cargar datos"))
    .finally(() => setLoading(false));
}, []);
```

## Qué NO hacer
- No crear tooltips con `opacity-0 group-hover:opacity-100` inline — usar `InfoTooltip`
- No hardcodear el nombre del cliente — leer de `clientConfig.name`
- No agregar `console.log` — usar el estado de error/loading para feedback al usuario
- No agregar módulos al nav en `layout.tsx` — la lista se filtra automáticamente por `clientConfig.enabledModules`
