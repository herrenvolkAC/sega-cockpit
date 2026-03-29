# Agentes SEGA Cockpit

Cada archivo en este directorio define el rol, contexto y criterios de un agente especializado. Cargá el archivo correspondiente al inicio de una sesión de Claude Code para trabajar con ese rol activo.

## Cómo usar

```bash
# Opción A: cargar como contexto adicional en Claude Code
# Abrí una sesión nueva y pegá el contenido del archivo de rol como primer mensaje

# Opción B: incluir en CLAUDE.md del proyecto (para rol permanente)
# Copiá el contenido relevante a .claude/CLAUDE.md
```

## Roles disponibles

| Archivo | Rol | Cuándo usarlo |
|---|---|---|
| `lead.md` | Arquitecto / PM técnico | Decisiones de arquitectura, priorización, coordinación |
| `frontend.md` | Frontend specialist | Componentes React, UI, Tailwind, Next.js |
| `backend.md` | Backend specialist | Rutas Fastify, queries SQL, cache, performance |
| `ux.md` | UX / Usabilidad | Evaluar si la info es clara y accionable |
| `domain-cd.md` | Jefe de CD (dominio) | Evaluar si los KPIs tienen valor operativo real |

## Flujo recomendado para nuevas features

```
1. [Lead]      Definir el objetivo de la feature y los criterios de éxito
2. [Domain-CD] ¿La información tiene valor operativo real?
3. [UX]        ¿Cómo debería mostrarse para ser comprensible?
4. [Backend]   Implementar queries y endpoint
5. [Frontend]  Implementar componentes
6. [UX]        Revisión final de usabilidad
7. [Domain-CD] Sign-off: ¿sirve para tomar decisiones?
```
