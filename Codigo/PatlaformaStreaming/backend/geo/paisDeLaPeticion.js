/**
 * paisDeLaPeticion.js
 * ------------------------------------------------------------------
 * ¿Desde qué país se está pidiendo el video? Lo decide EL SERVIDOR, nunca el
 * navegador (antes el Dashboard mandaba "CO" escrito a mano, y cualquiera podía
 * cambiarlo). Orden de prioridad:
 *
 *  1. Cabecera que pone tu CDN/proxy de confianza. Se activa con la variable
 *     GEO_CABECERA_PAIS, p. ej.:  cf-ipcountry (Cloudflare), x-vercel-ip-country (Vercel),
 *     cloudfront-viewer-country (AWS). Esos proveedores geolocalizan la IP por ti.
 *     Solo se activa si lo configuras: si no, un cliente podría falsificar la cabecera.
 *  2. PAIS_POR_DEFECTO (por defecto "CO"): el país donde "opera" este servidor. En tu
 *     máquina local ES lo único posible, porque la IP es 127.0.0.1 y no tiene país.
 * ------------------------------------------------------------------
 */
export function paisDeLaPeticion(req) {
  const cabecera = (process.env.GEO_CABECERA_PAIS || '').trim().toLowerCase();
  if (cabecera) {
    const valor = String(req.headers[cabecera] ?? '').trim();
    if (/^[A-Za-z]{2}$/.test(valor)) return { pais: valor.toUpperCase(), origen: `cabecera ${cabecera} del proxy` };
    // País desconocido -> "XX" (código ISO reservado). NO se devuelve '' porque DRMFacade lo
    // reemplazaría por 'CO' y la restricción regional quedaría anulada.
    return { pais: 'XX', origen: `cabecera ${cabecera} ausente o inválida` };
  }
  const porDefecto = (process.env.PAIS_POR_DEFECTO || 'CO').trim().toUpperCase();
  return { pais: porDefecto, origen: 'configuración del servidor (PAIS_POR_DEFECTO)' };
}
