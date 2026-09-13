import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import db from './db/DatabaseSingleton.js'; // Patrón Singleton (sin cambios)
import PlanFactory from './factories/PlanFactory.js'; // Patrón Factory Method (nuevo)
import DRMFactoryProvider from './drm/DRMFactoryProvider.js'; // Patrón Abstract Factory
import StreamManifestBuilder from './streaming/StreamManifestBuilder.js'; // Patrón Builder
import PerfilRecomendacionRegistry from './recommendation/PerfilRecomendacionRegistry.js'; // Patrón Prototype

const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.json());

// Ruta: lista los planes disponibles usando el Factory Method
// El cliente (frontend) puede pedir esta lista para mostrar precios/beneficios
// sin que el backend exponga las clases concretas de cada plan.
app.get('/api/planes', (req, res) => {
  try {
    res.status(200).json({ planes: PlanFactory.tiposDisponibles() });
  } catch (error) {
    console.error('Error al listar planes:', error);
    res.status(500).json({ message: 'Error interno del servidor.' });
  }
});

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
    const newUser = await db.query(
      `INSERT INTO usuarios
        (nombre, correo, password, plan_tipo, precio_mensual, calidad_maxima, pantallas_simultaneas, descargas_offline)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
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
      user: { 
        id: user.id, 
        nombre: user.nombre, 
        correo: user.correo, 
        rol: user.rol,
        planTipo: user.plan_tipo,
        precioMensual: user.precio_mensual,
        calidadMaxima: user.calidad_maxima,
        pantallasSimultaneas: user.pantallas_simultaneas,
        descargasOffline: user.descargas_offline,
      }
    });
  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({ message: 'Error interno del servidor.' });
  }
});

// Ruta: cambiar el plan de un usuario ya registrado (desde su Perfil).
// Igual que en /api/register, la creación del plan pasa por PlanFactory:
// este endpoint nunca hace "new BasicoPlan()" ni similares directamente.
app.put('/api/usuarios/:id/plan', async (req, res) => {
  const { id } = req.params;
  const { tipoPlan } = req.body;

  let plan;
  try {
    plan = PlanFactory.crearPlan(tipoPlan);
  } catch (factoryError) {
    return res.status(400).json({ message: factoryError.message });
  }

  try {
    const updated = await db.query(
      `UPDATE usuarios
         SET plan_tipo = $1,
             precio_mensual = $2,
             calidad_maxima = $3,
             pantallas_simultaneas = $4,
             descargas_offline = $5
       WHERE id = $6
       RETURNING id, nombre, correo, rol, plan_tipo, precio_mensual, calidad_maxima, pantallas_simultaneas, descargas_offline`,
      [
        plan.getTipo(),
        plan.getPrecioMensual(),
        plan.getCalidadMaxima(),
        plan.getPantallasSimultaneas(),
        plan.permiteDescargasOffline(),
        id,
      ]
    );

    if (updated.rows.length === 0) {
      return res.status(404).json({ message: 'Usuario no encontrado.' });
    }

    const row = updated.rows[0];
    console.log(`🔔 Usuario #${row.id} (${row.correo}) cambió su plan -> ahora es "${row.plan_tipo}"`);
    res.status(200).json({
      message: 'Plan actualizado con éxito',
      user: {
        id: row.id,
        nombre: row.nombre,
        correo: row.correo,
        rol: row.rol,
        planTipo: row.plan_tipo,
        precioMensual: row.precio_mensual,
        calidadMaxima: row.calidad_maxima,
        pantallasSimultaneas: row.pantallas_simultaneas,
        descargasOffline: row.descargas_offline,
      },
    });
  } catch (error) {
    console.error('Error al actualizar plan:', error);
    res.status(500).json({ message: 'Error interno del servidor.' });
  }
});

// ------------------------------------------------------------------
// Ruta: DRM — autoriza la reproducción de un contenido.
// Patrón Abstract Factory: según el plan del usuario, se obtiene UNA
// familia completa y coherente de componentes DRM (validador de token +
// gestor de licencia + watermarker). El endpoint nunca decide a mano
// qué clase concreta usar, solo llama a DRMFactoryProvider.
// ------------------------------------------------------------------
app.post('/api/stream/autorizar', async (req, res) => {
  const { usuarioId, contenidoId } = req.body;

  try {
    const result = await db.query('SELECT * FROM usuarios WHERE id = $1', [usuarioId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Usuario no encontrado.' });
    }
    const row = result.rows[0];
    const usuario = { id: row.id, planTipo: row.plan_tipo, activo: true };

    // 1. Se obtiene la familia completa de productos DRM para este plan.
    const drmFactory = DRMFactoryProvider.obtenerFactory(usuario.planTipo);

    // 2. Se crean los 3 componentes de esa MISMA familia (garantía del patrón).
    const validador = drmFactory.crearValidadorToken();
    const licencias = drmFactory.crearGestorLicencia();
    const watermarker = drmFactory.crearWatermarker();

    // 3. Se usan en conjunto, sin que el endpoint sepa si es la familia
    //    Básica o Premium.
    const validacion = validador.validarToken(usuario, contenidoId);
    if (!validacion.autorizado) {
      return res.status(403).json({ message: 'Acceso denegado.', validacion });
    }

    const licencia = licencias.emitirLicencia(usuario, contenidoId);
    const marcaDeAgua = watermarker.aplicarMarcaDeAgua(usuario, contenidoId);

    res.status(200).json({ message: 'Reproducción autorizada', validacion, licencia, marcaDeAgua });
  } catch (error) {
    console.error('Error al autorizar DRM:', error);
    res.status(500).json({ message: 'Error interno del servidor.' });
  }
});

// ------------------------------------------------------------------
// Ruta: Streaming adaptativo — genera el manifiesto de reproducción.
// Patrón Builder: en vez de un "new StreamManifest(a, b, c, d, e, f)"
// con parámetros difíciles de recordar, se arma el objeto paso a paso
// y de forma legible.
// ------------------------------------------------------------------
app.post('/api/stream/manifest', (req, res) => {
  const { contenidoId, tokenDRM } = req.body;

  try {
    const manifest = new StreamManifestBuilder()
      .setContenido(contenidoId)
      .agregarCalidad('360p', 800, `https://cdn.ejemplo.com/${contenidoId}/360p.m3u8`)
      .agregarCalidad('720p', 2500, `https://cdn.ejemplo.com/${contenidoId}/720p.m3u8`)
      .agregarCalidad('1080p', 5000, `https://cdn.ejemplo.com/${contenidoId}/1080p.m3u8`)
      .agregarPistaAudio('es', `https://cdn.ejemplo.com/${contenidoId}/audio-es.m3u8`)
      .agregarSubtitulo('es', `https://cdn.ejemplo.com/${contenidoId}/subs-es.vtt`)
      .asignarTokenDRM(tokenDRM || null)
      .build();

    res.status(200).json({ message: 'Manifiesto generado', manifest: manifest.toJSON() });
  } catch (error) {
    console.error('Error al construir el manifiesto:', error);
    res.status(400).json({ message: error.message });
  }
});

// ------------------------------------------------------------------
// Ruta: Recomendación — genera un perfil de preferencias para un usuario.
// Patrón Prototype: en vez de construir el perfil desde cero, se CLONA
// una plantilla ya configurada (accionAventura, familiar, documental)
// y luego se personaliza para ese usuario puntual.
// ------------------------------------------------------------------
app.post('/api/recomendaciones/perfil', (req, res) => {
  const { categoriaBase, generosAdicionales } = req.body;

  try {
    // 1. Se clona la plantilla (la plantilla original nunca se modifica).
    const perfil = PerfilRecomendacionRegistry.obtenerPlantilla(categoriaBase);

    // 2. Se personaliza SOLO el clon, con datos propios de este usuario.
    if (Array.isArray(generosAdicionales)) {
      perfil.generosFavoritos = [...new Set([...perfil.generosFavoritos, ...generosAdicionales])];
    }

    res.status(200).json({ message: 'Perfil de recomendación generado', perfil: perfil.toJSON() });
  } catch (error) {
    console.error('Error al generar perfil de recomendación:', error);
    res.status(400).json({ message: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
});