import PerfilRecomendacionRegistry from '../recommendation/PerfilRecomendacionRegistry.js';
import PerfilesUsuarioStore from '../recommendation/memento/PerfilesUsuarioStore.js';
import { ErrorNegocio } from '../proxy/errores.js';

const CAMPOS_EDITABLES = ['generosFavoritos', 'tipoContenidoPreferido', 'pesoHistorial'];

/**
 * SUJETO REAL (Proxy) — recomendación. Interfaz: generarPerfil() + el perfil propio de cada
 * usuario con historial de versiones (Memento): miPerfil(), guardarMiPerfil(), deshacerMiPerfil(),
 * rehacerMiPerfil(), restaurarMiPerfil().
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
}

export default RecomendacionServicio;
