import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';

// Convierte el título de una tarjeta en un id simple para mandarlo al backend
// (ej. "El Último Vuelo" -> "el-ultimo-vuelo")
const slugify = (texto) =>
  texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '-');

// Cada navegador cuenta como un "dispositivo" para el límite de pantallas
// (Decorator LimiteDispositivosDecorator). Se guarda para que sea estable.
// Para probar el límite: abre la misma cuenta en otro navegador o en una
// ventana de incógnito (tendrá otro dispositivoId).
const getDispositivoId = () => {
  let id = localStorage.getItem('cineverse_device_id');
  if (!id) {
    id = `web-${Math.random().toString(36).slice(2, 8)}`;
    localStorage.setItem('cineverse_device_id', id);
  }
  return id;
};

const TIPO_LABEL = {
  coleccion: 'Colección',
  serie: 'Serie',
  temporada: 'Temporada',
  episodio: 'Episodio',
  pelicula: 'Película',
  documental: 'Documental',
};

// Nodo del árbol del catálogo (patrón Composite, del lado del frontend).
// Es RECURSIVO: si el nodo tiene "hijos" (colección, serie, temporada) se
// dibuja como grupo desplegable y se llama a sí mismo por cada hijo; si no
// (película, documental, episodio) se dibuja como hoja. Para dibujar el
// árbol no hace falta saber de antemano cuántos niveles tiene.
function CatalogNode({ nodo, onPlay, nivel = 0 }) {
  const esGrupo = Array.isArray(nodo.hijos);

  const etiqueta = (
    <span className="catalog-label">
      <span className={`catalog-tag catalog-tag-${nodo.tipo}`}>{TIPO_LABEL[nodo.tipo] || nodo.tipo}</span>
      <span className="catalog-title">{nodo.titulo}</span>
      <span className="catalog-meta">
        {nodo.duracionTexto}
        {esGrupo ? ` · ${nodo.totalReproducibles} reproducible(s)` : ''}
      </span>
    </span>
  );

  // La raíz no se reproduce (serían decenas de manifiestos de golpe).
  const boton =
    nivel > 0 ? (
      <button
        type="button"
        className="catalog-play"
        title={`Reproducir ${nodo.titulo}`}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onPlay({ id: nodo.id, title: nodo.titulo });
        }}
      >
        ▶
      </button>
    ) : null;

  if (!esGrupo) {
    return (
      <div className="catalog-leaf">
        {etiqueta}
        {boton}
      </div>
    );
  }

  return (
    <details className="catalog-group" open={nivel < 1}>
      <summary>
        {etiqueta}
        {boton}
      </summary>
      <div className="catalog-children">
        {nodo.hijos.map((hijo) => (
          <CatalogNode key={hijo.id} nodo={hijo} onPlay={onPlay} nivel={nivel + 1} />
        ))}
      </div>
    </details>
  );
}

// Mapeo simple: cada plan de suscripción "sugiere" una categoría de perfil
// de recomendación distinta, solo para variar la demo del Prototype.
const CATEGORIA_POR_PLAN = {
  free: 'documental',
  basico: 'documental',
  premium: 'accionAventura',
  familiar: 'familiar',
};


const ROWS = [
  {
    title: 'Continuar viendo',
    items: [
      { title: 'Horizonte Nocturno', meta: 'Temporada 2 · Ep. 4', gradient: 'linear-gradient(160deg, #9a2e58, #2a0f1e)' },
      { title: 'El Último Vuelo', meta: 'Película · 2h 06m', gradient: 'linear-gradient(160deg, #3a3550, #16141f)' },
      { title: 'Códigos del Silencio', meta: 'Temporada 1 · Ep. 9', gradient: 'linear-gradient(160deg, #8a5a12, #2a1c06)' },
      { title: 'Raíces de Cobre', meta: 'Documental · 48m', gradient: 'linear-gradient(160deg, #2f4f4a, #10201d)' },
    ],
  },
  {
    title: 'Tendencias esta semana',
    items: [
      { title: 'Faro Escarlata', meta: 'Nueva temporada', gradient: 'linear-gradient(160deg, #6c1b3b, #1c0a13)' },
      { title: 'Ciudad de Vidrio', meta: 'Película · 1h 52m', gradient: 'linear-gradient(160deg, #4a3860, #16111f)' },
      { title: 'Bajo Cero', meta: 'Miniserie · 6 episodios', gradient: 'linear-gradient(160deg, #375a7f, #101c26)' },
      { title: 'La Otra Orilla', meta: 'Temporada 3', gradient: 'linear-gradient(160deg, #8a3a1c, #241108)' },
      { title: 'Ámbar', meta: 'Película · 2h 14m', gradient: 'linear-gradient(160deg, #b3862a, #2b1f06)' },
    ],
  },
  {
    title: 'Recomendado para ti',
    items: [
      { title: 'Reino de Papel', meta: 'Temporada 1', gradient: 'linear-gradient(160deg, #5a2a6c, #180a1f)' },
      { title: 'Selva Digital', meta: 'Documental · 55m', gradient: 'linear-gradient(160deg, #2a6c4a, #0a1f14)' },
      { title: 'Marea Alta', meta: 'Película · 1h 47m', gradient: 'linear-gradient(160deg, #2a4a6c, #0a1420)' },
      { title: 'Vestigios', meta: 'Temporada 2', gradient: 'linear-gradient(160deg, #6c4a2a, #1f130a)' },
    ],
  },
];

export default function Dashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [reproduciendo, setReproduciendo] = useState(null); // resultado de DRM + Builder
  const [perfilRecomendado, setPerfilRecomendado] = useState(null); // resultado de Prototype
  const [errorReproduccion, setErrorReproduccion] = useState('');
  const [mostrarCatalogo, setMostrarCatalogo] = useState(false);
  const [catalogo, setCatalogo] = useState(null); // árbol del Composite
  const [soloMiPerfil, setSoloMiPerfil] = useState(false);
  const [errorCatalogo, setErrorCatalogo] = useState('');
  const [auditoria, setAuditoria] = useState(null); // evidencia del Facade: bitácora DRM (null = panel cerrado)
  const [errorAuditoria, setErrorAuditoria] = useState('');

  useEffect(() => {
    const stored = localStorage.getItem('cineverse_user');
    if (stored) {
      setUser(JSON.parse(stored));
    }
  }, []);

  // Se dispara solo al entrar al Dashboard: pide un perfil de recomendación
  // clonado (Prototype) según el plan del usuario. Esto es justo lo que
  // pediste ver: "usuario tal tiene este grupo/perfil" sin tocar la terminal.
  useEffect(() => {
    if (!user) return;

    const categoriaBase = CATEGORIA_POR_PLAN[user.planTipo] || 'accionAventura';
    console.log(`🧬 [Prototype] Pidiendo perfil de recomendación para "${user.nombre}" (categoría base: ${categoriaBase})...`);

    axios
      .post('http://localhost:5000/api/recomendaciones/perfil', { categoriaBase })
      .then((res) => {
        console.log(`✅ [Prototype] Perfil clonado recibido para "${user.nombre}":`, res.data.perfil);
        setPerfilRecomendado(res.data.perfil);
      })
      .catch((err) => console.error('❌ No se pudo cargar el perfil de recomendación:', err));
  }, [user]);

  // Patrón Composite: carga el árbol del catálogo cuando se abre el panel.
  // Con "Solo mi perfil" se le pasa al backend la categoría del Prototype
  // (?perfil=familiar) y devuelve el árbol podado por esos géneros.
  useEffect(() => {
    if (!mostrarCatalogo || !user) return;

    const categoriaBase = CATEGORIA_POR_PLAN[user.planTipo] || 'accionAventura';
    const params = soloMiPerfil ? { perfil: categoriaBase } : {};

    axios
      .get('http://localhost:5000/api/catalogo', { params })
      .then((res) => {
        console.log('🌳 [Composite] Árbol del catálogo recibido:', res.data.catalogo);
        setCatalogo(res.data.catalogo);
        setErrorCatalogo('');
      })
      .catch((err) => {
        console.error('❌ No se pudo cargar el catálogo:', err);
        setErrorCatalogo('No se pudo cargar el catálogo.');
      });
  }, [mostrarCatalogo, soloMiPerfil, user]);

  // Se dispara al darle clic al botón de play de cualquier tarjeta:
  // 1) Facade (DRM): una sola llamada a /api/stream/autorizar. Por debajo, el
  //    backend coordina Abstract Factory (valida el token y emite la licencia
  //    según el plan), Adapter (Widevine/PlayReady), Factory Method y Decorators.
  //    Ya no decidimos aquí el proveedor DRM: con proveedorExterno: 'auto' la
  //    fachada elige Widevine (Premium/Familiar) o PlayReady (Free/Básico).
  // 2) Bridge: arma el manifiesto combinando tipo de entrega (vod) y
  //    protocolo (hls), apoyándose internamente en el Builder.
  const handlePlay = async (item) => {
    if (!user) return;
    setErrorReproduccion('');
    setReproduciendo(null);
    // Las tarjetas fijas usan el slug del título; los nodos del catálogo traen su id.
    const contenidoId = item.id || slugify(item.title);

    try {
      console.log(`🏛️ [Facade] Pidiendo autorización DRM para usuario #${user.id} (plan ${user.planTipo})...`);
      const autorizacion = await axios.post('http://localhost:5000/api/stream/autorizar', {
        usuarioId: user.id,
        contenidoId,
        // 'auto': el backend (DRMFacade) elige el Adapter según el plan:
        // Premium/Familiar -> Widevine, Free/Básico -> PlayReady.
        proveedorExterno: 'auto',
        dispositivoId: getDispositivoId(), // para el Decorator de límite de pantallas
        pais: 'CO', // para el Decorator de restricción geográfica
      });
      console.log(`✅ [Facade] Autorización + licencia recibida (proveedor: ${autorizacion.data.licencia.proveedorExterno || 'propio'}):`, autorizacion.data);

      console.log(`🌉 [Bridge] Generando entrega VOD sobre HLS para "${item.title}"...`);
      const entrega = await axios.post('http://localhost:5000/api/stream/entrega', {
        contenidoId,
        tokenDRM: autorizacion.data.licencia.licenciaId,
        tipoEntrega: 'vod',
        protocolo: 'hls',
      });
      console.log('✅ [Bridge] Manifiesto listo:', entrega.data.manifest);

      setReproduciendo({
        titulo: item.title,
        licencia: autorizacion.data.licencia,
        manifest: entrega.data.manifest,
        contenido: entrega.data.contenido, // resumen del nodo (Composite)
        totalManifiestos: entrega.data.reproducibles.length,
      });
    } catch (err) {
      console.error('❌ Error al autorizar/construir la reproducción:', err);
      setErrorReproduccion(err.response?.data?.message || 'No se pudo autorizar la reproducción.');
    }
  };

  // Evidencia visible del Facade: consulta la bitácora de licencias (EMITIDA /
  // DENEGADA) que el backend expone a través de DRMFacade.auditoria().
  // Si el panel ya está abierto, el botón lo cierra.
  const handleVerAuditoria = async () => {
    if (auditoria) {
      setAuditoria(null);
      return;
    }
    try {
      console.log('🏛️ [Facade] Consultando bitácora de auditoría (DRMFacade.auditoria)...');
      const res = await axios.get('http://localhost:5000/api/stream/auditoria');
      console.log('✅ [Facade] Eventos de auditoría recibidos:', res.data.eventos);
      setAuditoria(res.data.eventos);
      setErrorAuditoria('');
    } catch (err) {
      console.error('❌ No se pudo cargar la auditoría:', err);
      setErrorAuditoria('No se pudo cargar la auditoría.');
    }
  };

  // Libera la pantalla en uso (Decorator de límite) al dejar de reproducir.
  const handleStop = async () => {
    if (!user || !reproduciendo) return;
    try {
      await axios.post('http://localhost:5000/api/stream/detener', {
        usuarioId: user.id,
        sesionId: reproduciendo.licencia.sesionId,
      });
    } catch (err) {
      console.error('❌ No se pudo liberar la sesión:', err);
    }
    setReproduciendo(null);
  };

  const handleLogout = () => {
    if (user && reproduciendo) {
      axios
        .post('http://localhost:5000/api/stream/detener', {
          usuarioId: user.id,
          sesionId: reproduciendo.licencia.sesionId,
        })
        .catch(() => {});
    }
    localStorage.removeItem('cineverse_user');
    navigate('/login');
  };

  const displayName = user?.nombre || 'Invitado';
  const firstName = displayName.split(' ')[0];
  const initial = displayName.charAt(0).toUpperCase();

  // Etiquetas legibles para el tipo de plan (creado en el backend vía Factory Method)
  const PLAN_LABELS = {
    free: 'Free',
    basico: 'Básico',
    premium: 'Premium',
    familiar: 'Familiar',
  };
  const planLabel = PLAN_LABELS[user?.planTipo] || 'Free';
  const precio = user?.precioMensual ?? 0;
  const precioFormateado =
    precio > 0
      ? `$${Number(precio).toLocaleString('es-CO')}/mes`
      : 'Gratis';

  return (
    <div className="dash">
      <nav className="dash-nav">
        <div className="dash-nav-left">
          <div className="dash-brand">
            <svg width="26" height="26" viewBox="0 0 34 34" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="17" cy="17" r="16" stroke="#e3b23c" strokeWidth="1.5" />
              <path d="M14 11.5L23 17L14 22.5V11.5Z" fill="#e3b23c" />
            </svg>
            <span className="dash-brand-name">CineVerse</span>
          </div>
          <ul className="dash-links">
            <li className="active">Inicio</li>
            <li>Series</li>
            <li>Películas</li>
            <li>Mi lista</li>
          </ul>
        </div>

        <div className="dash-user">
          <div className="dash-user-info">
            <span className="dash-user-name">{displayName}</span>
            {user?.rol && <span className="dash-user-role">{user.rol}</span>}
          </div>
          <div className="dash-avatar">{initial}</div>
          <button className="dash-logout" onClick={handleLogout}>
            Cerrar sesión
          </button>
        </div>
      </nav>

      <header className="dash-hero">
        <p className="dash-hero-eyebrow">Tu sesión está activa</p>
        <h1>Hola de nuevo, {firstName}</h1>
        <p>Retoma tus series pendientes o descubre algo nuevo del catálogo seleccionado para ti esta semana.</p>
        <div className="dash-hero-cta">
          <button
            className="btn-primary"
            style={{ width: 'auto', padding: '12px 26px' }}
            onClick={() => setMostrarCatalogo((v) => !v)}
          >
            {mostrarCatalogo ? 'Ocultar catálogo' : 'Explorar catálogo'}
          </button>
          <button className="btn-ghost">Mi lista</button>
        </div>

        <div className="dash-plan-card">
          <div className="dash-plan-info">
            <span className="dash-plan-badge">Plan {planLabel}</span>
            <span className="dash-plan-price">{precioFormateado}</span>
          </div>
          <ul className="dash-plan-details">
            <li>Calidad máxima: {user?.calidadMaxima || 'SD (480p)'}</li>
            <li>Pantallas simultáneas: {user?.pantallasSimultaneas ?? 1}</li>
            <li>Descargas offline: {user?.descargasOffline ? 'Sí' : 'No'}</li>
          </ul>
          <Link to="/profile" className="dash-plan-link">
            Cambiar plan →
          </Link>
        </div>

        {/* Resultado visible del Composite: árbol colección > serie > temporada > episodio */}
        {mostrarCatalogo && (
          <div className="catalog-panel">
            <div className="catalog-panel-head">
              <span className="dash-plan-badge">Catálogo (Composite)</span>
              <label className="catalog-filter">
                <input
                  type="checkbox"
                  checked={soloMiPerfil}
                  onChange={(e) => setSoloMiPerfil(e.target.checked)}
                />
                Solo mi perfil{perfilRecomendado ? ` (${perfilRecomendado.nombre})` : ''}
              </label>
            </div>
            {errorCatalogo && <div className="alert-error">{errorCatalogo}</div>}
            {catalogo ? (
              <CatalogNode nodo={catalogo} onPlay={handlePlay} />
            ) : (
              !errorCatalogo && <p className="catalog-empty">{soloMiPerfil ? 'No hay contenido para tu perfil.' : 'Cargando catálogo…'}</p>
            )}
          </div>
        )}

        {/* Resultado visible del Prototype: el perfil clonado para este usuario */}
        {perfilRecomendado && (
          <div className="dash-plan-card" style={{ marginTop: '12px' }}>
            <div className="dash-plan-info">
              <span className="dash-plan-badge">Tu perfil de recomendación: {perfilRecomendado.nombre}</span>
            </div>
            <ul className="dash-plan-details">
              <li>Géneros favoritos: {perfilRecomendado.generosFavoritos.join(', ')}</li>
              <li>Tipo de contenido preferido: {perfilRecomendado.tipoContenidoPreferido}</li>
              <li>Peso del historial: {perfilRecomendado.pesoHistorial}</li>
            </ul>
          </div>
        )}

        {/* Resultado visible del Abstract Factory (DRM) + Builder (manifiesto) */}
        {errorReproduccion && (
          <div className="alert-error" style={{ marginTop: '12px' }}>{errorReproduccion}</div>
        )}
        {reproduciendo && (
          <div className="dash-plan-card" style={{ marginTop: '12px' }}>
            <div className="dash-plan-info">
              <span className="dash-plan-badge">▶ Reproduciendo: {reproduciendo.titulo}</span>
            </div>
            <ul className="dash-plan-details">
              <li>
                Fachada (Facade): 1 sola llamada a DRMFacade.autorizarReproduccion coordinó Composite,
                Abstract Factory, Adapter, Factory Method y Decorators
              </li>
              <li>Licencia: {reproduciendo.licencia.licenciaId}</li>
              <li>Duración de la licencia: {reproduciendo.licencia.duracionMinutos} min</li>
              <li>Descarga offline: {reproduciendo.licencia.permiteOffline ? 'Sí' : 'No'}</li>
              <li>Proveedor DRM (Adapter): {reproduciendo.licencia.proveedorExterno}</li>
              <li>
                Contenido (Composite): {TIPO_LABEL[reproduciendo.contenido.tipo]} · {reproduciendo.contenido.duracionTexto} ·{' '}
                {reproduciendo.totalManifiestos} manifiesto(s) generado(s)
              </li>
              <li>
                Pantallas en uso (Decorator): {reproduciendo.licencia.pantallasEnUso} de {reproduciendo.licencia.pantallasMaximas} ·
                Región: {reproduciendo.licencia.region} · Auditoría: {reproduciendo.licencia.auditoriaId}
              </li>
              <li>Calidades disponibles: {reproduciendo.manifest.calidades.map((c) => c.resolucion).join(', ')}</li>
              <li>Streaming adaptativo: {reproduciendo.manifest.adaptativo ? 'Activado' : 'Desactivado'}</li>
              <li>Protocolo (Bridge): {reproduciendo.manifest.protocolo} · Tipo de entrega: {reproduciendo.manifest.tipoEntrega}</li>
            </ul>
            <button className="btn-ghost" style={{ alignSelf: 'flex-start' }} onClick={handleStop}>
              ■ Detener reproducción
            </button>
          </div>
        )}

        {/* Evidencia del Facade: bitácora de licencias vía DRMFacade.auditoria().
            Se muestra aunque no haya reproducción, para ver también las DENEGADAS. */}
        <div style={{ marginTop: '12px' }}>
          <button className="btn-ghost" onClick={handleVerAuditoria}>
            {auditoria ? '✕ Cerrar auditoría' : '🏛️ Ver auditoría (Facade)'}
          </button>
        </div>
        {errorAuditoria && (
          <div className="alert-error" style={{ marginTop: '12px' }}>{errorAuditoria}</div>
        )}
        {auditoria && (
          <div className="dash-plan-card" style={{ marginTop: '12px' }}>
            <div className="dash-plan-info">
              <span className="dash-plan-badge">
                Bitácora DRM (Facade → DRMFacade.auditoria): {auditoria.length} evento(s)
              </span>
            </div>
            {auditoria.length === 0 ? (
              <ul className="dash-plan-details">
                <li>Aún no hay eventos. Pulsa ▶ en un contenido y vuelve a consultar.</li>
              </ul>
            ) : (
              <ul className="dash-plan-details">
                {auditoria.map((ev) => (
                  <li key={ev.id}>
                    {ev.id} · {ev.resultado === 'EMITIDA' ? '✅ EMITIDA' : '⛔ DENEGADA'} · usuario #{ev.usuarioId} ·{' '}
                    {ev.contenidoId} ·{' '}
                    {ev.resultado === 'EMITIDA' ? `licencia ${ev.licenciaId}` : `motivo ${ev.motivo}`} ·{' '}
                    {new Date(ev.fecha).toLocaleTimeString()}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </header>

      <main className="dash-content">
        {ROWS.map((row) => (
          <section className="dash-row" key={row.title}>
            <h2 className="dash-row-title">{row.title}</h2>
            <div className="dash-row-scroll">
              {row.items.map((item) => (
                <article
                  className="dash-card"
                  key={item.title}
                  style={{ background: item.gradient }}
                >
                  <span className="dash-card-play" onClick={() => handlePlay(item)} style={{ cursor: 'pointer' }}>
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <path d="M4 2.5L11 7L4 11.5V2.5Z" fill="#fff" />
                    </svg>
                  </span>
                  <div className="dash-card-info">
                    <p className="dash-card-title">{item.title}</p>
                    <p className="dash-card-meta">{item.meta}</p>
                  </div>
                </article>
              ))}
            </div>
          </section>
        ))}
      </main>
    </div>
  );
}