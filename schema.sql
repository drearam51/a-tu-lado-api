-- =====================================================================
-- A tu lado · Esquema de base de datos
-- Deriva del modelo de datos de la arquitectura: 8 entidades.
-- Ejecuta esto PRIMERO, luego rls-policies.sql.
-- Pégalo en el SQL Editor de Supabase y corre.
-- =====================================================================

-- TimescaleDB para las lecturas biométricas de alta frecuencia.
-- (En Supabase: Database → Extensions, o esta línea lo activa.)
create extension if not exists timescaledb;

-- ---------------------------------------------------------------------
-- 1. usuarios  (el perfil; la identidad vive en auth.users de Supabase)
-- ---------------------------------------------------------------------
create table if not exists usuarios (
  id              uuid primary key references auth.users(id) on delete cascade,
  nombre          text not null,
  email           text unique not null,
  areas_de_vida   jsonb default '[]'::jsonb,   -- ["cuidado personal","trabajo",...]
  expo_push_token text,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- ---------------------------------------------------------------------
-- 2. manillas  (wearable vinculado al usuario)
-- ---------------------------------------------------------------------
create table if not exists manillas (
  id                   uuid primary key default gen_random_uuid(),
  usuario_id           uuid not null references usuarios(id) on delete cascade,
  ble_device_id        text not null,
  modelo               text,
  vinculada            boolean default true,
  ultima_sincronizacion timestamptz,
  created_at           timestamptz default now(),
  updated_at           timestamptz default now()
);

-- ---------------------------------------------------------------------
-- 3. lecturas_biometricas  (hypertable TimescaleDB, append-only)
--    PK compuesta (usuario_id, timestamp); sin updated_at.
-- ---------------------------------------------------------------------
create table if not exists lecturas_biometricas (
  id             uuid default gen_random_uuid(),
  manilla_id     uuid not null references manillas(id) on delete cascade,
  usuario_id     uuid not null references usuarios(id) on delete cascade,
  timestamp      timestamptz not null,
  ritmo_cardiaco int,
  hrv            numeric,
  actividad      numeric,
  primary key (usuario_id, timestamp)
);

-- Convertir en hypertable (partición temporal eficiente).
select create_hypertable(
  'lecturas_biometricas', 'timestamp',
  if_not_exists => true, migrate_data => true
);

-- ---------------------------------------------------------------------
-- 4. eventos_estres  (instante en que se cruza el umbral)
-- ---------------------------------------------------------------------
do $$ begin
  create type nivel_estres as enum ('calm','caution','stress');
exception when duplicate_object then null; end $$;

create table if not exists eventos_estres (
  id           uuid primary key default gen_random_uuid(),
  usuario_id   uuid not null references usuarios(id) on delete cascade,
  manilla_id   uuid references manillas(id) on delete set null,
  detectado_en timestamptz not null,
  nivel        nivel_estres not null,
  score        numeric,                 -- null si fue pedido manual
  silenciado   boolean default false,   -- true si cayó en ventana silenciada
  created_at   timestamptz default now()
);

-- ---------------------------------------------------------------------
-- 5. intervenciones  (acción aplicada: Modo Abrazo, etc.)
-- ---------------------------------------------------------------------
do $$ begin
  create type tipo_intervencion as enum ('modo_abrazo','mensaje','microejercicio');
exception when duplicate_object then null; end $$;

do $$ begin
  create type estado_intervencion as enum ('disparada','aceptada','pospuesta','descartada');
exception when duplicate_object then null; end $$;

create table if not exists intervenciones (
  id                uuid primary key default gen_random_uuid(),
  evento_estres_id  uuid not null references eventos_estres(id) on delete cascade,
  usuario_id        uuid not null references usuarios(id) on delete cascade,
  tipo              tipo_intervencion not null,
  mensaje_empatico  text,
  estado            estado_intervencion default 'disparada',
  created_at        timestamptz default now(),
  updated_at        timestamptz default now()
);

-- ---------------------------------------------------------------------
-- 6. sesiones_respiracion  (ejercicio guiado dentro del Modo Abrazo)
-- ---------------------------------------------------------------------
create table if not exists sesiones_respiracion (
  id                uuid primary key default gen_random_uuid(),
  intervencion_id   uuid not null references intervenciones(id) on delete cascade,
  usuario_id        uuid not null references usuarios(id) on delete cascade,
  duracion_segundos int,
  completada        boolean default false,
  iniciada_en       timestamptz default now(),
  finalizada_en     timestamptz
);

-- ---------------------------------------------------------------------
-- 7. registros_bienestar  (agregado diario derivado)
-- ---------------------------------------------------------------------
create table if not exists registros_bienestar (
  id                    uuid primary key default gen_random_uuid(),
  usuario_id            uuid not null references usuarios(id) on delete cascade,
  fecha                 date not null,
  nivel_estres_promedio numeric,
  num_eventos           int default 0,
  num_pausas            int default 0,
  habitos               jsonb default '{}'::jsonb,
  unique (usuario_id, fecha)
);

-- ---------------------------------------------------------------------
-- 8. configuraciones_horario  (ventanas activas / silenciadas)
-- ---------------------------------------------------------------------
create table if not exists configuraciones_horario (
  id                   uuid primary key default gen_random_uuid(),
  usuario_id           uuid not null references usuarios(id) on delete cascade,
  etiqueta             text,              -- "noche", "fin de semana"
  hora_inicio          time not null,
  hora_fin             time not null,
  dias_semana          int[],             -- 0=domingo … 6=sábado
  silenciado           boolean default true,
  umbral_personalizado numeric,
  created_at           timestamptz default now(),
  updated_at           timestamptz default now()
);

-- ---------------------------------------------------------------------
-- Índices clave (de la arquitectura)
-- ---------------------------------------------------------------------
create index if not exists idx_lecturas_usuario_ts
  on lecturas_biometricas (usuario_id, timestamp desc);
create index if not exists idx_eventos_usuario_ts
  on eventos_estres (usuario_id, detectado_en desc);
create index if not exists idx_intervenciones_usuario_ts
  on intervenciones (usuario_id, created_at desc);

-- =====================================================================
-- Listo. Ahora ejecuta rls-policies.sql para activar la seguridad.
-- =====================================================================
