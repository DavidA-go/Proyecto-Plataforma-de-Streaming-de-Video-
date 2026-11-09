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
import CadenaRegistro from './chain/CadenaRegistro.js'; // Patrón Chain of Responsibility (validación del registro)
import invoker from './commands/CommandInvoker.js'; // Patrón Command (invocador con historial por usuario)
import { CambiarPlanCommand } from './commands/UserCommands.js'; // Patrón Command (cambio de plan reversible)

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

// Chain of Responsibility (validación sin registrar): corre la MISMA cadena que /api/register
// pero no crea ningún usuario. Devuelve por qué eslabón pasó la solicitud (OK / RECHAZADA / OMITIDA).
// Es pública (igual que el registro) y nunca devuelve ni guarda la contraseña.
app.post('/api/validar-registro', async (req, res) => {
  const { username, email, password, confirmPassword, tipoPlan } = req.body;
  try {
    const { valido, regla, message, status, eslabones } = await CadenaRegistro.validar({
      username, email, password, confirmPassword, tipoPlan,
    });
    res.status(200).json({ valido, regla: regla ?? null, message: message ?? null, status: status ?? 200, eslabones });
  } catch (error) {
    console.error('Error al validar registro:', error);
    res.status(500).json({ message: 'Error interno del servidor.' });
  }
});

// Ruta de Registro
app.post('/api/register', async (req, res) => {
  const { username, email, password, confirmPassword, tipoPlan } = req.body;

  try {
    // 1-3. Chain of Responsibility: la solicitud recorre la cadena de validación
    //      (campos -> contraseñas -> plan [Factory Method] -> correo disponible).
    //      El primer eslabón que falla corta la cadena y devuelve su motivo.
    //      Si todo pasa, la cadena deja el plan creado por la fábrica en solicitud.plan.
    const { valido, message, status, solicitud } = await CadenaRegistro.validar({
      username, email, password, confirmPassword, tipoPlan,
    });
    if (!valido) {
      return res.status(status).json({ message });
    }
    const plan = solicitud.plan;

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
// Patrón Command: el cambio se ejecuta como un CambiarPlanCommand a través del invocador,
// que lo guarda en el historial del usuario afectado para poder deshacerlo.
app.put('/api/usuarios/:id/plan', ruta(async (req, res, s) => {
  const comando = new CambiarPlanCommand(s.suscripcion, req.params.id, req.body.tipoPlan);
  const user = await invoker.ejecutarComando(comando, req.params.id);
  console.log(`🔔 Usuario #${user.id} (${user.correo}) cambió su plan -> ahora es "${user.planTipo}"`);
  res.status(200).json({ message: 'Plan actualizado con éxito', user, puedeDeshacer: true });
}));

// Ruta: historial de cambios de plan (Command) de un usuario. Mismos permisos que cambiar el plan.
app.get('/api/usuarios/:id/plan/historial', ruta(async (req, res, s) => {
  await s.suscripcion.obtenerPlan(req.params.id); // el proxy autoriza (propio -> usuario/admin; ajeno -> admin)
  res.status(200).json({ historial: invoker.historialDe(req.params.id) });
}));

// Ruta: deshace el último cambio de plan (Command.undo). Mismos permisos que cambiar el plan.
app.post('/api/usuarios/:id/plan/deshacer', ruta(async (req, res, s) => {
  await s.suscripcion.obtenerPlan(req.params.id); // autoriza ANTES de tocar el historial
  const r = await invoker.deshacerUltimoComando(req.params.id);
  if (!r.deshecho) return res.status(400).json({ message: 'No hay cambios de plan para deshacer.' });
  console.log(`↩️  Usuario #${r.resultado.id}: se deshizo "${r.comando}" -> plan "${r.resultado.planTipo}"`);
  res.status(200).json({
    message: 'Cambio de plan deshecho',
    user: r.resultado,
    puedeDeshacer: invoker.historialDe(req.params.id).length > 0,
  });
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

// Streaming adaptativo (Mediator): sesión de reproducción con sus piezas coordinadas.
// El techo de calidad sale del PLAN del usuario (Factory Method); el contenido puede ser un grupo (Iterator elige el primero).
app.post('/api/stream/sesion', ruta(async (req, res, s) => {
  const plan = await s.suscripcion.obtenerPlan(req.usuario?.id); // sin sesión -> 401 (lo decide el proxy)
  const r = s.streaming.crearSesion({
    contenidoId: req.body.contenidoId,
    anchoBandaKbps: req.body.anchoBandaKbps,
    calidadMaxima: plan.calidadMaxima,
  });
  res.status(201).json({ message: 'Sesión de reproducción creada', ...r });
}));

app.get('/api/stream/sesion/:sesionId', ruta((req, res, s) => {
  res.status(200).json(s.streaming.estadoSesion({ sesionId: req.params.sesionId }));
}));

// Cuerpo: { accion: 'reproducir'|'pausar'|'buscar'|'red'|'avanzar'|'audio'|'subtitulo', valor? }
app.post('/api/stream/sesion/:sesionId/accion', ruta((req, res, s) => {
  res.status(200).json(s.streaming.accionSesion({ sesionId: req.params.sesionId, accion: req.body.accion, valor: req.body.valor }));
}));

app.delete('/api/stream/sesion/:sesionId', ruta((req, res, s) => {
  res.status(200).json(s.streaming.cerrarSesion({ sesionId: req.params.sesionId }));
}));

// Recomendación (Prototype).
app.post('/api/recomendaciones/perfil', ruta((req, res, s) => {
  const perfil = s.recomendacion.generarPerfil(req.body);
  res.status(200).json({ message: 'Perfil de recomendación generado', perfil });
}));

// Perfil propio de recomendación con historial (Memento). Siempre es el del usuario autenticado.
app.get('/api/recomendaciones/mi-perfil', ruta((req, res, s) => {
  res.status(200).json(s.recomendacion.miPerfil());
}));

// Cuerpo: { categoriaBase?, generosAdicionales?, generosFavoritos?, tipoContenidoPreferido?, pesoHistorial? }
app.put('/api/recomendaciones/mi-perfil', ruta((req, res, s) => {
  const r = s.recomendacion.guardarMiPerfil(req.body);
  res.status(r.creado ? 201 : 200).json({ message: r.creado ? 'Perfil creado' : r.sinCambios ? 'Sin cambios' : 'Perfil actualizado', ...r });
}));

app.post('/api/recomendaciones/mi-perfil/deshacer', ruta((req, res, s) => {
  res.status(200).json({ message: 'Cambio deshecho', ...s.recomendacion.deshacerMiPerfil() });
}));

app.post('/api/recomendaciones/mi-perfil/rehacer', ruta((req, res, s) => {
  res.status(200).json({ message: 'Cambio rehecho', ...s.recomendacion.rehacerMiPerfil() });
}));

// Cuerpo: { version } (número de la lista "historial" de GET /mi-perfil)
app.post('/api/recomendaciones/mi-perfil/restaurar', ruta((req, res, s) => {
  res.status(200).json({ message: 'Versión restaurada', ...s.recomendacion.restaurarMiPerfil({ version: req.body.version }) });
}));

// Catálogo (Composite). Filtros: ?generos=accion,thriller  |  ?perfil=familiar
app.get('/api/catalogo', ruta((req, res, s) => {
  res.status(200).json(s.catalogo.listar({ perfil: req.query.perfil, generos: req.query.generos }));
}));

app.get('/api/catalogo/:id', ruta((req, res, s) => {
  res.status(200).json(s.catalogo.detalle(req.params.id));
}));

// Catálogo (Iterator). Recorre el árbol desde el nodo :id (use "catalogo" para todo), de forma paginada.
//   ?orden=profundidad|anchura|reproducibles  &genero=thriller  &tipo=episodio  &desde=0  &limite=20
app.get('/api/catalogo/:id/recorrer', ruta((req, res, s) => {
  const { orden, genero, tipo, desde, limite } = req.query;
  res.status(200).json(s.catalogo.recorrer({ id: req.params.id, orden, genero, tipo, desde, limite }));
}));

// Catálogo (Iterator). Siguiente reproducible después de :id en el orden del catálogo (autoplay).
app.get('/api/catalogo/:id/siguiente', ruta((req, res, s) => {
  res.status(200).json(s.catalogo.siguiente(req.params.id));
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
