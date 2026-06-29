-- =====================================================================
-- A tu lado · Políticas Row-Level Security
-- Aísla los datos de salud por usuario EN LA BASE, no en código.
-- (Arquitectura: "RLS en la BD, no en la app".)
-- Ejecuta DESPUÉS de schema.sql.
-- =====================================================================

-- Activar RLS en todas las tablas con datos del usuario.
alter table usuarios                enable row level security;
alter table manillas                enable row level security;
alter table lecturas_biometricas    enable row level security;
alter table eventos_estres          enable row level security;
alter table intervenciones          enable row level security;
alter table sesiones_respiracion    enable row level security;
alter table registros_bienestar     enable row level security;
alter table configuraciones_horario enable row level security;

-- Patrón general: cada quien ve y escribe SOLO las filas donde
-- usuario_id = auth.uid(). (En 'usuarios', la fila es id = auth.uid().)

-- ---- usuarios ----
create policy "usuarios: ver lo propio"      on usuarios for select using (auth.uid() = id);
create policy "usuarios: editar lo propio"   on usuarios for update using (auth.uid() = id) with check (auth.uid() = id);
create policy "usuarios: crear lo propio"    on usuarios for insert with check (auth.uid() = id);

-- ---- manillas ----
create policy "manillas: leer lo propio"     on manillas for select using (auth.uid() = usuario_id);
create policy "manillas: escribir lo propio" on manillas for all    using (auth.uid() = usuario_id) with check (auth.uid() = usuario_id);

-- ---- lecturas_biometricas ----
create policy "lecturas: leer lo propio"     on lecturas_biometricas for select using (auth.uid() = usuario_id);
create policy "lecturas: insertar lo propio" on lecturas_biometricas for insert with check (auth.uid() = usuario_id);

-- ---- eventos_estres ----
create policy "eventos: leer lo propio"      on eventos_estres for select using (auth.uid() = usuario_id);
create policy "eventos: insertar lo propio"  on eventos_estres for insert with check (auth.uid() = usuario_id);

-- ---- intervenciones ----
create policy "intervenciones: leer lo propio"       on intervenciones for select using (auth.uid() = usuario_id);
create policy "intervenciones: insertar lo propio"   on intervenciones for insert with check (auth.uid() = usuario_id);
create policy "intervenciones: actualizar lo propio" on intervenciones for update using (auth.uid() = usuario_id) with check (auth.uid() = usuario_id);

-- ---- sesiones_respiracion ----
create policy "sesiones: leer lo propio"     on sesiones_respiracion for select using (auth.uid() = usuario_id);
create policy "sesiones: escribir lo propio" on sesiones_respiracion for all    using (auth.uid() = usuario_id) with check (auth.uid() = usuario_id);

-- ---- registros_bienestar ----
create policy "bienestar: leer lo propio"     on registros_bienestar for select using (auth.uid() = usuario_id);
create policy "bienestar: escribir lo propio" on registros_bienestar for all    using (auth.uid() = usuario_id) with check (auth.uid() = usuario_id);

-- ---- configuraciones_horario ----
create policy "horarios: leer lo propio"     on configuraciones_horario for select using (auth.uid() = usuario_id);
create policy "horarios: escribir lo propio" on configuraciones_horario for all    using (auth.uid() = usuario_id) with check (auth.uid() = usuario_id);

-- Nota: el cliente service-role del backend (SupabaseService.admin())
-- salta estas políticas a propósito, solo para operaciones del sistema.
-- El flujo de "pedir ayuda" usa el cliente del usuario (forUser), así que
-- estas políticas SÍ aplican y son tu red de seguridad real.
