/**
 * crear-admin.js — crea (o asciende) una cuenta con rol "admin".
 *
 *   cd backend
 *   npm run crear:admin -- admin@cineverse.com MiClaveSegura "Administrador"
 *
 * Si el correo ya existe, solo le pone el rol "admin" (no cambia su clave).
 * Requiere haber ejecutado antes db/migration_add_plan.sql y db/migration_add_roles.sql.
 */
import bcrypt from 'bcryptjs';
import db from './DatabaseSingleton.js';
import PlanFactory from '../factories/PlanFactory.js';

const [correo, clave, nombre = 'Administrador'] = process.argv.slice(2);
if (!correo || !clave) {
  console.error('Uso: npm run crear:admin -- <correo> <clave> [nombre]');
  process.exit(1);
}

try {
  const existe = await db.query('SELECT id FROM usuarios WHERE correo = $1', [correo]);
  if (existe.rows.length > 0) {
    await db.query("UPDATE usuarios SET rol = 'admin' WHERE correo = $1", [correo]);
    console.log(`✅ ${correo} ahora es admin (la cuenta ya existía).`);
  } else {
    const plan = PlanFactory.crearPlan('premium');
    await db.query(
      `INSERT INTO usuarios
        (nombre, correo, password, rol, plan_tipo, precio_mensual, calidad_maxima, pantallas_simultaneas, descargas_offline)
       VALUES ($1, $2, $3, 'admin', $4, $5, $6, $7, $8)`,
      [nombre, correo, await bcrypt.hash(clave, 10), plan.getTipo(), plan.getPrecioMensual(), plan.getCalidadMaxima(), plan.getPantallasSimultaneas(), plan.permiteDescargasOffline()]
    );
    console.log(`✅ Admin creado: ${correo}`);
  }
} catch (e) {
  console.error('❌ No se pudo crear el admin:', e.message);
  process.exitCode = 1;
} finally {
  process.exit();
}
