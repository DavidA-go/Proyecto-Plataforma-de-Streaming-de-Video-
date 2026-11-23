import PerfilRecomendacionRegistry from '../recommendation/PerfilRecomendacionRegistry.js';
import PerfilesUsuarioStore from '../recommendation/memento/PerfilesUsuarioStore.js';
import HistorialVisualizacionStore from '../recommendation/HistorialVisualizacionStore.js';
import { crearEstrategia, estrategiasDisponibles, ESTRATEGIA_POR_DEFECTO } from '../recommendation/strategy/crearEstrategia.js'; // Strategy
import { crearGenerador, tiposDisponibles, TIPO_POR_DEFECTO } from '../recommendation/template/crearGenerador.js'; // Template Method
import CatalogoService from '../catalog/CatalogoService.js';
import { ErrorNegocio } from '../proxy/errores.js';

const CAMPOS_EDITABLES = ['generosFavoritos', 'tipoContenidoPreferido', 'pesoHistorial'];
const TIPOS_TITULO = ['pelicula', 'documental', 'serie'];
const LIMITE_RECOMENDACIONES_POR_DEFECTO = 5;
const LIMITE_RECOMENDACIONES_MAXIMO = 20;

/**
 * SUJETO REAL (Proxy) — recomendación. Interfaz: generarPerfil() + el perfil propio de cada
 * usuario con historial de versiones (Memento): miPerfil(), guardarMiPerfil(), deshacerMiPerfil(),
 * rehacerMiPerfil(), restaurarMiPerfil().
 * Además recomienda títulos del catálogo: recomendar() usa TEMPLATE METHOD (esqueleto de la recomendación,
 * subclases por tipo) + STRATEGY (algoritmo de puntuación intercambiable). Ver recommendation/template y /strategy.
 */
class RecomendacionServicio {
  generarPerfil({ categoriaBase, generosAdicionales }) {
    let perfil;
    try {
      perfil = PerfilRecomendacionRegistry.obtenerPlantilla(categoriaBase); // Prototype: clon
    } catch (e) {
      throw new ErrorNegocio(e.message);
    }
    if (Array.isArray(generosAdicionales)) {
      perfil.generosFavoritos = [...new Set([...perfil.generosFavoritos, ...generosAdicionales])];
    }
    return perfil.toJSON();
  }

  // ------------------------------------------------------------------
  // MEMENTO: perfil propio con historial (deshacer / rehacer / volver a una versión)
  //   Originador = PerfilRecomendacion · Memento = PerfilMemento · Cuidador = HistorialPerfil
  // ------------------------------------------------------------------

  #vista({ perfil, historial }, extra = {}) {
    return {
      perfil: perfil.toJSON(),
      historial: historial.listar(),
      puedeDeshacer: historial.puedeDeshacer(),
      puedeRehacer: historial.puedeRehacer(),
      ...extra,
    };
  }

  #entradaDe(usuarioId) {
    const entrada = PerfilesUsuarioStore.obtener(usuarioId);
    if (!entrada) throw new ErrorNegocio('Aún no tienes un perfil de recomendación. Créalo con PUT /api/recomendaciones/mi-perfil.', 404);
    return entrada;
  }

  miPerfil({ usuarioId }) {
    return this.#vista(this.#entradaDe(usuarioId));
  }

  /**
   * Crea o modifica el perfil del usuario.
   *  - Sin perfil previo: exige "categoriaBase" (Prototype: se clona la plantilla) y aplica el resto encima.
   *  - Con perfil: "categoriaBase" reemplaza todo por esa plantilla; "generosAdicionales" suma géneros;
   *    "generosFavoritos" / "tipoContenidoPreferido" / "pesoHistorial" cambian ese campo.
   *  Antes de modificar se guarda un memento; si algo falla, el perfil vuelve a como estaba.
   */
  guardarMiPerfil({ usuarioId, categoriaBase, generosAdicionales, ...resto }) {
    const cambios = {};
    for (const c of CAMPOS_EDITABLES) if (resto[c] !== undefined) cambios[c] = resto[c];
    const pedidos = [
      ...(categoriaBase ? ['categoriaBase'] : []),
      ...(generosAdicionales !== undefined ? ['generosAdicionales'] : []),
      ...Object.keys(cambios),
    ];

    const entrada = PerfilesUsuarioStore.obtener(usuarioId);
    if (!entrada && !categoriaBase) {
      throw new ErrorNegocio('Aún no tienes perfil: indica "categoriaBase" (accionAventura, familiar o documental) para crearlo.');
    }
    if (entrada && pedidos.length === 0) {
      throw new ErrorNegocio('Indica qué cambiar: categoriaBase, generosAdicionales, generosFavoritos, tipoContenidoPreferido o pesoHistorial.');
    }

    const plantilla = () => {
      try {
        return PerfilRecomendacionRegistry.obtenerPlantilla(categoriaBase); // Prototype: clon
      } catch (e) {
        throw new ErrorNegocio(e.message);
      }
    };
    const aplicar = (perfil) => {
      if (generosAdicionales !== undefined) {
        if (!Array.isArray(generosAdicionales)) throw new Error('"generosAdicionales" debe ser un arreglo de textos.');
        perfil.actualizar({ generosFavoritos: [...perfil.generosFavoritos, ...generosAdicionales] });
      }
      perfil.actualizar(cambios);
    };

    try {
      // --- Primera vez: se crea desde la plantilla (no hay nada que guardar todavía) ---
      if (!entrada) {
        const perfil = plantilla();
        aplicar(perfil);
        return this.#vista(PerfilesUsuarioStore.iniciar(usuarioId, perfil), { creado: true });
      }

      // --- Ya tiene perfil: foto ANTES de tocarlo ---
      const { perfil, historial } = entrada;
      const antes = perfil.crearMemento(`Antes de modificar: ${pedidos.join(', ')}`);
      try {
        if (categoriaBase) perfil.restaurar(plantilla().crearMemento()); // reemplazo completo por la plantilla
        aplicar(perfil);
      } catch (e) {
        perfil.restaurar(antes); // rollback con el mismo memento
        throw e;
      }
      const cambioReal = JSON.stringify(perfil.crearMemento().getEstado()) !== JSON.stringify(antes.getEstado());
      if (cambioReal) historial.guardar(antes);
      return this.#vista(entrada, cambioReal ? {} : { sinCambios: true });
    } catch (e) {
      if (e instanceof ErrorNegocio) throw e;
      throw new ErrorNegocio(e.message);
    }
  }

  deshacerMiPerfil({ usuarioId }) {
    const entrada = this.#entradaDe(usuarioId);
    const memento = entrada.historial.deshacer(entrada.perfil);
    if (!memento) throw new ErrorNegocio('No hay cambios del perfil para deshacer.');
    return this.#vista(entrada, { restauradoA: memento.etiqueta });
  }

  rehacerMiPerfil({ usuarioId }) {
    const entrada = this.#entradaDe(usuarioId);
    const memento = entrada.historial.rehacer(entrada.perfil);
    if (!memento) throw new ErrorNegocio('No hay cambios del perfil para rehacer.');
    return this.#vista(entrada, { restauradoA: memento.etiqueta });
  }

  restaurarMiPerfil({ usuarioId, version }) {
    const entrada = this.#entradaDe(usuarioId);
    const n = Number(version);
    if (!Number.isInteger(n) || n < 1) throw new ErrorNegocio('"version" debe ser un entero >= 1 (ver GET /api/recomendaciones/mi-perfil).');
    const memento = entrada.historial.restaurarVersion(entrada.perfil, n);
    if (!memento) throw new ErrorNegocio(`La versión ${n} no existe.`, 404);
    return this.#vista(entrada, { restauradoA: memento.etiqueta });
  }

  // ------------------------------------------------------------------
  // STRATEGY + TEMPLATE METHOD: recomendaciones del catálogo
  //   Template Method: GeneradorRecomendaciones.generar() (tipo: para-ti | similares | descubrir)
  //   Strategy:        EstrategiaPuntuacion (estrategia: generos | historial | hibrida)
  // ------------------------------------------------------------------

  /** Qué tipos (plantillas) y qué estrategias se pueden pedir. */
  opciones() {
    return { tipos: tiposDisponibles(), estrategias: estrategiasDisponibles(), tipoPorDefecto: TIPO_POR_DEFECTO, estrategiaPorDefecto: ESTRATEGIA_POR_DEFECTO };
  }

  /**
   * @param {string} usuarioId
   * @param {string} tipo        'para-ti' (por defecto) | 'similares' | 'descubrir'   -> qué subclase del Template Method
   * @param {string} estrategia  'hibrida' (por defecto) | 'generos' | 'historial'    -> qué Strategy de puntuación
   * @param {string} contenidoId solo 'similares': título de referencia
   * @param {number} limite      1..20 (por defecto 5)
   */
  recomendar({ usuarioId, tipo = TIPO_POR_DEFECTO, estrategia = ESTRATEGIA_POR_DEFECTO, contenidoId, limite = LIMITE_RECOMENDACIONES_POR_DEFECTO }) {
    const { perfil } = this.#entradaDe(usuarioId); // el perfil trae géneros, tipo preferido y pesoHistorial

    const n = Number.parseInt(limite, 10);
    if (!Number.isInteger(n) || n < 1) throw new ErrorNegocio('"limite" debe ser un entero >= 1.');

    let generador;
    let estrategiaElegida;
    try {
      generador = crearGenerador(tipo);
      estrategiaElegida = crearEstrategia(estrategia);
    } catch (e) {
      throw new ErrorNegocio(e.message);
    }

    let nodoReferencia;
    if (generador.tipo() === 'similares') {
      if (!contenidoId) throw new ErrorNegocio('Para "similares" indica "contenidoId" (un título del catálogo).');
      nodoReferencia = CatalogoService.buscar(String(contenidoId));
      if (!nodoReferencia) throw new ErrorNegocio(`Contenido "${contenidoId}" no encontrado.`, 404);
      if (!TIPOS_TITULO.includes(nodoReferencia.tipo())) throw new ErrorNegocio('El contenido de referencia debe ser una película, documental o serie.');
    }

    return generador.generar({
      perfil,
      historial: HistorialVisualizacionStore.listar(usuarioId).map((v) => v.contenidoId),
      estrategia: estrategiaElegida,
      limite: Math.min(n, LIMITE_RECOMENDACIONES_MAXIMO),
      raiz: CatalogoService.raiz,
      nodoReferencia,
    });
  }

  /** Marca un título como visto (alimenta la estrategia por historial y el filtro de "ya visto"). */
  registrarVisto({ usuarioId, contenidoId }) {
    const nodo = contenidoId ? CatalogoService.buscar(String(contenidoId)) : null;
    if (!nodo) throw new ErrorNegocio(`Contenido "${contenidoId}" no encontrado.`, 404);
    if (!TIPOS_TITULO.includes(nodo.tipo())) throw new ErrorNegocio('Solo se registran películas, documentales o series completas.');
    const total = HistorialVisualizacionStore.registrar(usuarioId, nodo.id);
    return { registrado: { id: nodo.id, titulo: nodo.titulo, generos: nodo.getGeneros() }, totalVistos: total };
  }

  miHistorial({ usuarioId }) {
    const vistos = HistorialVisualizacionStore.listar(usuarioId).map((v) => {
      const nodo = CatalogoService.buscar(v.contenidoId);
      return { id: v.contenidoId, titulo: nodo?.titulo ?? v.contenidoId, generos: nodo?.getGeneros() ?? [], fecha: v.fecha };
    });
    return { vistos, total: vistos.length };
  }

  limpiarMiHistorial({ usuarioId }) {
    HistorialVisualizacionStore.limpiar(usuarioId);
    return { vistos: [], total: 0 };
  }
}

export default RecomendacionServicio;