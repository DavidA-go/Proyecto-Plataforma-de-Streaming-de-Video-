import PerfilRecomendacionRegistry from '../recommendation/PerfilRecomendacionRegistry.js';
import { ErrorNegocio } from '../proxy/errores.js';

/** SUJETO REAL (Proxy) — recomendación. Interfaz: generarPerfil(). */
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
}

export default RecomendacionServicio;
