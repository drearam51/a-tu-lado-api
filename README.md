# A tu lado · API

Backend NestJS que orquesta el **agente de acompañamiento** y registra los eventos de ayuda, encajando con la arquitectura del proyecto (Supabase + RLS, tablas `eventos_estres` e `intervenciones`).

## Qué hace

Cuando la persona pulsa "pedir ayuda" (o la manilla lo detecta), esta API:

1. **Registra** el evento de estrés y crea la intervención (Modo Abrazo) en Supabase, respetando Row-Level Security.
2. **Conversa**: llama a Claude con el carácter de "A tu lado" (cálido, en segunda persona, sin tono clínico) y devuelve el mensaje.
3. **Voz** (opcional): puede devolver el audio del mensaje. Apagado por defecto; la app usa el TTS del teléfono hasta que integres un proveedor.
4. **Gancho futuro**: avisar a un contacto de confianza, dejado marcado y desactivado.

La API key de Claude y la service-key de Supabase viven **solo aquí**, nunca llegan a la app.

## Endpoints

Todos bajo `/api`, requieren `Authorization: Bearer <jwt-de-supabase>`.

| Método | Ruta | Para qué |
|--------|------|----------|
| `POST` | `/api/ayuda` | Pedir ayuda (manual o automática). Crea evento + intervención y devuelve el primer mensaje del agente. |
| `POST` | `/api/ayuda/responder` | Un turno más de conversación con el agente. |
| `PATCH` | `/api/ayuda/intervencion/:id` | Registrar el desenlace: `aceptada` / `pospuesta` / `descartada`. |

## Puesta en marcha local

```bash
npm install
cp .env.example .env      # rellena tus claves
npm run start:dev
```

Variables (`.env`):
- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` — de tu proyecto Supabase (Settings → API).
- `ANTHROPIC_API_KEY` — de console.anthropic.com.
- `VOZ_ACTIVA` — `false` por ahora.

## Probar sin la app (con curl)

Necesitas un JWT de un usuario real de tu Supabase. Lo obtienes desde el SDK de Supabase o el panel. Luego:

```bash
# 1. Pedir ayuda (botón manual)
curl -X POST http://localhost:3000/api/ayuda \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  -d '{"origen":"manual"}'

# 2. Responder un turno
curl -X POST http://localhost:3000/api/ayuda/responder \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  -d '{"mensaje":"Estoy muy saturada con el trabajo"}'
```

## Despliegue (Railway, según tu arquitectura)

1. Sube este repo a GitHub.
2. En Railway: New Project → Deploy from GitHub.
3. Carga las variables de entorno (o usa Doppler, como define la arquitectura).
4. Railway corre `npm run build` y `npm run start:prod`.

## Montar la base de datos (Supabase)

En el SQL Editor de tu proyecto Supabase, ejecuta **en este orden**:

1. **`schema.sql`** — crea las 8 tablas del modelo de datos (con la hypertable de TimescaleDB para las lecturas biométricas).
2. **`rls-policies.sql`** — activa la seguridad por usuario en todas las tablas.

Sin el paso 1 las tablas no existen; sin el paso 2 no hay aislamiento de datos.

## Antes de producción

Tu arquitectura ya lo marca, lo repito por ser datos de salud:
- Las tablas ya traen **RLS** activado vía `rls-policies.sql`.
- Define **consentimiento informado** y el marco de cumplimiento (habeas data) antes de manejar biometría real.
- El carácter del agente incluye una salvaguarda de crisis, pero **no reemplaza** un protocolo clínico; defínelo con un profesional antes de lanzar.

## Estructura

```
src/
├── main.ts                  arranque, CORS, validación
├── app.module.ts            módulo raíz
├── auth/
│   └── supabase-auth.guard  verifica el JWT de Supabase
├── supabase/
│   └── supabase.service     dos clientes: usuario (RLS) y service-role
├── agente/
│   └── agente.service       carácter de "A tu lado" + llamada a Claude + voz
└── ayuda/
    ├── ayuda.controller      las rutas REST
    ├── ayuda.service         orquesta evento + BD + agente
    └── ayuda.dto             validación de entrada
```
