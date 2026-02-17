# Backend BFF - Monitor Online Sega (Cockpit)

Backend read-only BFF basado en Node.js, TypeScript y Fastify. Consulta solo vistas SQL y expone respuestas JSON simples.

## Variables de entorno

- `PORT` (default `3001`)
- `MSSQL_CONNECTION_STRING` (obligatoria)
- `DB_REQUEST_TIMEOUT_MS` (default `5000`)
- `CACHE_TTL_SECONDS` (default `15`, opcional)
- `SECTORS` (lista separada por comas, opcional)

Ejemplo:
```
PORT=3001
MSSQL_CONNECTION_STRING=Server=localhost;Database=sega;User Id=sa;Password=pass;TrustServerCertificate=true;
DB_REQUEST_TIMEOUT_MS=5000
CACHE_TTL_SECONDS=15
SECTORS=SECTOR_A,SECTOR_B
```

## Como correr

```
cd backend
npm install
npm run dev
```

## Endpoints

- `GET /health`
- `GET /status?sector=...`
- `GET /detail?sector=...`

## Ejemplos curl

```
curl http://localhost:3001/health
curl "http://localhost:3001/status?sector=SECTOR_A"
curl "http://localhost:3001/detail?sector=SECTOR_A"
```

## Notas

- Solo consulta las vistas `vw_monitor_status` y `vw_monitor_detail`.
- Si las vistas no existen, devuelve mocks temporales claramente marcados.
