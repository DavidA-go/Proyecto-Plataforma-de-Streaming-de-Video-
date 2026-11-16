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
 * Las que modifican datos (Memento, Command, Observer) dejan todo como estaba.
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

// ------------------------------------------------------------------
// OBSERVER (suscripciones → DRM, Streaming, notificaciones)
// Cambia el plan del usuario y lo deja como estaba (deshace cada cambio).
// ------------------------------------------------------------------
export const verificarObserver = protegido('Observer', async (chk, { user, onUsuarioActualizado }) => {
  const EV = `/api/usuarios/${user.id}/plan/eventos`;
  const original = user.planTipo;
  const cambiar = (tipoPlan) => api.put(`/api/usuarios/${user.id}/plan`, { tipoPlan }).then((r) => r.data);
  // "detener" con una sesión inexistente no libera nada: solo informa cuántas pantallas hay en uso.
  const pantallasEnUso = () => api.post('/api/stream/detener', { sesionId: 'SES-verificacion' }).then((r) => r.data.pantallasEnUso);

  const inicial = await get(EV);
  chk(
    'Hay 3 observadores suscritos al sujeto (DRM, Streaming y notificación)',
    ['ObservadorPlanDRM', 'ObservadorPlanStreaming', 'ObservadorNotificacion'].every((n) => inicial.observadores.includes(n)),
    inicial.observadores.join(', ')
  );

  let cambios = 0;
  const sesionesDRM = [];
  let sesionStreaming = null;
  try {
    if (original !== 'familiar') {
      await cambiar('familiar'); // 4 pantallas y techo 1080p
      cambios++;
    }
    for (const dispositivoId of ['verificacion-a', 'verificacion-b']) {
      const lic = await api.post('/api/stream/autorizar', { contenidoId: 'ambar', dispositivoId, pais: 'CO' });
      sesionesDRM.push(lic.data.licencia.sesionId);
    }
    const antes = await pantallasEnUso();
    const ses = await api.post('/api/stream/sesion', { contenidoId: 'ambar', anchoBandaKbps: 50000 });
    sesionStreaming = ses.data.sesionId;
    chk('Punto de partida: ≥ 2 pantallas DRM abiertas y una sesión de streaming en 1080p', antes >= 2 && ses.data.estado.calidad.actual === '1080p', `${antes} pantalla(s) · ${ses.data.estado.calidad.actual}`);

    const n0 = (await get(EV)).eventos.length;
    await cambiar('free');
    cambios++;
    const { eventos } = await get(EV);
    const ultimo = eventos.at(-1);
    chk('Un solo cambio de plan genera UN evento PLAN_CAMBIADO (familiar → free)', eventos.length === n0 + 1 && ultimo?.tipo === 'PLAN_CAMBIADO' && ultimo.planAnterior === 'familiar' && ultimo.planNuevo === 'free', `${ultimo?.planAnterior} → ${ultimo?.planNuevo}`);
    chk('Los 3 observadores recibieron el evento y terminaron OK', ultimo.traza.length === 3 && ultimo.traza.every((t) => t.estado === 'OK'), ultimo.traza.map((t) => `${t.observador.replace('Observador', '')}:${t.estado}`).join(' · '));

    const despues = await pantallasEnUso();
    chk('DRM reaccionó: se liberaron las pantallas que el plan free ya no permite (queda 1)', despues === 1 && despues < antes, `${antes} → ${despues} pantalla(s)`);

    const e = (await get(`/api/stream/sesion/${sesionStreaming}`)).estado;
    chk('Streaming reaccionó: la sesión abierta bajó a 480p (techo y calidad)', e.calidad.techoPlan === '480p' && e.calidad.actual === '480p', `techo ${e.calidad.techoPlan} · calidad ${e.calidad.actual}`);
    chk('La notificación al usuario quedó en la traza', /Aviso enviado/.test(ultimo.traza[2]?.detalle ?? ''), ultimo.traza[2]?.detalle);

    const invalido = await estadoHttp(() => cambiar('platino'));
    chk('Un cambio inválido (plan inexistente → 400) no notifica a nadie', invalido === 400 && (await get(EV)).eventos.length === n0 + 1);
  } finally {
    for (const id of sesionesDRM) await api.post('/api/stream/detener', { sesionId: id }).catch(() => {});
    if (sesionStreaming) await api.delete(`/api/stream/sesion/${sesionStreaming}`).catch(() => {});
    let final = null;
    for (let i = 0; i < cambios; i++) final = (await api.post(`/api/usuarios/${user.id}/plan/deshacer`)).data.user; // vuelve al plan original (también notifica)
    if (final) onUsuarioActualizado?.(final);
  }
});

// ------------------------------------------------------------------
// STATE (streaming adaptativo: estado del reproductor)
// ------------------------------------------------------------------
export const verificarState = protegido('State', async (chk) => {
  const crear = await api.post('/api/stream/sesion', { contenidoId: 'ambar', anchoBandaKbps: 50000 });
  const id = crear.data.sesionId;
  const accion = (a, valor) => api.post(`/api/stream/sesion/${id}/accion`, { accion: a, valor }).then((r) => r.data);
  const estadoDe = (r) => r.estado.reproduccion.estado;
  const nombres = (r) => r.eventos.map((e) => e.evento);
  const cambio = (r) => r.eventos.filter((e) => e.evento === 'ESTADO_CAMBIO').map((e) => `${e.datos.de}→${e.datos.a}`).join(', ');

  try {
    chk('La sesión nace "detenido" y solo admite reproducir y buscar', crear.data.estado.reproduccion.estado === 'detenido' && crear.data.estado.reproduccion.accionesPermitidas.join() === 'reproducir,buscar', crear.data.estado.reproduccion.accionesPermitidas.join(', '));

    const pausar = await accion('pausar');
    chk('PAUSAR con el video detenido se IGNORA y queda anotado (sigue "detenido")', estadoDe(pausar) === 'detenido' && nombres(pausar).includes('TRANSICION_IGNORADA'), nombres(pausar).join(', '));

    const play = await accion('reproducir');
    chk('REPRODUCIR con el buffer vacío: detenido → cargando', estadoDe(play) === 'cargando' && cambio(play) === 'detenido→cargando', cambio(play));
    chk('REPRODUCIR otra vez mientras carga se ignora', nombres(await accion('reproducir')).includes('TRANSICION_IGNORADA'));

    const t = await accion('avanzar', 10);
    chk('Al llenarse el buffer: cargando → reproduciendo (solo, el usuario no hizo nada)', estadoDe(t) === 'reproduciendo' && cambio(t) === 'cargando→reproduciendo', cambio(t));

    const pausa = await accion('pausar');
    const pos = pausa.estado.reproduccion.posicionSeg;
    const quieto = await accion('avanzar', 5);
    chk('En "pausado" el tiempo no avanza y NO reanuda solo, aunque el buffer se llene', estadoDe(pausa) === 'pausado' && quieto.estado.reproduccion.posicionSeg === pos && estadoDe(quieto) === 'pausado', `posición ${pos}s · buffer ${quieto.estado.buffer.segundos}s`);

    const reanuda = await accion('reproducir');
    chk('REPRODUCIR en pausa con buffer lleno: pausado → reproduciendo, sin pasar por "cargando"', estadoDe(reanuda) === 'reproduciendo' && cambio(reanuda) === 'pausado→reproduciendo', cambio(reanuda));

    const salto = await accion('buscar', 8035);
    chk('Buscar vacía el buffer y el estado pasa a "cargando"', estadoDe(salto) === 'cargando' && cambio(salto) === 'reproduciendo→cargando', cambio(salto));

    const fin = await accion('avanzar', 30);
    chk('Al terminar el contenido: reproduciendo → detenido', estadoDe(fin) === 'detenido' && fin.estado.reproduccion.accionesPermitidas.includes('reproducir'), cambio(fin));

    const otra = await accion('reproducir');
    chk('PLAY con el video terminado lo reinicia (posición 0, buffer vacío, "cargando")', otra.estado.reproduccion.posicionSeg === 0 && otra.estado.buffer.segundos === 0 && estadoDe(otra) === 'cargando', `pos ${otra.estado.reproduccion.posicionSeg}s · buffer ${otra.estado.buffer.segundos}s`);
  } finally {
    await api.delete(`/api/stream/sesion/${id}`).catch(() => {});
  }
});

// ------------------------------------------------------------------
// VISITOR (gestión de contenido: reportes sobre el catálogo Composite)
// ------------------------------------------------------------------
export const verificarVisitor = protegido('Visitor', async (chk) => {
  const reporte = (raiz, visitante, extra = {}) => get(`/api/catalogo/${raiz}/reporte`, { params: { visitante, ...extra } });

  const est = await reporte('catalogo', 'estadisticas');
  const detalle = await get('/api/catalogo/catalogo');
  chk('Estadísticas: la duración total coincide con la que calcula el Composite', est.duracionTotalMin === detalle.resumen.duracionMin, `${est.duracionTotalMin} min`);
  chk('Estadísticas: los reproducibles coinciden con los del Composite', est.reproducibles === detalle.resumen.totalReproducibles, `${est.reproducibles} reproducibles`);

  const todos = [];
  let desde = 0;
  while (desde !== null) {
    const p = await get('/api/catalogo/catalogo/recorrer', { params: { orden: 'profundidad', limite: 100, desde } });
    todos.push(...p.elementos);
    desde = p.siguiente;
  }
  chk('Visitor + Iterator: el visitante visita los mismos nodos que recorre el iterador', est.nodosVisitados === todos.length, `${est.nodosVisitados} nodos`);
  chk('Los conteos por tipo suman todos los nodos', Object.values(est.porTipo).reduce((a, b) => a + b, 0) === est.nodosVisitados, JSON.stringify(est.porTipo));

  const serie = await reporte('horizonte-nocturno', 'estadisticas');
  chk('Una serie: 1 serie, 2 temporadas, 8 episodios y 416 min', serie.porTipo.serie === 1 && serie.porTipo.temporada === 2 && serie.porTipo.episodio === 8 && serie.duracionTotalMin === 416, `${serie.duracionTexto}`);

  const alm = await reporte('catalogo', 'almacenamiento');
  const r = alm.calidades['1080p'].gb / alm.calidades['360p'].gb;
  chk('Almacenamiento usa los bitrates del Flyweight: 1080p pesa 6,25× más que 360p', Math.abs(r - 6.25) < 0.01, `${alm.calidades['360p'].gb} GB → ${alm.calidades['1080p'].gb} GB`);
  const soloDos = await reporte('catalogo', 'almacenamiento', { calidades: '720p,1080p' });
  chk('Se pueden elegir las calidades a estimar', Object.keys(soloDos.calidades).join() === '720p,1080p', Object.keys(soloDos.calidades).join(', '));

  const csv = await reporte('horizonte-nocturno', 'csv');
  chk('CSV: una fila por nodo (11) con su cabecera', csv.filas === 11 && csv.csv.startsWith('nivel,tipo,id,titulo,duracionMin,generos') && csv.csv.split('\n').length === 12, `${csv.filas} filas`);
  chk('Los 3 visitantes recorren exactamente los mismos nodos', est.nodosVisitados === alm.nodosVisitados && alm.nodosVisitados === (await reporte('catalogo', 'csv')).nodosVisitados);

  chk('Nodo inexistente → 404', (await estadoHttp(() => reporte('no-existe', 'estadisticas'))) === 404);
  chk('Visitante inexistente → 400', (await estadoHttp(() => reporte('catalogo', 'xml'))) === 400);
  chk('Calidad inexistente → 400', (await estadoHttp(() => reporte('catalogo', 'almacenamiento', { calidades: '7p' }))) === 400);
});

export const VERIFICACIONES = {
  iterator: verificarIterator,
  mediator: verificarMediator,
  memento: verificarMemento,
  chain: verificarChain,
  command: verificarCommand,
  observer: verificarObserver,
  state: verificarState,
  visitor: verificarVisitor,
};
