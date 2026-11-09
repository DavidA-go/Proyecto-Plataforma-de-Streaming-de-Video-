import api from './api';

/**
 * patronesChecks.js
 * ------------------------------------------------------------------
 * Verificaciones AUTOMÁTICAS de los patrones de comportamiento, hechas
 * contra el backend real (los mismos endpoints que usa la app).
 * Cada función devuelve una lista de comprobaciones:
 *   { ok: boolean, texto: string, detalle: string }
 * y NUNCA lanza: si algo falla (red, 500…) lo devuelve como una
 * comprobación fallida para que el Dashboard lo muestre.
 *
 * Las que modifican datos (Memento, Command) dejan todo como estaba.
 * ------------------------------------------------------------------
 */

const nuevoColector = () => {
  const lista = [];
  const chk = (texto, cond, detalle = '') => lista.push({ ok: Boolean(cond), texto, detalle });
  return [lista, chk];
};

const get = (url, config) => api.get(url, config).then((r) => r.data);
const estadoHttp = async (fn) => {
  try {
    await fn();
    return 200;
  } catch (e) {
    return e.response?.status ?? 0;
  }
};
const mensajeDe = (e) => e.response?.data?.message || e.message || 'error desconocido';

// Ejecuta el escenario y convierte cualquier excepción en una comprobación fallida.
const protegido = (titulo, escenario) => async (ctx) => {
  const [lista, chk] = nuevoColector();
  try {
    await escenario(chk, ctx);
  } catch (e) {
    chk(`${titulo}: el escenario terminó sin errores`, false, mensajeDe(e));
  }
  return lista;
};

// ------------------------------------------------------------------
// ITERATOR
// ------------------------------------------------------------------
const recorrerTodo = async (orden, extra = {}) => {
  const todos = [];
  let desde = 0;
  while (desde !== null) {
    const p = await get('/api/catalogo/catalogo/recorrer', { params: { orden, limite: 100, desde, ...extra } });
    todos.push(...p.elementos);
    desde = p.siguiente;
  }
  return todos;
};

export const verificarIterator = protegido('Iterator', async (chk) => {
  const [prof, anch, repro] = [await recorrerTodo('profundidad'), await recorrerTodo('anchura'), await recorrerTodo('reproducibles')];
  const idsProf = prof.map((n) => n.id);
  const idsAnch = anch.map((n) => n.id);

  chk(
    'Profundidad y anchura visitan exactamente los mismos nodos (solo cambia el orden)',
    idsProf.length === idsAnch.length && JSON.stringify([...idsProf].sort()) === JSON.stringify([...idsAnch].sort()),
    `${idsProf.length} nodos en cada recorrido`
  );
  chk('Los nodos se visitan una sola vez (sin repetidos)', new Set(idsProf).size === idsProf.length, `${new Set(idsProf).size} ids únicos`);

  const a = await get('/api/catalogo/horizonte-nocturno/recorrer', { params: { orden: 'profundidad', limite: 3 } });
  const b = await get('/api/catalogo/horizonte-nocturno/recorrer', { params: { orden: 'anchura', limite: 3 } });
  chk('Profundidad baja por una rama: serie → temporada 1 → episodio 1', a.elementos.map((e) => e.id).join(' → ') === 'horizonte-nocturno → horizonte-nocturno-t1 → horizonte-nocturno-t1-e1', a.elementos.map((e) => e.id).join(' → '));
  chk('Anchura va por niveles: serie → temporada 1 → temporada 2', b.elementos.map((e) => e.id).join(' → ') === 'horizonte-nocturno → horizonte-nocturno-t1 → horizonte-nocturno-t2', b.elementos.map((e) => e.id).join(' → '));
  chk('Cada nodo trae su nivel en el árbol (raíz = 0)', a.elementos.map((e) => e.nivel).join(',') === '0,1,2', `niveles ${a.elementos.map((e) => e.nivel).join(',')}`);

  const juntas = [];
  let desde = 0;
  let paginas = 0;
  while (desde !== null) {
    const p = await get('/api/catalogo/catalogo/recorrer', { params: { orden: 'profundidad', limite: 7, desde } });
    juntas.push(...p.elementos.map((e) => e.id));
    desde = p.siguiente;
    paginas++;
  }
  chk('Paginación: las páginas juntas == el recorrido completo, sin huecos ni repetidos', JSON.stringify(juntas) === JSON.stringify(idsProf), `${paginas} páginas de 7`);

  const tiposGrupo = ['coleccion', 'serie', 'temporada'];
  chk('Orden "reproducibles": solo hojas (películas, episodios, documentales)', repro.length > 0 && repro.every((n) => !tiposGrupo.includes(n.tipo)), `${repro.length} reproducibles`);

  const pelis = await recorrerTodo('reproducibles', { tipo: 'pelicula' });
  chk('Filtro por tipo (predicado): solo películas', pelis.length > 0 && pelis.every((n) => n.tipo === 'pelicula'), `${pelis.length} películas`);

  const sig = await get('/api/catalogo/horizonte-nocturno-t1-e4/siguiente');
  chk('Siguiente episodio: pasa de la temporada 1 a la 2', sig.siguiente?.id === 'horizonte-nocturno-t2-e1', `${sig.actual.id} → ${sig.siguiente?.id}`);
  const ultimo = repro.at(-1);
  const fin = await get(`/api/catalogo/${ultimo.id}/siguiente`);
  chk('El último reproducible del catálogo no tiene siguiente', fin.siguiente === null, ultimo.id);

  chk('Nodo inexistente → 404', (await estadoHttp(() => get('/api/catalogo/no-existe/recorrer'))) === 404);
  chk('Orden inválido → 400', (await estadoHttp(() => get('/api/catalogo/catalogo/recorrer', { params: { orden: 'zigzag' } }))) === 400);
});

// ------------------------------------------------------------------
// MEDIATOR
// ------------------------------------------------------------------
export const verificarMediator = protegido('Mediator', async (chk) => {
  const accion = (id, a, valor) => api.post(`/api/stream/sesion/${id}/accion`, { accion: a, valor }).then((r) => r.data);
  const nombres = (r) => r.eventos.map((e) => e.evento);

  const crear = await api.post('/api/stream/sesion', { contenidoId: 'ambar', anchoBandaKbps: 50000 });
  const id = crear.data.sesionId;
  const e0 = crear.data.estado;
  chk('La sesión se crea (201) con el techo de calidad del plan del usuario', crear.status === 201 && Boolean(e0.calidad.techoPlan), `plan → techo ${e0.calidad.techoPlan}`);
  chk('Con red de sobra, el Selector de calidad elige el techo del plan', e0.calidad.actual === e0.calidad.techoPlan, `calidad ${e0.calidad.actual}`);

  try {
    const play = await accion(id, 'reproducir');
    chk('Reproducir con buffer vacío → el mediador deja la sesión en "cargando"', play.estado.reproduccion.estado === 'cargando', `estado ${play.estado.reproduccion.estado}`);

    const t = await accion(id, 'avanzar', 10);
    chk('Al avanzar el tiempo llega BUFFER_RECUPERADO y el mediador reanuda solo', nombres(t).includes('BUFFER_RECUPERADO') && t.estado.reproduccion.estado === 'reproduciendo', `eventos: ${nombres(t).join(', ')}`);

    const red = await accion(id, 'red', 1000);
    chk('Red empeora (1000 kbps) → el mediador baja la calidad al instante', red.estado.calidad.actual === '360p' && nombres(red).includes('RED_CAMBIO') && nombres(red).includes('CALIDAD_CAMBIO'), `${nombres(red).join(' → ')} · ${red.estado.calidad.actual}`);

    const seek = await accion(id, 'buscar', 200);
    chk('Buscar mueve la posición, vacía el buffer y arranca en la calidad más baja', seek.estado.reproduccion.posicionSeg === 200 && seek.estado.buffer.segundos === 0 && seek.estado.calidad.actual === '360p', `pos ${seek.estado.reproduccion.posicionSeg}s · buffer ${seek.estado.buffer.segundos}s · ${seek.estado.calidad.actual}`);

    const sube = await accion(id, 'red', 50000);
    chk('Red mejora con buffer bajo → subida POSPUESTA (no sube hasta tener ≥ 10 s)', nombres(sube).includes('SUBIDA_POSPUESTA') && sube.estado.calidad.actual === '360p', `${nombres(sube).join(', ')} · sigue en ${sube.estado.calidad.actual}`);

    const luego = await accion(id, 'avanzar', 20);
    chk('Con buffer suficiente sube de a UN escalón (no salta al techo de golpe)', luego.estado.calidad.actual !== '360p' && nombres(luego).includes('CALIDAD_CAMBIO'), `${nombres(luego).join(', ')} · ahora ${luego.estado.calidad.actual}`);

    const audio = await accion(id, 'audio', 'en');
    chk('Cambiar el audio genera PISTA_CAMBIO y el mediador recorta el buffer ya descargado', nombres(audio).includes('PISTA_CAMBIO') && audio.estado.buffer.segundos <= 6, `buffer ${audio.estado.buffer.segundos}s`);

    chk('Acción inválida → 400', (await estadoHttp(() => accion(id, 'volar'))) === 400);
    chk('Red inválida (-1 kbps) → 400', (await estadoHttp(() => accion(id, 'red', -1))) === 400);
  } finally {
    await api.delete(`/api/stream/sesion/${id}`).catch(() => {});
  }
  chk('Cerrar la sesión la elimina (después responde 404)', (await estadoHttp(() => get(`/api/stream/sesion/${id}`))) === 404);

  const serie = await api.post('/api/stream/sesion', { contenidoId: 'horizonte-nocturno' });
  chk('Mediator + Iterator: pedir una serie reproduce su primer episodio', serie.data.estado.contenido.id === 'horizonte-nocturno-t1-e1', serie.data.estado.contenido.id);
  await api.delete(`/api/stream/sesion/${serie.data.sesionId}`).catch(() => {});
});

// ------------------------------------------------------------------
// MEMENTO
// ------------------------------------------------------------------
export const verificarMemento = protegido('Memento', async (chk) => {
  const PERFIL = '/api/recomendaciones/mi-perfil';
  const actual = async () => {
    try {
      return await get(PERFIL);
    } catch (e) {
      if (e.response?.status === 404) return null;
      throw e;
    }
  };

  let vista = await actual();
  if (!vista) {
    vista = (await api.put(PERFIL, { categoriaBase: 'familiar' })).data;
    chk('Sin perfil previo: se crea clonando la plantilla (Prototype) y no hay nada que deshacer', vista.historial.length === 0 && vista.puedeDeshacer === false, `perfil "${vista.perfil.nombre}"`);
  }
  const p0 = vista.perfil.pesoHistorial;
  const p1 = p0 === 0.9 ? 0.7 : 0.9;
  const v0 = vista.historial.length;

  const mod = (await api.put(PERFIL, { pesoHistorial: p1 })).data;
  chk('Editar el perfil guarda un memento ANTES de cambiar (+1 versión)', mod.perfil.pesoHistorial === p1 && mod.historial.length === v0 + 1, `peso ${p0} → ${p1} · ${mod.historial.length} versión(es)`);

  const igual = (await api.put(PERFIL, { pesoHistorial: p1 })).data;
  chk('Un cambio que no cambia nada no ensucia el historial', igual.sinCambios === true && igual.historial.length === v0 + 1, `siguen ${igual.historial.length} versión(es)`);

  const status = await estadoHttp(() => api.put(PERFIL, { pesoHistorial: 3 }));
  const tras = await get(PERFIL);
  chk('Edición inválida (peso 3) → 400 y el perfil queda como estaba (rollback con el memento)', status === 400 && tras.perfil.pesoHistorial === p1 && tras.historial.length === v0 + 1, `peso sigue en ${tras.perfil.pesoHistorial}`);

  const und = (await api.post(`${PERFIL}/deshacer`)).data;
  chk('Deshacer restaura el estado anterior y habilita rehacer', und.perfil.pesoHistorial === p0 && und.puedeRehacer === true, `peso vuelve a ${und.perfil.pesoHistorial}`);

  const red = (await api.post(`${PERFIL}/rehacer`)).data;
  chk('Rehacer vuelve a aplicar el cambio', red.perfil.pesoHistorial === p1, `peso ${red.perfil.pesoHistorial}`);

  const rest = (await api.post(`${PERFIL}/restaurar`, { version: v0 + 1 })).data;
  chk('Volver a una versión concreta del historial (y esa restauración también se guarda)', rest.perfil.pesoHistorial === p0 && rest.historial.length >= v0 + 1, `versión ${v0 + 1} → peso ${rest.perfil.pesoHistorial}`);

  chk('Versión inexistente → 404', (await estadoHttp(() => api.post(`${PERFIL}/restaurar`, { version: 999 }))) === 404);

  // Deja el perfil como lo encontró.
  const fin = await get(PERFIL);
  if (fin.perfil.pesoHistorial !== p0) await api.put(PERFIL, { pesoHistorial: p0 });
});

// ------------------------------------------------------------------
// CHAIN OF RESPONSIBILITY
// ------------------------------------------------------------------
export const verificarChain = protegido('Chain', async (chk, { user }) => {
  const base = {
    username: 'Verificación Chain',
    email: `verificacion.${Date.now()}@ejemplo.com`,
    password: 'clave123',
    confirmPassword: 'clave123',
    tipoPlan: 'free',
  };
  const validar = (cambios) => api.post('/api/validar-registro', { ...base, ...cambios }).then((r) => r.data);
  const resumen = (r) => r.eslabones.map((e) => `${e.regla.replace('Handler', '')}:${e.resultado}`).join(' · ');
  const esperado = (r, ...estados) => r.eslabones.map((e) => e.resultado).join(',') === estados.join(',');

  const r1 = await validar({ username: '' });
  chk('Falta el nombre → rechaza el 1.er eslabón y los demás ni se ejecutan', r1.regla === 'CamposObligatoriosHandler' && esperado(r1, 'RECHAZADA', 'OMITIDA', 'OMITIDA', 'OMITIDA'), resumen(r1));

  const r2 = await validar({ confirmPassword: 'otra' });
  chk('Contraseñas distintas → corta en el 2.º eslabón', r2.regla === 'PasswordsCoincidenHandler' && esperado(r2, 'OK', 'RECHAZADA', 'OMITIDA', 'OMITIDA'), resumen(r2));

  const r3 = await validar({ tipoPlan: 'platino' });
  chk('Plan inexistente (Factory Method) → corta en el 3.er eslabón', r3.regla === 'PlanValidoHandler' && esperado(r3, 'OK', 'OK', 'RECHAZADA', 'OMITIDA'), resumen(r3));

  const r4 = await validar({ email: user.correo });
  chk('Correo ya registrado → llega hasta el último eslabón (el único que consulta la BD)', r4.regla === 'CorreoDisponibleHandler' && esperado(r4, 'OK', 'OK', 'OK', 'RECHAZADA'), resumen(r4));

  const r5 = await validar({});
  chk('Solicitud válida → los 4 eslabones aprueban', r5.valido === true && esperado(r5, 'OK', 'OK', 'OK', 'OK'), resumen(r5));

  chk('Cada rechazo trae su mensaje y su código HTTP', [r1, r2, r3, r4].every((r) => r.message && r.status === 400), [r1, r2, r3, r4].map((r) => r.message).join(' | '));
});

// ------------------------------------------------------------------
// COMMAND
// ------------------------------------------------------------------
export const verificarCommand = protegido('Command', async (chk, { user, onUsuarioActualizado }) => {
  const HIST = `/api/usuarios/${user.id}/plan/historial`;
  const { planes } = await get('/api/planes');
  const original = user.planTipo;
  const destino = planes.map((p) => p.tipo).find((t) => t !== original);
  const h0 = (await get(HIST)).historial.length;

  const cambio = await api.put(`/api/usuarios/${user.id}/plan`, { tipoPlan: destino });
  const ultimo = cambio.data.user;
  const h1 = (await get(HIST)).historial;
  chk('Cambiar de plan se ejecuta como un comando y queda en el historial', ultimo.planTipo === destino && h1.length === h0 + 1, `${original} → ${destino}`);
  chk('El comando guardó el estado anterior (lo que hace posible el undo)', h1.at(-1)?.includes(`${original} -> ${destino}`), h1.at(-1));

  const inv = await estadoHttp(() => api.put(`/api/usuarios/${user.id}/plan`, { tipoPlan: 'platino' }));
  const h2 = (await get(HIST)).historial;
  chk('Un comando que falla (plan inexistente → 400) NO entra al historial', inv === 400 && h2.length === h0 + 1, `historial sigue en ${h2.length}`);

  const und = await api.post(`/api/usuarios/${user.id}/plan/deshacer`);
  const final = und.data.user;
  const h3 = (await get(HIST)).historial;
  chk('Deshacer (Command.undo) devuelve el plan original', final.planTipo === original && h3.length === h0, `plan vuelve a ${final.planTipo}`);

  if (h0 === 0) {
    const vacio = await estadoHttp(() => api.post(`/api/usuarios/${user.id}/plan/deshacer`));
    chk('Sin historial no hay nada que deshacer → 400', vacio === 400);
  }

  onUsuarioActualizado?.(final);
});

export const VERIFICACIONES = {
  iterator: verificarIterator,
  mediator: verificarMediator,
  memento: verificarMemento,
  chain: verificarChain,
  command: verificarCommand,
};
