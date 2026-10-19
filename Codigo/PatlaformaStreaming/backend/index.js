import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import db from './db/DatabaseSingleton.js'; // Patrón Singleton
import PlanFactory from './factories/PlanFactory.js'; // Patrón Factory Method
import { ContenidoNoEncontradoError, AccesoDenegadoError } from './drm/DRMFacade.js'; // Facade (errores tipados)
import { LicenciaDenegadaError } from './drm/LicenseDecorators.js'; // Decorator (errores de negocio)
import ServiciosProxy from './proxy/ServiciosProxy.js'; // Patrón Proxy: ÚNICA puerta hacia los subservicios
import { PermisoDenegadoError, NoAutenticadoError, ErrorNegocio } from './proxy/errores.js';
import RolFlyweightFactory from './flyweight/RolFlyweightFactory.js'; // Patrón Flyweight (roles compartidos)
import TokenService from './auth/TokenService.js';
import { usuarioPublico } from './services/SuscripcionServicio.js';

const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.json());

// ------------------------------------------------------------------
// Autenticación: si llega "Authorization: Bearer <token>" válido, se carga
// al usuario desde la BD (con su ROL actual) en req.usuario. Sin token,
// req.usuario = null y el rol efectivo será "invitado" (Flyweight).
// Esto NO autoriza nada: la autorización la hacen los proxies.
// ------------------------------------------------------------------
app.use(async (req, res, next) => {
  req.usuario = null;
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) return next();

  const id = TokenService.verificar(token);
  if (id === null) return res.status(401).json({ message: 'Sesión inválida o expirada. Inicia sesión de nuevo.' });

  try {
    const r = await db.query('SELECT * FROM usuarios WHERE id = $1', [id]);
    if (r.rows.length === 0) return res.status(401).json({ message: 'La cuenta ya no existe.' });
    // Se normaliza el rol con el Flyweight: valores desconocidos -> "invitado".
    req.usuario = { id: r.rows[0].id, rol: RolFlyweightFactory.obtener(r.rows[0].rol).nombre };
    next();
  } catch (error) {
    console.error('Error al autenticar:', error);
    res.status(500).json({ message: 'Error interno del servidor.' });
  }
});

// Envuelve cada endpoint: entrega los proxies del actor y traduce los errores a HTTP.
//   401 NoAutenticado · 403 PermisoDenegado/Licencia/Acceso · 404/400 ErrorNegocio
const ruta = (fn) => async (req, res) => {
  try {
    await fn(req, res, ServiciosProxy.para(req.usuario));
  } catch (error) {
    if (error instanceof NoAutenticadoError) return res.status(401).json({ message: error.message });
    if (error instanceof PermisoDenegadoError) {
      return res.status(403).json({ message: error.message, rol: error.rol, permisoRequerido: error.permiso });
    }
    if (error instanceof ErrorNegocio) return res.status(error.status).json({ message: error.message });
    if (error instanceof ContenidoNoEncontradoError) return res.status(404).json({ message: error.message });
    if (error instanceof AccesoDenegadoError) return res.status(403).json({ message: error.message, validacion: error.validacion });
    if (error instanceof LicenciaDenegadaError) return res.status(403).json({ message: error.message, codigo: error.codigo });
    console.error('Error no controlado:', error);
    res.status(500).json({ message: 'Error interno del servidor.' });
  }
};

// Ruta: lista los planes (pública: la usa la pantalla de registro).
app.get('/api/planes', ruta((req, res, s) => {
  res.status(200).json({ planes: s.suscripcion.listarPlanes() });
}));

// Ruta de Registro
app.post('/api/register', async (req, res) => {
  const { username, email, password, confirmPassword, tipoPlan } = req.body;

  // 1. Validar que las contraseñas coincidan
  if (password !== confirmPassword) {
    return res.status(400).json({ message: 'Las contraseñas no coinciden.' });
  }

  // 2. Crear el plan de suscripción mediante el Factory Method.
  //    El endpoint no sabe (ni le importa) si es FreePlan, PremiumPlan, etc.
  //    Solo conoce la interfaz común SubscriptionPlan.
  let plan;
  try {
    plan = PlanFactory.crearPlan(tipoPlan);
  } catch (factoryError) {
    return res.status(400).json({ message: factoryError.message });
  }

  try {
    // 3. Verificar si el correo ya existe
    const userExist = await db.query('SELECT * FROM usuarios WHERE correo = $1', [email]);
    if (userExist.rows.length > 0) {
      return res.status(400).json({ message: 'El correo ya está registrado.' });
    }

    // 4. Encriptar la contraseña
    const hashedPassword = await bcrypt.hash(password, 10);

    // 5. Insertar el nuevo usuario junto con los datos del plan creado por la fábrica.
    //    Nota: requiere las columnas plan_tipo, precio_mensual, calidad_maxima,
    //    pantallas_simultaneas y descargas_offline en la tabla "usuarios".
    //    Ver backend/db/migration_add_plan.sql para el script de migración.
    //    El rol SIEMPRE es 'usuario': el cliente no puede elegirlo (un admin se
    //    crea con `npm run crear:admin` o lo asciende otro admin).
    const newUser = await db.query(
      `INSERT INTO usuarios
        (nombre, correo, password, rol, plan_tipo, precio_mensual, calidad_maxima, pantallas_simultaneas, descargas_offline)
       VALUES ($1, $2, $3, 'usuario', $4, $5, $6, $7, $8)
       RETURNING id, nombre, correo, rol, plan_tipo, precio_mensual, calidad_maxima, pantallas_simultaneas, descargas_offline`,
      [
        username,
        email,
        hashedPassword,
        plan.getTipo(),
        plan.getPrecioMensual(),
        plan.getCalidadMaxima(),
        plan.getPantallasSimultaneas(),
        plan.permiteDescargasOffline(),
      ]
    );

    res.status(201).json({ message: 'Usuario registrado con éxito', user: newUser.rows[0] });
  } catch (error) {
    console.error('Error en registro:', error);
    res.status(500).json({ message: 'Error interno del servidor.' });
  }
});

// Ruta de Login
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    // 1. Buscar usuario por la columna 'correo'
    const result = await db.query('SELECT * FROM usuarios WHERE correo = $1', [email]);
    if (result.rows.length === 0) {
      return res.status(400).json({ message: 'Credenciales inválidas.' });
    }

    const user = result.rows[0];

    // 2. Validar contraseña
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(400).json({ message: 'Credenciales inválidas.' });
    }

    res.status(200).json({
      message: 'Inicio de sesión exitoso',
      token: TokenService.emitir(user.id), // identidad firmada; el rol se lee de la BD en cada petición
      user: usuarioPublico(user),
    });
  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({ message: 'Error interno del servidor.' });
  }
});

// Ruta: cambiar el plan. Proxy: tu propio plan -> usuario o admin; el de otra persona -> solo admin.
app.put('/api/usuarios/:id/plan', ruta(async (req, res, s) => {
  const user = await s.suscripcion.cambiarPlan(req.params.id, req.body.tipoPlan);
  console.log(`🔔 Usuario #${user.id} (${user.correo}) cambió su plan -> ahora es "${user.planTipo}"`);
  res.status(200).json({ message: 'Plan actualizado con éxito', user });
}));

// ------------------------------------------------------------------
// DRM: autoriza la reproducción de un contenido (Facade por debajo).
// El usuario SIEMPRE es el autenticado (el proxy ignora cualquier usuarioId del body).
// Cuerpo: { contenidoId, proveedorExterno?, dispositivoId?, pais? }
// ------------------------------------------------------------------
app.post('/api/stream/autorizar', ruta(async (req, res, s) => {
  const { contenidoId, proveedorExterno, dispositivoId, pais } = req.body;
  const { validacion, licencia, marcaDeAgua, contenido } = await s.drm.autorizar({
    contenidoId,
    proveedorExterno,
    dispositivoId,
    pais,
  });
  res.status(200).json({ message: 'Reproducción autorizada', validacion, licencia, marcaDeAgua, contenido });
}));

// Libera la pantalla en uso. Sin usuarioId = la propia; con el de otro = solo admin.
app.post('/api/stream/detener', ruta((req, res, s) => {
  const { usuarioId, sesionId } = req.body;
  const { liberada, pantallasEnUso } = s.drm.detener({ usuarioId, sesionId });
  res.status(200).json({
    message: liberada ? 'Sesión liberada' : 'La sesión no existía o ya había expirado',
    pantallasEnUso,
  });
}));

// Bitácora de auditoría de licencias: solo admin.
app.get('/api/stream/auditoria', ruta((req, res, s) => {
  res.status(200).json({ eventos: s.drm.auditoria(50) });
}));

// Streaming adaptativo (Builder + Flyweight).
app.post('/api/stream/manifest', ruta((req, res, s) => {
  const manifest = s.streaming.generarManifestBasico(req.body);
  res.status(200).json({ message: 'Manifiesto generado', manifest });
}));

// Streaming: tipo de entrega x protocolo (Bridge + Composite + Builder + Flyweight).
app.post('/api/stream/entrega', ruta((req, res, s) => {
  res.status(200).json(s.streaming.generarEntrega(req.body));
}));

// Recomendación (Prototype).
app.post('/api/recomendaciones/perfil', ruta((req, res, s) => {
  const perfil = s.recomendacion.generarPerfil(req.body);
  res.status(200).json({ message: 'Perfil de recomendación generado', perfil });
}));

// Catálogo (Composite). Filtros: ?generos=accion,thriller  |  ?perfil=familiar
app.get('/api/catalogo', ruta((req, res, s) => {
  res.status(200).json(s.catalogo.listar({ perfil: req.query.perfil, generos: req.query.generos }));
}));

app.get('/api/catalogo/:id', ruta((req, res, s) => {
  res.status(200).json(s.catalogo.detalle(req.params.id));
}));

// ------------------------------------------------------------------
// Administración (solo rol admin; el proxy rechaza al resto con 403).
// ------------------------------------------------------------------
app.get('/api/admin/usuarios', ruta(async (req, res, s) => {
  res.status(200).json({ usuarios: await s.usuarios.listar() });
}));

app.put('/api/admin/usuarios/:id/rol', ruta(async (req, res, s) => {
  const user = await s.usuarios.cambiarRol(req.params.id, req.body.rol);
  console.log(`👑 Usuario #${user.id} (${user.correo}) ahora tiene el rol "${user.rol}"`);
  res.status(200).json({ message: 'Rol actualizado', user });
}));

app.get('/api/admin/accesos', ruta((req, res, s) => {
  res.status(200).json({ eventos: s.sistema.accesos(100) });
}));

app.get('/api/admin/flyweight', ruta((req, res, s) => {
  res.status(200).json(s.sistema.estadisticasFlyweight());
}));

app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
});
