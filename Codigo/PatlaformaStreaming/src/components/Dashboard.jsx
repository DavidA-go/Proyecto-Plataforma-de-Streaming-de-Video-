import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../api';
import PatronesComportamiento from './PatronesComportamiento';
import Reproductor from './Reproductor';
import { aplanarCatalogo, metaDe, degradadoDe, filtrar, generosDisponibles, leerLista, guardarLista, alternar } from '../titulos';
import { NOMBRE_CATEGORIA, categoriaSugerida } from '../perfilPlan';

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
      {nodo.contenidoReal && <span className="catalog-tag catalog-tag-real" title="Tiene archivo de video real">▶ Video real</span>}
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

// "Mi lista" se lee al abrir el Dashboard: la sesión guardada dice de quién es (cada usuario tiene la suya).
function listaInicial() {
  try {
    const guardado = JSON.parse(localStorage.getItem('cineverse_user'));
    return guardado ? leerLista(localStorage, guardado.id) : [];
  } catch {
    return [];
  }
}

// ---------- Tarjetas de títulos (salen del catálogo real, no de una lista fija) ----------

function TarjetaTitulo({ t, detalle, enLista, onPlay, onLista }) {
  const reproducir = () => onPlay({ id: t.id, title: t.titulo });
  return (
    <article
      className="dash-card"
      style={{ background: degradadoDe(t) }}
      role="button"
      tabIndex={0}
      title={`Reproducir ${t.titulo}`}
      onClick={reproducir}
      onKeyDown={(e) => {
        if (e.key === 'Enter') reproducir();
      }}
    >
      <button
        type="button"
        className={`dash-card-list${enLista ? ' on' : ''}`}
        title={enLista ? 'Quitar de Mi lista' : 'Agregar a Mi lista'}
        aria-label={enLista ? `Quitar ${t.titulo} de Mi lista` : `Agregar ${t.titulo} a Mi lista`}
        onClick={(e) => {
          e.stopPropagation();
          onLista(t.id);
        }}
      >
        {enLista ? '✓' : '+'}
      </button>
      {t.contenidoReal && <span className="dash-card-badge">▶ Video real</span>}
      <span className="dash-card-play">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M4 2.5L11 7L4 11.5V2.5Z" fill="#fff" />
        </svg>
      </span>
      <div className="dash-card-info">
        <p className="dash-card-title">{t.titulo}</p>
        <p className="dash-card-meta">{detalle || metaDe(t)}</p>
      </div>
    </article>
  );
}

// Fila horizontal (pestaña Inicio)
function FilaTitulos({ titulo, items, onVerTodo, ...resto }) {
  if (items.length === 0) return null;
  return (
    <section className="dash-row">
      <h2 className="dash-row-title">
        {titulo}
        {onVerTodo && (
          <button type="button" className="dash-row-more" onClick={onVerTodo}>
            Ver todo →
          </button>
        )}
      </h2>
      <div className="dash-row-scroll">
        {items.map(({ t, detalle }) => (
          <TarjetaTitulo key={t.id} t={t} detalle={detalle} enLista={resto.lista.includes(t.id)} onPlay={resto.onPlay} onLista={resto.onLista} />
        ))}
      </div>
    </section>
  );
}

// Cuadrícula (pestañas Series, Películas y Mi lista)
function CuadriculaTitulos({ titulo, items, vacio, ...resto }) {
  return (
    <section className="dash-row">
      {titulo && <h2 className="dash-row-title">{titulo} <small className="dash-row-count">({items.length})</small></h2>}
      {items.length === 0 ? (
        <p className="catalog-empty">{vacio}</p>
      ) : (
        <div className="dash-grid">
          {items.map((t) => (
            <TarjetaTitulo key={t.id} t={t} enLista={resto.lista.includes(t.id)} onPlay={resto.onPlay} onLista={resto.onLista} />
          ))}
        </div>
      )}
    </section>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [reproduciendo, setReproduciendo] = useState(null); // resultado de DRM + Builder
  const [perfilRecomendado, setPerfilRecomendado] = useState(null); // resultado de Prototype
  const [errorReproduccion, setErrorReproduccion] = useState('');
  const [mostrarCatalogo, setMostrarCatalogo] = useState(false);
  const [mostrarPatrones, setMostrarPatrones] = useState(false); // validación de patrones de comportamiento
  const [catalogo, setCatalogo] = useState(null); // árbol del Composite
  const [soloMiPerfil, setSoloMiPerfil] = useState(false);
  const [errorCatalogo, setErrorCatalogo] = useState('');
  const [auditoria, setAuditoria] = useState(null); // evidencia del Facade: bitácora DRM (null = panel cerrado)
  const [errorAuditoria, setErrorAuditoria] = useState('');
  const [vista, setVista] = useState('inicio'); // pestaña del menú: inicio | series | peliculas | lista
  const [titulos, setTitulos] = useState([]); // todas las tarjetas, aplanadas desde el árbol del catálogo
  const [errorTitulos, setErrorTitulos] = useState('');
  const [genero, setGenero] = useState(''); // filtro de las pestañas Series y Películas
  const [lista, setLista] = useState(() => listaInicial()); // ids de "Mi lista" (por usuario, en el navegador)
  const [recomendados, setRecomendados] = useState([]); // GET /api/recomendaciones (Template Method + Strategy)
  const [vistos, setVistos] = useState([]); // historial de visualización (alimenta "Continuar viendo")
  const [versionHistorial, setVersionHistorial] = useState(0); // sube cada vez que se registra un título visto
  const [episodiosSerie, setEpisodiosSerie] = useState(null); // { serie, episodios: [{ id, etiqueta }] } cuando se reproduce una serie
  const mainRef = useRef(null);
  const reproductorRef = useRef(null);

  useEffect(() => {
    const stored = localStorage.getItem('cineverse_user');
    if (stored) {
      setUser(JSON.parse(stored));
    }
  }, []);

  // Al entrar: se carga EL perfil de recomendación del usuario (el mismo que se edita en el Memento).
  // La primera vez no existe: se crea clonando la plantilla que SUGIERE su plan (Prototype) y queda guardado
  // (Memento), así la tarjeta de abajo, las recomendaciones y el panel Memento muestran siempre lo mismo.
  // El plan solo sugiere el punto de partida: después el perfil es de la persona y no cambia si cambia de plan.
  useEffect(() => {
    if (!user) return undefined;
    let cancelado = false;
    const sugerida = categoriaSugerida(user.planTipo);
    (async () => {
      try {
        let data;
        try {
          data = (await api.get('/api/recomendaciones/mi-perfil')).data;
        } catch (err) {
          if (err.response?.status !== 404) throw err;
          console.log(`🧬 [Prototype] "${user.nombre}" aún no tiene perfil: se clona la plantilla "${sugerida}" (sugerida por su plan ${user.planTipo}) y se guarda.`);
          data = (await api.put('/api/recomendaciones/mi-perfil', { categoriaBase: sugerida })).data;
        }
        if (!cancelado) setPerfilRecomendado(data.perfil);
      } catch (err) {
        console.error('❌ No se pudo cargar el perfil de recomendación:', err);
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [user]);

  // Todas las tarjetas salen del árbol del catálogo (Composite): se aplana a una lista de títulos.
  useEffect(() => {
    if (!user) return;
    api
      .get('/api/catalogo')
      .then((res) => {
        setTitulos(aplanarCatalogo(res.data.catalogo));
        setErrorTitulos('');
      })
      .catch((err) => setErrorTitulos(err.response?.data?.message || 'No se pudo cargar el catálogo.'));
  }, [user]);

  // Recomendaciones reales ("Recomendado para ti") e historial ("Continuar viendo").
  useEffect(() => {
    if (!perfilRecomendado) return;
    api
      .get('/api/recomendaciones', { params: { tipo: 'para-ti', limite: 10 } })
      .then((res) => setRecomendados(res.data.recomendaciones))
      .catch(() => setRecomendados([]));
    api
      .get('/api/recomendaciones/historial')
      .then((res) => setVistos(res.data.vistos))
      .catch(() => setVistos([]));
  }, [perfilRecomendado, versionHistorial]);

  // Patrón Composite: carga el árbol del catálogo cuando se abre el panel.
  // Con "Solo mi perfil" se le pasa al backend la categoría del Prototype
  // (?perfil=familiar) y devuelve el árbol podado por esos géneros.
  useEffect(() => {
    if (!mostrarCatalogo || !user) return;

    const params = soloMiPerfil && perfilRecomendado ? { generos: perfilRecomendado.generosFavoritos.join(',') } : {};

    api
      .get('/api/catalogo', { params })
      .then((res) => {
        console.log('🌳 [Composite] Árbol del catálogo recibido:', res.data.catalogo);
        setCatalogo(res.data.catalogo);
        setErrorCatalogo('');
      })
      .catch((err) => {
        console.error('❌ No se pudo cargar el catálogo:', err);
        setErrorCatalogo(err.response?.data?.message || 'No se pudo cargar el catálogo.');
      });
  }, [mostrarCatalogo, soloMiPerfil, user, perfilRecomendado]);

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
      const autorizacion = await api.post('/api/stream/autorizar', {
        contenidoId, // el usuario sale del token: el Proxy ignora cualquier usuarioId
        // 'auto': el backend (DRMFacade) elige el Adapter según el plan:
        // Premium/Familiar -> Widevine, Free/Básico -> PlayReady.
        proveedorExterno: 'auto',
        dispositivoId: getDispositivoId(), // para el Decorator de límite de pantallas
        // El país ya no se manda: lo decide el servidor (cabecera del CDN o configuración) para el Decorator geográfico.
      });
      console.log(`✅ [Facade] Autorización + licencia recibida (proveedor: ${autorizacion.data.licencia.proveedorExterno || 'propio'}):`, autorizacion.data);

      // protocolo 'auto': el backend elige por título (MP4 si tiene video real, HLS si es de demostración).
      console.log(`🌉 [Bridge] Generando entrega VOD (protocolo automático) para "${item.title}"...`);
      const entrega = await api.post('/api/stream/entrega', {
        contenidoId,
        tokenDRM: autorizacion.data.licencia.licenciaId,
        // Sesión DRM de la licencia: para un video real el backend la exige vigente antes de firmar el acceso.
        sesionId: autorizacion.data.licencia.sesionId,
        tipoEntrega: 'vod',
        protocolo: 'auto',
      });
      console.log('✅ [Bridge] Manifiesto listo:', entrega.data.manifest);

      // SERIE: se pide la lista de sus episodios para poder elegir cuál ver (y se conserva al cambiar de episodio).
      let listaEpisodios = null;
      if (entrega.data.contenido?.tipo === 'serie') {
        try {
          const r = await api.get(`/api/catalogo/${encodeURIComponent(contenidoId)}/recorrer`, { params: { tipo: 'episodio', limite: 100 } });
          listaEpisodios = {
            serie: item.title,
            episodios: r.data.elementos.map((e) => {
              const m = /-t(\d+)-e(\d+)$/.exec(e.id);
              return { id: e.id, etiqueta: m ? `T${m[1]} · E${m[2]} — ${e.titulo}` : e.titulo };
            }),
          };
        } catch (e) {
          console.warn('No se pudo cargar la lista de episodios:', e);
        }
      }
      setEpisodiosSerie((previa) => listaEpisodios ?? (previa?.episodios.some((e) => e.id === contenidoId) ? previa : null));

      setReproduciendo({
        titulo: item.title,
        licencia: autorizacion.data.licencia,
        manifest: entrega.data.manifest,
        contenido: entrega.data.contenido, // resumen del nodo (Composite)
        totalManifiestos: entrega.data.reproducibles.length,
        reproducibleId: entrega.data.reproducibles[0].id, // el título que realmente se reproduce (si pulsaste una colección, el primero)
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
      const res = await api.get('/api/stream/auditoria');
      console.log('✅ [Facade] Eventos de auditoría recibidos:', res.data.eventos);
      setAuditoria(res.data.eventos);
      setErrorAuditoria('');
    } catch (err) {
      console.error('❌ No se pudo cargar la auditoría:', err);
      setErrorAuditoria(err.response?.data?.message || 'No se pudo cargar la auditoría.');
    }
  };

  // Primera vez que el video realmente arranca: el título cuenta como visto. Ese historial lo usa la
  // estrategia de recomendación por historial (Strategy + Template Method). No es crítico: si falla, se ignora.
  const handlePrimeraReproduccion = () => {
    if (!reproduciendo?.reproducibleId) return;
    api
      .post('/api/recomendaciones/historial', { contenidoId: reproduciendo.reproducibleId })
      .then(() => setVersionHistorial((v) => v + 1))
      .catch(() => {});
  };

  // Latido: mientras el video se ve, se renueva la sesión DRM (pantalla en uso). Devuelve false si el
  // backend ya la liberó (Detener en otra pestaña, cambio de plan, inactividad).
  const handleLatido = async () => {
    const res = await api.post('/api/stream/latido', { sesionId: reproduciendo.licencia.sesionId });
    return res.data.vigente;
  };

  // Libera la pantalla en uso (Decorator de límite) al dejar de reproducir.
  const handleStop = async () => {
    if (!user || !reproduciendo) return;
    try {
      await api.post('/api/stream/detener', {
        usuarioId: user.id,
        sesionId: reproduciendo.licencia.sesionId,
      });
    } catch (err) {
      console.error('❌ No se pudo liberar la sesión:', err);
    }
    setReproduciendo(null);
  };

  // Command (plan cambiado/deshecho desde el panel de patrones): se refleja en la sesión y en la tarjeta del plan.
  const handleUsuarioActualizado = (actualizado) => {
    const conToken = { ...actualizado, token: user?.token };
    localStorage.setItem('cineverse_user', JSON.stringify(conToken));
    setUser(conToken);
  };

  const handleLogout = () => {
    if (user && reproduciendo) {
      api
        .post('/api/stream/detener', {
          usuarioId: user.id,
          sesionId: reproduciendo.licencia.sesionId,
        })
        .catch(() => {});
    }
    localStorage.removeItem('cineverse_user');
    navigate('/login');
  };

  // Mi lista: agrega o quita un título y lo guarda en el navegador.
  const alternarLista = (id) => {
    if (!user) return;
    const nueva = alternar(lista, id);
    setLista(nueva);
    guardarLista(localStorage, user.id, nueva);
  };

  // Menú superior: cambia de pestaña y baja al contenido (el banner de arriba es alto).
  const irA = (nueva) => {
    setVista(nueva);
    setGenero('');
    requestAnimationFrame(() => {
      if (nueva === 'inicio') window.scrollTo({ top: 0, behavior: 'smooth' });
      else mainRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  // Al pulsar ▶ en una tarjeta (que está abajo), el reproductor aparece arriba: se baja/sube hasta él.
  useEffect(() => {
    if (reproduciendo || errorReproduccion) reproductorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [reproduciendo, errorReproduccion]);

  const porId = useMemo(() => new Map(titulos.map((t) => [t.id, t])), [titulos]);
  const generos = useMemo(() => generosDisponibles(titulos), [titulos]);

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
            {[
              ['inicio', 'Inicio'],
              ['series', 'Series'],
              ['peliculas', 'Películas'],
              ['lista', `Mi lista${lista.length ? ` (${lista.length})` : ''}`],
            ].map(([id, texto]) => (
              <li
                key={id}
                className={vista === id ? 'active' : ''}
                role="button"
                tabIndex={0}
                onClick={() => irA(id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') irA(id);
                }}
              >
                {texto}
              </li>
            ))}
          </ul>
        </div>

        <div className="dash-user">
          <div className="dash-user-info">
            <span className="dash-user-name">{displayName}</span>
            {user?.rol && <span className="dash-user-role">{user.rol === 'admin' ? 'Administrador' : 'Usuario'}</span>}
          </div>
          {user?.rol === 'admin' && (
            <Link to="/admin" className="btn-ghost" style={{ padding: '8px 16px' }}>
              Panel admin
            </Link>
          )}
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
          <button className="btn-ghost" onClick={() => setMostrarPatrones((v) => !v)}>
            {mostrarPatrones ? 'Ocultar validación de patrones' : '🧪 Validar patrones de comportamiento'}
          </button>
          <button className="btn-ghost" onClick={() => irA('lista')}>
            Mi lista{lista.length ? ` (${lista.length})` : ''}
          </button>
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

        {/* Validación de los patrones de comportamiento: Iterator, Mediator, Memento, Chain, Command, Observer, State y Visitor */}
        {mostrarPatrones && user && (
          <PatronesComportamiento user={user} onUsuarioActualizado={handleUsuarioActualizado} onPerfilCambiado={setPerfilRecomendado} />
        )}

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
              <li className="dash-plan-note">
                Tu perfil y tu plan ({planLabel}) son cosas distintas: el plan solo sugirió la plantilla inicial (
                {NOMBRE_CATEGORIA[categoriaSugerida(user?.planTipo)]}). El perfil se edita en «Validar patrones → Memento» y no cambia si cambias de plan.
              </li>
            </ul>
          </div>
        )}

        {/* Resultado visible del Abstract Factory (DRM) + Builder (manifiesto) */}
        <div ref={reproductorRef} className="dash-scroll-target" />
        {errorReproduccion && (
          <div className="alert-error" style={{ marginTop: '12px' }}>{errorReproduccion}</div>
        )}
        {reproduciendo && (
          <div
            className="dash-plan-card"
            style={{ marginTop: '12px', ...(reproduciendo.manifest.reproduccionReal ? { display: 'flex', width: 'min(920px, 100%)' } : {}) }}
          >
            <div className="dash-plan-info">
              <span className="dash-plan-badge">▶ Reproduciendo: {reproduciendo.titulo}</span>
            </div>
            {reproduciendo.manifest.reproduccionReal ? (
              <Reproductor
                manifest={reproduciendo.manifest}
                titulo={reproduciendo.titulo}
                onPrimeraReproduccion={handlePrimeraReproduccion}
                onLatido={handleLatido}
              />
            ) : (
              <p className="player-demo-note">
                Título de demostración: no tiene archivo de video, solo el manifiesto simulado. Prueba con «Spring» en el
                catálogo (Contenido abierto) para ver video real.
              </p>
            )}
            {episodiosSerie && (
              <div style={{ width: '100%', margin: '12px 0' }}>
                <p style={{ margin: '0 0 8px', fontWeight: 600 }}>Episodios de {episodiosSerie.serie}</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {episodiosSerie.episodios.map((ep) => {
                    const actual = ep.id === reproduciendo.reproducibleId;
                    return (
                      <button
                        key={ep.id}
                        type="button"
                        className="btn-ghost"
                        aria-current={actual ? 'true' : undefined}
                        style={{ padding: '8px 14px', ...(actual ? { outline: '2px solid var(--gold)', outlineOffset: '2px' } : {}) }}
                        onClick={() => handlePlay({ id: ep.id, title: `${episodiosSerie.serie} · ${ep.etiqueta}` })}
                      >
                        {actual ? '▶ ' : ''}{ep.etiqueta}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            <ul className="dash-plan-details">
              <li>
                Fachada (Facade): 1 sola llamada a DRMFacade.autorizarReproduccion coordinó Composite,
                Abstract Factory, Adapter, Factory Method y Decorators
              </li>
              <li>
                Licencia: {reproduciendo.licencia.licenciaId}{' '}
                <span className="tag-simulado">identificador simulado: no hay servidor de licencias real</span>
              </li>
              <li>
                Duración de la licencia: {reproduciendo.licencia.duracionMinutos} min
                {reproduciendo.licencia.venceEn && <> · vence a las {new Date(reproduciendo.licencia.venceEn).toLocaleTimeString()}</>}{' '}
                <span className="tag-real">real: el video deja de servirse cuando vence</span>
              </li>
              <li>
                Descarga offline: {reproduciendo.licencia.permiteOffline ? 'Sí' : 'No'}{' '}
                <span className="tag-real">real: depende de tu plan y de la licencia</span>
              </li>
              <li>
                Proveedor DRM (Adapter): {reproduciendo.licencia.proveedorExterno}{' '}
                <span className="tag-simulado">simulado: el video no va cifrado</span>
              </li>
              <li>
                Contenido (Composite): {TIPO_LABEL[reproduciendo.contenido.tipo]} · {reproduciendo.contenido.duracionTexto} ·{' '}
                {reproduciendo.totalManifiestos} manifiesto(s) generado(s)
              </li>
              <li>
                Pantallas en uso (Decorator): {reproduciendo.licencia.pantallasEnUso} de {reproduciendo.licencia.pantallasMaximas} ·
                Región: {reproduciendo.licencia.region} · Auditoría: {reproduciendo.licencia.auditoriaId}{' '}
                <span className="tag-real">región decidida por el servidor ({reproduciendo.licencia.regionOrigen})</span>
              </li>
              <li>Calidades disponibles: {reproduciendo.manifest.calidades.map((c) => c.resolucion).join(', ')}</li>
              <li>
                Streaming adaptativo:{' '}
                {reproduciendo.manifest.adaptativo
                  ? 'Activado'
                  : reproduciendo.manifest.calidades.length > 1
                    ? 'No (calidad manual: la eliges tú en el reproductor)'
                    : 'Desactivado'}
              </li>
              <li>Protocolo (Bridge): {reproduciendo.manifest.protocolo} · Tipo de entrega: {reproduciendo.manifest.tipoEntrega}</li>
            </ul>
            <button className="btn-ghost" style={{ alignSelf: 'flex-start' }} onClick={handleStop}>
              ■ Detener reproducción
            </button>
          </div>
        )}

        {/* Proxy de protección: la auditoría DRM solo la ve el rol admin (el backend
            además responde 403 a cualquier otro rol, aunque se llame a la API a mano). */}
        {user?.rol === 'admin' && (
          <>
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
          </>
        )}
      </header>

      <main className="dash-content" ref={mainRef}>
        {errorTitulos && <div className="alert-error">{errorTitulos}</div>}
        {!errorTitulos && titulos.length === 0 && <p className="catalog-empty">Cargando catálogo…</p>}

        {titulos.length > 0 && vista === 'inicio' && (() => {
          const acciones = { lista, onPlay: handlePlay, onLista: alternarLista };
          const continuar = vistos.map((v) => porId.get(v.id)).filter(Boolean);
          const recs = recomendados.map((r) => ({ t: porId.get(r.id), detalle: r.motivo })).filter((x) => x.t);
          const sinDetalle = (arr) => arr.map((t) => ({ t }));
          return (
            <>
              <FilaTitulos titulo="Con video real" items={sinDetalle(titulos.filter((t) => t.contenidoReal))} {...acciones} />
              <FilaTitulos titulo="Continuar viendo" items={sinDetalle([...new Set(continuar)])} {...acciones} />
              <FilaTitulos titulo="Recomendado para ti" items={recs} {...acciones} />
              <FilaTitulos titulo="Series" items={sinDetalle(filtrar(titulos, { tipos: ['serie'] }))} onVerTodo={() => irA('series')} {...acciones} />
              <FilaTitulos titulo="Películas" items={sinDetalle(filtrar(titulos, { tipos: ['pelicula'] }))} onVerTodo={() => irA('peliculas')} {...acciones} />
              <FilaTitulos titulo="Documentales" items={sinDetalle(filtrar(titulos, { tipos: ['documental'] }))} onVerTodo={() => irA('peliculas')} {...acciones} />
            </>
          );
        })()}

        {titulos.length > 0 && (vista === 'series' || vista === 'peliculas') && (
          <>
            <div className="dash-filter">
              <label>
                Filtrar por género{' '}
                <select value={genero} onChange={(e) => setGenero(e.target.value)}>
                  <option value="">Todos</option>
                  {generos.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {vista === 'series' ? (
              <CuadriculaTitulos
                titulo="Series"
                items={filtrar(titulos, { tipos: ['serie'], genero })}
                vacio="No hay series con ese género."
                lista={lista}
                onPlay={handlePlay}
                onLista={alternarLista}
              />
            ) : (
              <>
                <CuadriculaTitulos
                  titulo="Películas"
                  items={filtrar(titulos, { tipos: ['pelicula'], genero })}
                  vacio="No hay películas con ese género."
                  lista={lista}
                  onPlay={handlePlay}
                  onLista={alternarLista}
                />
                <CuadriculaTitulos
                  titulo="Documentales"
                  items={filtrar(titulos, { tipos: ['documental'], genero })}
                  vacio="No hay documentales con ese género."
                  lista={lista}
                  onPlay={handlePlay}
                  onLista={alternarLista}
                />
              </>
            )}
          </>
        )}

        {titulos.length > 0 && vista === 'lista' && (
          <CuadriculaTitulos
            titulo="Mi lista"
            items={lista.map((id) => porId.get(id)).filter(Boolean)}
            vacio="Tu lista está vacía. Pulsa el botón + de cualquier título para guardarlo aquí."
            lista={lista}
            onPlay={handlePlay}
            onLista={alternarLista}
          />
        )}
      </main>
    </div>
  );
}