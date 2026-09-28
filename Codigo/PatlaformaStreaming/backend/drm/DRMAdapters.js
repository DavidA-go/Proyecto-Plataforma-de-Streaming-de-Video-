import { LicenseManager } from './ProductosDRM.js';
import { WidevineClientSDK, PlayReadyClientSDK } from './ExternalDRMProviders.js';

/**
 * DRMAdapters.js
 * ------------------------------------------------------------------
 * ADAPTER: traduce la interfaz de los SDKs externos (Widevine,
 * PlayReady) a la interfaz que nuestro sistema ya espera:
 * LicenseManager.emitirLicencia(usuario, contenidoId), la misma que
 * ya implementan LicenseManagerBasico y LicenseManagerPremium.
 *
 * Gracias al Adapter, el endpoint de index.js puede tratar a un
 * proveedor DRM comercial EXACTAMENTE igual que a nuestros propios
 * LicenseManager: como uno más. El "adaptee" (el SDK externo) nunca
 * se modifica, solo se envuelve.
 * ------------------------------------------------------------------
 */

export class WidevineLicenseAdapter extends LicenseManager {
  constructor() {
    super();
    this.sdk = new WidevineClientSDK(); // el objeto adaptado (adaptee)
  }

  emitirLicencia(usuario, contenidoId) {
    console.log(`🔌 [Adapter] WidevineLicenseAdapter.emitirLicencia(usuario=${usuario.id}, contenido=${contenidoId})`);

    // 1. Traducimos NUESTROS parámetros (usuario, contenidoId) al
    //    vocabulario que espera el SDK externo (deviceId, assetKey).
    const respuestaWidevine = this.sdk.requestLicense(`device-${usuario.id}`, contenidoId);

    // 2. Traducimos SU respuesta de vuelta al formato que el resto del
    //    sistema ya conoce (el mismo shape que LicenseManagerPremium).
    return {
      licenciaId: respuestaWidevine.widevineLicenseToken,
      duracionMinutos: Math.round(respuestaWidevine.ttlSeconds / 60),
      permiteOffline: respuestaWidevine.offlineAllowed,
      proveedorExterno: respuestaWidevine.provider,
    };
  }
}

export class PlayReadyLicenseAdapter extends LicenseManager {
  constructor() {
    super();
    this.sdk = new PlayReadyClientSDK();
  }

  emitirLicencia(usuario, contenidoId) {
    console.log(`🔌 [Adapter] PlayReadyLicenseAdapter.emitirLicencia(usuario=${usuario.id}, contenido=${contenidoId})`);

    const respuestaPlayReady = this.sdk.acquireLicense({
      userId: usuario.id,
      contentRef: contenidoId,
    });

    return {
      licenciaId: respuestaPlayReady.prLicenseBlob,
      duracionMinutos: respuestaPlayReady.expiresInMinutes,
      permiteOffline: respuestaPlayReady.canDownload,
      proveedorExterno: respuestaPlayReady.provider,
    };
  }
}
