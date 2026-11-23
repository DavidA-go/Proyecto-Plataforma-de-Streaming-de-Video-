-- Migración para permitir la desactivación lógica de cuentas desde el panel admin.
-- Ejecutar una sola vez sobre la misma base de datos usada por CineVerse.
-- Las cuentas existentes quedan activas para no bloquear el acceso actual.

ALTER TABLE usuarios
  ADD COLUMN IF NOT EXISTS activo BOOLEAN NOT NULL DEFAULT TRUE;
