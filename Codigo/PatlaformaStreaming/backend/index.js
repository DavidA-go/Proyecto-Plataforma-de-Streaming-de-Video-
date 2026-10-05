import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import db from './db/DatabaseSingleton.js'; // Patrón Singleton (sin cambios)
import PlanFactory from './factories/PlanFactory.js'; // Patrón Factory Method (nuevo)
import DRMFactoryProvider from './drm/DRMFactoryProvider.js'; // Patrón Abstract Factory
import StreamManifestBuilder from './streaming/StreamManifestBuilder.js'; // Patrón Builder
import PerfilRecomendacionRegistry from './recommendation/PerfilRecomendacionRegistry.js'; // Patrón Prototype
import { WidevineLicenseAdapter, PlayReadyLicenseAdapter } from './drm/DRMAdapters.js'; // Patrón Adapter
import HLSProtocol from './streaming/HLSProtocol.js'; // Patrón Bridge (implementor concreto)
import DASHProtocol from './streaming/DASHProtocol.js'; // Patrón Bridge (implementor concreto)
import VODDelivery from './streaming/VODDelivery.js'; // Patrón Bridge (abstracción refinada)
import LiveDelivery from './streaming/LiveDelivery.js'; // Patrón Bridge (abstracción refinada)
import CatalogoService from './catalog/CatalogoService.js'; // Patrón Composite (catálogo: serie -> temporada -> episodio)
import {
  AuditoriaDecorator,
  LimiteDispositivosDecorator,
  RestriccionGeograficaDecorator,
  LicenciaDenegadaError,
} from './drm/LicenseDecorators.js'; // Patrón Decorator (reglas apilables sobre LicenseManager)
import SesionesRegistry from './drm/SesionesRegistry.js'; // Sesiones activas (las usa el Decorator de límite)
import AuditoriaLog from './drm/AuditoriaLog.js'; // Bitácora (la llena el Decorator de auditoría)

const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.json());

// Resumen de un nodo del catálogo (sirve igual para una película que para una
// serie o una colección: es la ventaja del Composite).
const resumirContenido = (nodo) => ({
  id: nodo.id,
  tipo: nodo.tipo(),
  titulo: nodo.titulo,
  duracionMin: nodo.getDuracion(),
  duracionTexto: nodo.getDuracionFormateada(),
  totalReproducibles: nodo.obtenerReproducibles().length,
});

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
  const { usuarioId, contenidoId, proveedorExterno, dispositivoId, pais } = req.body;

  try {
    // Patrón Composite: el contenidoId puede ser una película, un episodio,
    // una serie o una colección. El endpoint no necesita saber cuál es.
    const contenido = CatalogoService.buscar(contenidoId);
    if (!contenido) {
      return res.status(404).json({ message: `Contenido "${contenidoId}" no encontrado en el catálogo.` });
    }

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
    let licencias = drmFactory.crearGestorLicencia();
    const watermarker = drmFactory.crearWatermarker();

    // 2.1 Patrón Adapter: si el cliente pide explícitamente un proveedor
    //     DRM comercial (Widevine/PlayReady), sustituimos el LicenseManager
    //     de la familia por su Adapter correspondiente. El resto del flujo
    //     (validación del token, marca de agua) no cambia en absoluto,
    //     porque el Adapter sigue cumpliendo el mismo contrato
    //     LicenseManager.emitirLicencia() que ya usa el Abstract Factory.
    if (proveedorExterno === 'widevine') {
      licencias = new WidevineLicenseAdapter();
    } else if (proveedorExterno === 'playready') {
      licencias = new PlayReadyLicenseAdapter();
    }

    // 2.2 Patrón Decorator: se ENVUELVE el gestor de licencias (sea el de la
    //     familia o el Adapter) con reglas adicionales, como capas de cebolla.
    //     Todas implementan LicenseManager, así que más abajo se sigue
    //     llamando igual: licencias.emitirLicencia(...).
    //
    //     La llamada entra por la capa de afuera y baja hacia adentro:
    //       Auditoría -> Límite de dispositivos -> Región -> gestor real
    //
    //     El límite de pantallas sale del plan creado por PlanFactory
    //     (Factory Method): Básico=1, Premium=2, Familiar=4.
    const plan = PlanFactory.crearPlan(usuario.planTipo);
    licencias = new RestriccionGeograficaDecorator(licencias, pais || 'CO');
    licencias = new LimiteDispositivosDecorator(licencias, plan, dispositivoId || 'dispositivo-por-defecto');
    licencias = new AuditoriaDecorator(licencias);

    // 3. Se usan en conjunto, sin que el endpoint sepa si es la familia
    //    Básica o Premium, ni cuántos decorators hay.
    const validacion = validador.validarToken(usuario, contenidoId);
    if (!validacion.autorizado) {
      return res.status(403).json({ message: 'Acceso denegado.', validacion });
    }

    const licencia = await licencias.emitirLicencia(usuario, contenidoId);
    const marcaDeAgua = watermarker.aplicarMarcaDeAgua(usuario, contenidoId);

    res.status(200).json({
      message: 'Reproducción autorizada',
      validacion,
      licencia,
      marcaDeAgua,
      contenido: resumirContenido(contenido),
    });
  } catch (error) {
    // Una regla de un Decorator rechazó la licencia (límite de pantallas, región...)
    if (error instanceof LicenciaDenegadaError) {
      return res.status(403).json({ message: error.message, codigo: error.codigo });
    }
    console.error('Error al autorizar DRM:', error);
    res.status(500).json({ message: 'Error interno del servidor.' });
  }
});

// ------------------------------------------------------------------
// Ruta: libera la pantalla en uso cuando el usuario deja de reproducir.
// Sin esto, LimiteDispositivosDecorator seguiría contando la sesión
// hasta que expire sola (10 minutos).
// ------------------------------------------------------------------
app.post('/api/stream/detener', (req, res) => {
  const { usuarioId, sesionId } = req.body;
  const liberada = SesionesRegistry.liberar(usuarioId, sesionId);
  res.status(200).json({
    message: liberada ? 'Sesión liberada' : 'La sesión no existía o ya había expirado',
    pantallasEnUso: SesionesRegistry.activas(usuarioId).length,
  });
});

// ------------------------------------------------------------------
// Ruta: consulta la bitácora que llena AuditoriaDecorator
// (licencias emitidas y denegadas, de la más reciente a la más antigua).
// ------------------------------------------------------------------
app.get('/api/stream/auditoria', (req, res) => {
  res.status(200).json({ eventos: AuditoriaLog.ultimos(50) });
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
// Ruta: Streaming — genera el manifiesto combinando TIPO DE ENTREGA
// (vod/live) y PROTOCOLO (hls/dash).
// Patrón Bridge: en vez de necesitar una clase por cada combinación
// (VodHLS, VodDASH, LiveHLS, LiveDASH...), la abstracción
// (VODDelivery/LiveDelivery) se conecta en tiempo de ejecución a un
// protocolo intercambiable (HLSProtocol/DASHProtocol). Internamente
// sigue apoyándose en el Builder para ensamblar el StreamManifest.
// ------------------------------------------------------------------
app.post('/api/stream/entrega', (req, res) => {
  const { contenidoId, tokenDRM, tipoEntrega, protocolo } = req.body;

  try {
    // 1. Se elige el protocolo concreto: el "puente" hacia la implementación.
    let protocoloConcreto;
    if (protocolo === 'dash') {
      protocoloConcreto = new DASHProtocol();
    } else if (protocolo === 'hls') {
      protocoloConcreto = new HLSProtocol();
    } else {
      return res.status(400).json({ message: 'protocolo inválido. Usa "hls" o "dash".' });
    }

    // 2. Se elige el tipo de entrega (la abstracción refinada) y se le
    //    inyecta el protocolo elegido: cualquier combinación tipoEntrega x
    //    protocolo es válida sin necesitar una clase nueva por combinación.
    let entrega;
    if (tipoEntrega === 'live') {
      entrega = new LiveDelivery(protocoloConcreto);
    } else if (tipoEntrega === 'vod') {
      entrega = new VODDelivery(protocoloConcreto);
    } else {
      return res.status(400).json({ message: 'tipoEntrega inválido. Usa "vod" o "live".' });
    }

    // 3. Patrón Composite: se resuelve el contenido en el catálogo. Una
    //    película devuelve [ella misma]; una serie devuelve todos sus
    //    episodios; una colección, todo lo que contiene. Para cada elemento
    //    reproducible se genera su manifiesto con el MISMO código (Bridge).
    const contenido = CatalogoService.buscar(contenidoId);
    if (!contenido) {
      return res.status(404).json({ message: `Contenido "${contenidoId}" no encontrado en el catálogo.` });
    }

    const reproducibles = contenido.obtenerReproducibles().map((elemento) => ({
      id: elemento.id,
      titulo: elemento.titulo,
      tipo: elemento.tipo(),
      manifest: entrega.generarManifest(elemento.id, tokenDRM),
    }));

    res.status(200).json({
      message: 'Manifiesto generado con Bridge',
      manifest: reproducibles[0].manifest, // primer reproducible (compatible con el Dashboard anterior)
      reproducibles,
      contenido: resumirContenido(contenido),
    });
  } catch (error) {
    console.error('Error al generar entrega de streaming:', error);
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

// ------------------------------------------------------------------
// Ruta: Catálogo — devuelve el árbol de contenido.
// Patrón Composite: colecciones, series, temporadas, episodios y
// películas se tratan con la misma interfaz (ElementoContenido), así
// que el árbol completo se serializa con una sola llamada recursiva.
//
// Filtros opcionales:
//   ?generos=accion,thriller   -> árbol podado por géneros
//   ?perfil=familiar           -> usa los géneros de una plantilla del
//                                 Prototype (PerfilRecomendacionRegistry)
// ------------------------------------------------------------------
app.get('/api/catalogo', (req, res) => {
  try {
    let generos = [];
    if (req.query.perfil) {
      const perfil = PerfilRecomendacionRegistry.obtenerPlantilla(String(req.query.perfil));
      generos = perfil.generosFavoritos;
    } else if (req.query.generos) {
      generos = String(req.query.generos).split(',');
    }

    if (generos.length === 0) {
      return res.status(200).json({ catalogo: CatalogoService.obtenerArbol() });
    }

    const catalogo = CatalogoService.filtrarPorGeneros(generos);
    res.status(200).json({ generos, catalogo, ...(catalogo ? {} : { message: 'Sin resultados para esos géneros.' }) });
  } catch (error) {
    console.error('Error al consultar el catálogo:', error);
    res.status(400).json({ message: error.message });
  }
});

// Ruta: un nodo cualquiera del catálogo (película, serie, temporada, colección...).
app.get('/api/catalogo/:id', (req, res) => {
  const nodo = CatalogoService.buscar(req.params.id);
  if (!nodo) {
    return res.status(404).json({ message: `Contenido "${req.params.id}" no encontrado.` });
  }
  res.status(200).json({ contenido: nodo.toJSON(), resumen: resumirContenido(nodo) });
});

app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
});