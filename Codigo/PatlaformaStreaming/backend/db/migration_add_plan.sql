-- Migración necesaria para soportar el Factory Method de planes de suscripción.
-- Ejecutar una sola vez sobre la base de datos "login_solid" (o la que uses).

ALTER TABLE usuarios
  ADD COLUMN IF NOT EXISTS plan_tipo VARCHAR(20) DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS precio_mensual INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS calidad_maxima VARCHAR(30) DEFAULT 'SD (480p)',
  ADD COLUMN IF NOT EXISTS pantallas_simultaneas INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS descargas_offline BOOLEAN DEFAULT FALSE;
