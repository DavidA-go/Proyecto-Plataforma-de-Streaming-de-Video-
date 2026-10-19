-- Migración para los roles del patrón Proxy/Flyweight ('usuario' | 'admin').
-- Ejecutar una sola vez sobre la base de datos "login_solid" (o la que uses).

ALTER TABLE usuarios
  ADD COLUMN IF NOT EXISTS rol VARCHAR(20) DEFAULT 'usuario';

-- Cualquier valor viejo o vacío pasa a 'usuario' (los admins se crean aparte).
UPDATE usuarios SET rol = 'usuario' WHERE rol IS NULL OR rol NOT IN ('usuario', 'admin');
