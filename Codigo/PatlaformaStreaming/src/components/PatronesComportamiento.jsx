import { useCallback, useState } from 'react';
import api from '../api';
import { VERIFICACIONES } from '../patronesChecks';

// ------------------------------------------------------------------
// Panel "Validación de patrones de comportamiento" del Dashboard.
// Una pestaña por patrón (Iterator, Mediator, Memento, Chain, Command).
// Cada pestaña tiene:
//   1) una prueba INTERACTIVA que llama a los endpoints reales, y
//   2) una VERIFICACIÓN AUTOMÁTICA (patronesChecks.js) que ejecuta un
//      escenario completo y marca cada regla del patrón con ✔ / ✘.
// ------------------------------------------------------------------

const PATRONES = [
  {
    id: 'iterator',
    nombre: 'Iterator',
    donde: 'Gestión de contenido · catalog/iterator',
    idea: 'Recorre el árbol del catálogo (colección → serie → temporada → episodio) sin que el cliente conozca su estructura: de forma perezosa, paginada y en tres órdenes.',
    roles: 'Iterator: IteradorContenido · Concretos: IteradorProfundidad, IteradorAnchura, IteradorReproducibles · Aggregate: ElementoContenido.crearIterador()',
  },
  {
    id: 'mediator',
    nombre: 'Mediator',
    donde: 'Streaming adaptativo · streaming/mediator',
    idea: 'Red, calidad, buffer, play/pausa y pistas no se conocen entre sí: todos avisan a la sesión (el mediador), que concentra las reglas y decide.',
    roles: 'Mediator: SesionReproduccion · Colleagues: MonitorRed, SelectorCalidad, BufferReproduccion, ControlReproduccion, ControlPistas',
  },
  {
    id: 'memento',
    nombre: 'Memento',
    donde: 'Recomendación · recommendation/memento',
    idea: 'El perfil de recomendación guarda "fotos" inmutables de sí mismo antes de cada edición, para deshacer, rehacer o volver a una versión sin exponer su estado interno.',
    roles: 'Originator: PerfilRecomendacion · Memento: PerfilMemento · Caretaker: HistorialPerfil',
  },
  {
    id: 'chain',
    nombre: 'Chain of Responsibility',
    donde: 'Registro de usuarios · chain/',
    idea: 'La solicitud de registro recorre eslabones, cada uno con UNA regla. El primero que falla corta la cadena y devuelve su motivo.',
    roles: 'Handler: ManejadorValidacion · Concretos: CamposObligatorios → PasswordsCoinciden → PlanValido → CorreoDisponible',
  },
  {
    id: 'command',
    nombre: 'Command',
    donde: 'Suscripciones · commands/',
    idea: 'Cambiar de plan es un objeto (CambiarPlanCommand) que recuerda el plan anterior; el invocador lo guarda en el historial del usuario y puede deshacerlo.',
    roles: 'Command: Command · Concreto: CambiarPlanCommand · Invoker: CommandInvoker · Receiver: SuscripcionServicio',
  },
];

const errorDe = (e) => e.response?.data?.message || e.message || 'Error desconocido';

// ---------- piezas visuales compartidas ----------

function ListaChecks({ checks }) {
  if (!checks) return null;
  const ok = checks.filter((c) => c.ok).length;
  return (
    <div className="pc-checks">
      <p className={`pc-checks-total ${ok === checks.length ? 'pc-ok' : 'pc-fail'}`}>
        {ok === checks.length ? '✅' : '⚠️'} {ok} de {checks.length} comprobaciones correctas
      </p>
      <ul>
        {checks.map((c, i) => (
          <li key={i} className={c.ok ? 'pc-ok' : 'pc-fail'}>
            <span className="pc-check-icon">{c.ok ? '✔' : '✘'}</span>
            <span>
              {c.texto}
              {c.detalle && <small>{c.detalle}</small>}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Verificador({ checks, cargando, onVerificar }) {
  return (
    <div className="pc-verify">
      <div className="pc-verify-head">
        <button type="button" className="btn-primary pc-btn-verify" onClick={onVerificar} disabled={cargando}>
          {cargando ? 'Verificando…' : '▶ Ejecutar verificación automática'}
        </button>
        <span className="pc-hint">Corre un escenario completo contra el backend y comprueba cada regla del patrón.</span>
      </div>
      <ListaChecks checks={checks} />
    </div>
  );
}

const Boton = ({ children, ...props }) => (
  <button type="button" className="btn-ghost pc-btn" {...props}>
    {children}
  </button>
);

// ---------- ITERATOR ----------

const TIPOS_FILTRO = ['', 'coleccion', 'serie', 'temporada', 'episodio', 'pelicula', 'documental'];
const TIPOS_HOJA = ['pelicula', 'episodio', 'documental'];

function PruebaIterator() {
  const [orden, setOrden] = useState('profundidad');
  const [tipo, setTipo] = useState('');
  const [raiz, setRaiz] = useState('catalogo');
  const [pagina, setPagina] = useState(null);
  const [siguiente, setSiguiente] = useState(null);
  const [error, setError] = useState('');
  const LIMITE = 8;

  const cargar = async (desde = 0, opciones = {}) => {
    const params = { orden: opciones.orden ?? orden, limite: LIMITE, desde };
    const t = opciones.tipo ?? tipo;
    if (t) params.tipo = t;
    try {
      const { data } = await api.get(`/api/catalogo/${opciones.raiz ?? raiz}/recorrer`, { params });
      setPagina(data);
      setError('');
      setSiguiente(null);
    } catch (e) {
      setError(errorDe(e));
    }
  };

  const verSiguiente = async (id) => {
    try {
      const { data } = await api.get(`/api/catalogo/${id}/siguiente`);
      setSiguiente(data);
      setError('');
    } catch (e) {
      setError(errorDe(e));
    }
  };

  return (
    <div className="pc-interactive">
      <div className="pc-controls">
        <label>
          Recorrer desde
          <select className="pc-select" value={raiz} onChange={(e) => setRaiz(e.target.value)}>
            <option value="catalogo">Todo el catálogo</option>
            <option value="horizonte-nocturno">Serie "Horizonte Nocturno"</option>
          </select>
        </label>
        <label>
          Orden
          <select className="pc-select" value={orden} onChange={(e) => setOrden(e.target.value)}>
            <option value="profundidad">Profundidad</option>
            <option value="anchura">Anchura</option>
            <option value="reproducibles">Solo reproducibles</option>
          </select>
        </label>
        <label>
          Tipo (predicado)
          <select className="pc-select" value={tipo} onChange={(e) => setTipo(e.target.value)}>
            {TIPOS_FILTRO.map((t) => (
              <option key={t} value={t}>{t || 'Todos'}</option>
            ))}
          </select>
        </label>
        <Boton onClick={() => cargar(0)}>Recorrer</Boton>
      </div>

      {error && <div className="alert-error">{error}</div>}

      {pagina && (
        <>
          <p className="pc-hint">
            GET /api/catalogo/{pagina.raiz}/recorrer?orden={pagina.orden}&limite={LIMITE}&desde={pagina.desde} · {pagina.cantidad} elemento(s)
            {pagina.siguiente !== null ? ` · siguiente página desde=${pagina.siguiente}` : ' · última página'}
          </p>
          <ul className="pc-tree">
            {pagina.elementos.map((n) => (
              <li key={n.id} style={{ paddingLeft: `${n.nivel * 18}px` }}>
                <span className={`catalog-tag catalog-tag-${n.tipo}`}>{n.tipo}</span>
                <span className="pc-tree-title">{n.titulo}</span>
                <span className="pc-hint">nivel {n.nivel}</span>
                {TIPOS_HOJA.includes(n.tipo) && (
                  <button type="button" className="pc-link" onClick={() => verSiguiente(n.id)}>⏭ siguiente</button>
                )}
              </li>
            ))}
          </ul>
          <div className="pc-controls">
            <Boton disabled={pagina.desde === 0} onClick={() => cargar(Math.max(0, pagina.desde - LIMITE))}>← Anterior</Boton>
            <Boton disabled={pagina.siguiente === null} onClick={() => cargar(pagina.siguiente)}>Siguiente página →</Boton>
          </div>
        </>
      )}

      {siguiente && (
        <p className="pc-result">
          ⏭ Autoplay: después de <b>{siguiente.actual.titulo}</b> va{' '}
          <b>{siguiente.siguiente ? siguiente.siguiente.titulo : '— (era el último reproducible)'}</b>
        </p>
      )}
    </div>
  );
}

// ---------- MEDIATOR ----------

function PruebaMediator() {
  const [contenido, setContenido] = useState('ambar');
  const [sesion, setSesion] = useState(null); // { id, estado }
  const [eventos, setEventos] = useState([]);
  const [error, setError] = useState('');

  const anotar = (nuevos) => setEventos((prev) => [...[...nuevos].reverse(), ...prev].slice(0, 40));

  const crear = async () => {
    try {
      if (sesion) await api.delete(`/api/stream/sesion/${sesion.id}`).catch(() => {});
      const { data } = await api.post('/api/stream/sesion', { contenidoId: contenido, anchoBandaKbps: 3000 });
      setSesion({ id: data.sesionId, estado: data.estado });
      setEventos([]);
      anotar(data.eventos);
      setError('');
    } catch (e) {
      setError(errorDe(e));
    }
  };

  const hacer = async (accion, valor) => {
    if (!sesion) return;
    try {
      const { data } = await api.post(`/api/stream/sesion/${sesion.id}/accion`, { accion, valor });
      setSesion({ id: sesion.id, estado: data.estado });
      anotar(data.eventos);
      setError('');
    } catch (e) {
      setError(errorDe(e));
    }
  };

  const cerrar = async () => {
    if (!sesion) return;
    await api.delete(`/api/stream/sesion/${sesion.id}`).catch(() => {});
    setSesion(null);
  };

  const e = sesion?.estado;
  return (
    <div className="pc-interactive">
      <div className="pc-controls">
        <label>
          Contenido
          <select className="pc-select" value={contenido} onChange={(ev) => setContenido(ev.target.value)}>
            <option value="ambar">Ámbar (película)</option>
            <option value="horizonte-nocturno">Horizonte Nocturno (serie → 1.er episodio, por Iterator)</option>
          </select>
        </label>
        <Boton onClick={crear}>{sesion ? 'Reiniciar sesión' : 'Crear sesión'}</Boton>
        {sesion && <Boton onClick={cerrar}>Cerrar sesión</Boton>}
      </div>

      {error && <div className="alert-error">{error}</div>}

      {e && (
        <>
          <ul className="pc-state">
            <li><span>Contenido</span><b>{e.contenido.titulo}</b></li>
            <li><span>Reproducción</span><b>{e.reproduccion.estado}</b></li>
            <li><span>Posición</span><b>{e.reproduccion.posicionSeg}s / {e.reproduccion.duracionSeg}s</b></li>
            <li><span>Calidad</span><b>{e.calidad.actual} (techo del plan: {e.calidad.techoPlan})</b></li>
            <li><span>Red</span><b>{e.red.anchoBandaKbps} kbps</b></li>
            <li><span>Buffer</span><b>{e.buffer.segundos}s · {e.buffer.nivel}</b></li>
            <li><span>Pistas</span><b>audio {e.pistas.audio} · subt. {e.pistas.subtitulo || 'ninguno'}</b></li>
          </ul>
          <div className="pc-controls">
            <Boton onClick={() => hacer('reproducir')}>▶ Reproducir</Boton>
            <Boton onClick={() => hacer('pausar')}>⏸ Pausar</Boton>
            <Boton onClick={() => hacer('avanzar', 10)}>⏩ Avanzar 10 s</Boton>
            <Boton onClick={() => hacer('buscar', 200)}>⏭ Buscar a 200 s</Boton>
          </div>
          <div className="pc-controls">
            <span className="pc-hint">Red:</span>
            <Boton onClick={() => hacer('red', 800)}>📶 800 kbps</Boton>
            <Boton onClick={() => hacer('red', 3000)}>📶 3 000 kbps</Boton>
            <Boton onClick={() => hacer('red', 20000)}>📶 20 000 kbps</Boton>
            <span className="pc-hint">Pistas:</span>
            <Boton onClick={() => hacer('audio', 'en')}>🔊 Audio EN</Boton>
            <Boton onClick={() => hacer('audio', 'es')}>🔊 Audio ES</Boton>
            <Boton onClick={() => hacer('subtitulo', 'es')}>💬 Subt. ES</Boton>
          </div>
        </>
      )}

      {eventos.length > 0 && (
        <div className="pc-log">
          <p className="pc-hint">Eventos que el mediador procesó (el más reciente primero):</p>
          <ul>
            {eventos.map((ev) => (
              <li key={ev.n}>
                <span className="pc-log-n">#{ev.n}</span>
                <span className="pc-log-origen">{ev.origen}</span> →{' '}
                <b>{ev.evento}</b>
                {ev.datos && Object.keys(ev.datos).length > 0 && <small> {JSON.stringify(ev.datos)}</small>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ---------- MEMENTO ----------

function PruebaMemento() {
  const [vista, setVista] = useState(null); // { perfil, historial, puedeDeshacer, puedeRehacer }
  const [peso, setPeso] = useState(0.5);
  const [genero, setGenero] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');

  const aplicar = (data, texto) => {
    setVista(data);
    setPeso(data.perfil.pesoHistorial);
    setMensaje(texto || '');
    setError('');
  };

  const cargar = async () => {
    try {
      aplicar((await api.get('/api/recomendaciones/mi-perfil')).data, 'Perfil cargado.');
    } catch (e) {
      setVista(null);
      setError(e.response?.status === 404 ? 'Aún no tienes perfil: crea uno desde una plantilla.' : errorDe(e));
    }
  };

  const ejecutar = async (peticion, texto) => {
    try {
      const { data } = await peticion();
      aplicar(data, data.sinCambios ? 'Sin cambios: no se guardó ninguna versión.' : texto);
    } catch (e) {
      setError(errorDe(e));
    }
  };

  const PERFIL = '/api/recomendaciones/mi-perfil';
  return (
    <div className="pc-interactive">
      <div className="pc-controls">
        <Boton onClick={cargar}>Ver mi perfil</Boton>
        {!vista && (
          <>
            <Boton onClick={() => ejecutar(() => api.put(PERFIL, { categoriaBase: 'familiar' }), 'Perfil creado desde la plantilla "familiar".')}>Crear (familiar)</Boton>
            <Boton onClick={() => ejecutar(() => api.put(PERFIL, { categoriaBase: 'documental' }), 'Perfil creado desde la plantilla "documental".')}>Crear (documental)</Boton>
          </>
        )}
      </div>
      {error && <div className="alert-error">{error}</div>}
      {mensaje && <p className="pc-result">{mensaje}</p>}

      {vista && (
        <>
          <ul className="pc-state">
            <li><span>Perfil</span><b>{vista.perfil.nombre}</b></li>
            <li><span>Géneros favoritos</span><b>{vista.perfil.generosFavoritos.join(', ')}</b></li>
            <li><span>Tipo preferido</span><b>{vista.perfil.tipoContenidoPreferido}</b></li>
            <li><span>Peso del historial</span><b>{vista.perfil.pesoHistorial}</b></li>
          </ul>

          <div className="pc-controls">
            <label>
              Peso del historial: {Number(peso).toFixed(1)}
              <input type="range" min="0" max="1" step="0.1" value={peso} onChange={(e) => setPeso(Number(e.target.value))} />
            </label>
            <Boton onClick={() => ejecutar(() => api.put(PERFIL, { pesoHistorial: peso }), 'Peso actualizado (se guardó una versión antes de cambiar).')}>Aplicar peso</Boton>
            <input className="pc-input" placeholder="Añadir género (ej. terror)" value={genero} onChange={(e) => setGenero(e.target.value)} />
            <Boton disabled={!genero.trim()} onClick={() => { ejecutar(() => api.put(PERFIL, { generosAdicionales: [genero.trim()] }), 'Género añadido.'); setGenero(''); }}>Añadir</Boton>
          </div>

          <div className="pc-controls">
            <Boton disabled={!vista.puedeDeshacer} onClick={() => ejecutar(() => api.post(`${PERFIL}/deshacer`), 'Cambio deshecho.')}>↩ Deshacer</Boton>
            <Boton disabled={!vista.puedeRehacer} onClick={() => ejecutar(() => api.post(`${PERFIL}/rehacer`), 'Cambio rehecho.')}>↪ Rehacer</Boton>
            <Boton onClick={() => ejecutar(() => api.put(PERFIL, { pesoHistorial: 9 }), '')}>Probar edición inválida (peso 9)</Boton>
          </div>

          <div className="pc-log">
            <p className="pc-hint">Versiones guardadas por el cuidador (HistorialPerfil): {vista.historial.length}</p>
            {vista.historial.length === 0 ? (
              <p className="pc-hint">Aún no hay versiones: edita el perfil para que se guarde la primera.</p>
            ) : (
              <ul>
                {vista.historial.map((v) => (
                  <li key={v.version}>
                    <span className="pc-log-n">v{v.version}</span> {v.etiqueta}
                    <small> · {new Date(v.fecha).toLocaleTimeString()}</small>
                    <button type="button" className="pc-link" onClick={() => ejecutar(() => api.post(`${PERFIL}/restaurar`, { version: v.version }), `Se volvió a la versión ${v.version}.`)}>
                      restaurar
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ---------- CHAIN ----------

const NOMBRES_ESLABON = {
  CamposObligatoriosHandler: 'Campos obligatorios',
  PasswordsCoincidenHandler: 'Contraseñas coinciden',
  PlanValidoHandler: 'Plan válido (Factory)',
  CorreoDisponibleHandler: 'Correo disponible (BD)',
};

function PruebaChain({ user }) {
  const [form, setForm] = useState({ username: 'Ana Pruebas', email: 'ana.pruebas@ejemplo.com', password: 'clave123', confirmPassword: 'clave123', tipoPlan: 'free' });
  const [resultado, setResultado] = useState(null);
  const [error, setError] = useState('');

  const cambiar = (campo) => (e) => setForm((f) => ({ ...f, [campo]: e.target.value }));
  const preset = (cambios) => setForm((f) => ({ ...f, ...cambios }));

  const validar = async () => {
    try {
      const { data } = await api.post('/api/validar-registro', form);
      setResultado(data);
      setError('');
    } catch (e) {
      setError(errorDe(e));
    }
  };

  return (
    <div className="pc-interactive">
      <p className="pc-hint">Valida con la MISMA cadena que el registro, pero sin crear ningún usuario.</p>
      <div className="pc-form">
        <input className="pc-input" placeholder="Nombre" value={form.username} onChange={cambiar('username')} />
        <input className="pc-input" placeholder="Correo" value={form.email} onChange={cambiar('email')} />
        <input className="pc-input" type="text" placeholder="Contraseña" value={form.password} onChange={cambiar('password')} />
        <input className="pc-input" type="text" placeholder="Confirmar contraseña" value={form.confirmPassword} onChange={cambiar('confirmPassword')} />
        <input className="pc-input" placeholder="Plan (free, basico, premium, familiar)" value={form.tipoPlan} onChange={cambiar('tipoPlan')} />
      </div>
      <div className="pc-controls">
        <span className="pc-hint">Ejemplos:</span>
        <Boton onClick={() => preset({ username: '' })}>Sin nombre</Boton>
        <Boton onClick={() => preset({ username: 'Ana Pruebas', confirmPassword: 'otra' })}>Contraseñas distintas</Boton>
        <Boton onClick={() => preset({ confirmPassword: form.password, tipoPlan: 'platino' })}>Plan inexistente</Boton>
        <Boton onClick={() => preset({ tipoPlan: 'free', confirmPassword: form.password, email: user?.correo || 'ya@registrado.com' })}>Correo ya registrado</Boton>
        <Boton onClick={() => preset({ tipoPlan: 'free', confirmPassword: form.password, email: `ana.${Date.now()}@ejemplo.com` })}>Todo válido</Boton>
      </div>
      <div className="pc-controls">
        <button type="button" className="btn-primary pc-btn-verify" onClick={validar}>Validar solicitud</button>
      </div>

      {error && <div className="alert-error">{error}</div>}

      {resultado && (
        <>
          <div className="pc-chain">
            {resultado.eslabones.map((e, i) => (
              <div key={e.regla} className="pc-chain-wrap">
                {i > 0 && <span className="pc-chain-arrow">→</span>}
                <div className={`pc-link-box pc-link-${e.resultado}`}>
                  <b>{i + 1}. {NOMBRES_ESLABON[e.regla] || e.regla}</b>
                  <span>{e.resultado === 'OK' ? '✔ aprueba' : e.resultado === 'RECHAZADA' ? '✘ rechaza' : '— no se ejecutó'}</span>
                </div>
              </div>
            ))}
          </div>
          <p className={`pc-result ${resultado.valido ? 'pc-ok' : 'pc-fail'}`}>
            {resultado.valido ? '✅ La solicitud es válida: el registro continuaría.' : `⛔ ${resultado.message} (HTTP ${resultado.status})`}
          </p>
        </>
      )}
    </div>
  );
}

// ---------- COMMAND ----------

function PruebaCommand({ user, onUsuarioActualizado }) {
  const [planes, setPlanes] = useState([]);
  const [historial, setHistorial] = useState(null);
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');
  const HIST = `/api/usuarios/${user.id}/plan/historial`;

  const cargar = useCallback(async () => {
    try {
      const [p, h] = await Promise.all([api.get('/api/planes'), api.get(HIST)]);
      setPlanes(p.data.planes);
      setHistorial(h.data.historial);
      setError('');
    } catch (e) {
      setError(errorDe(e));
    }
  }, [HIST]);

  const cambiar = async (tipoPlan) => {
    try {
      const { data } = await api.put(`/api/usuarios/${user.id}/plan`, { tipoPlan });
      onUsuarioActualizado(data.user);
      setMensaje(`Comando ejecutado: plan → ${tipoPlan}.`);
      await cargar();
    } catch (e) {
      setError(errorDe(e));
    }
  };

  const deshacer = async () => {
    try {
      const { data } = await api.post(`/api/usuarios/${user.id}/plan/deshacer`);
      onUsuarioActualizado(data.user);
      setMensaje(`Command.undo(): el plan volvió a "${data.user.planTipo}".`);
      await cargar();
    } catch (e) {
      setError(errorDe(e));
    }
  };

  return (
    <div className="pc-interactive">
      <p className="pc-hint">Plan actual: <b>{user.planTipo}</b>. Estos botones cambian tu plan de verdad (y se puede deshacer).</p>
      <div className="pc-controls">
        <Boton onClick={cargar}>Ver historial</Boton>
        {planes.map((p) => (
          <Boton key={p.tipo} disabled={p.tipo === user.planTipo} onClick={() => cambiar(p.tipo)}>→ {p.tipo}</Boton>
        ))}
        <Boton disabled={!historial || historial.length === 0} onClick={deshacer}>↩ Deshacer último cambio</Boton>
      </div>
      {error && <div className="alert-error">{error}</div>}
      {mensaje && <p className="pc-result">{mensaje}</p>}
      {historial && (
        <div className="pc-log">
          <p className="pc-hint">Historial del invocador (más antiguo primero): {historial.length} comando(s)</p>
          {historial.length === 0 ? (
            <p className="pc-hint">Vacío: cambia de plan para que se guarde un comando.</p>
          ) : (
            <ul>
              {historial.map((d, i) => (
                <li key={i}><span className="pc-log-n">#{i + 1}</span> {d}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

// ---------- panel principal ----------

export default function PatronesComportamiento({ user, onUsuarioActualizado }) {
  const [activo, setActivo] = useState('iterator');
  const [resultados, setResultados] = useState({}); // id -> checks[]
  const [ejecutando, setEjecutando] = useState({}); // id -> boolean

  const verificar = async (id) => {
    setEjecutando((e) => ({ ...e, [id]: true }));
    const checks = await VERIFICACIONES[id]({ user, onUsuarioActualizado });
    setResultados((r) => ({ ...r, [id]: checks }));
    setEjecutando((e) => ({ ...e, [id]: false }));
  };

  const verificarTodos = async () => {
    for (const p of PATRONES) await verificar(p.id); // en serie: Memento y Command tocan datos del usuario
  };

  const patron = PATRONES.find((p) => p.id === activo);
  const hayResultados = Object.keys(resultados).length > 0;
  const algunoEjecutando = Object.values(ejecutando).some(Boolean);

  return (
    <div className="pc-panel">
      <div className="pc-head">
        <span className="dash-plan-badge">Patrones de comportamiento</span>
        <button type="button" className="btn-primary pc-btn-verify" onClick={verificarTodos} disabled={algunoEjecutando}>
          {algunoEjecutando ? 'Verificando…' : '▶ Verificar los 5 patrones'}
        </button>
      </div>

      <div className="pc-tabs" role="tablist">
        {PATRONES.map((p) => {
          const checks = resultados[p.id];
          const todoOk = checks && checks.every((c) => c.ok);
          return (
            <button
              key={p.id}
              type="button"
              role="tab"
              aria-selected={activo === p.id}
              className={`pc-tab ${activo === p.id ? 'pc-tab-active' : ''}`}
              onClick={() => setActivo(p.id)}
            >
              {p.nombre.split(' ')[0]}
              {checks && (
                <span className={`pc-tab-badge ${todoOk ? 'pc-ok' : 'pc-fail'}`}>
                  {todoOk ? '✔' : '✘'} {checks.filter((c) => c.ok).length}/{checks.length}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {hayResultados && (
        <p className="pc-hint pc-summary">
          Resumen: {PATRONES.filter((p) => resultados[p.id]).map((p) => `${p.nombre.split(' ')[0]} ${resultados[p.id].filter((c) => c.ok).length}/${resultados[p.id].length}`).join(' · ')}
        </p>
      )}

      <div className="pc-body" role="tabpanel">
        <h3 className="pc-title">{patron.nombre}</h3>
        <p className="pc-where">{patron.donde}</p>
        <p className="pc-idea">{patron.idea}</p>
        <p className="pc-roles">{patron.roles}</p>

        {activo === 'iterator' && <PruebaIterator />}
        {activo === 'mediator' && <PruebaMediator />}
        {activo === 'memento' && <PruebaMemento />}
        {activo === 'chain' && <PruebaChain user={user} />}
        {activo === 'command' && <PruebaCommand user={user} onUsuarioActualizado={onUsuarioActualizado} />}

        <Verificador checks={resultados[activo]} cargando={Boolean(ejecutando[activo])} onVerificar={() => verificar(activo)} />
      </div>
    </div>
  );
}
