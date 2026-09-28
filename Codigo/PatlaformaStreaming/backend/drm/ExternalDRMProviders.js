/**
 * ExternalDRMProviders.js
 * ------------------------------------------------------------------
 * SIMULACIÓN de dos SDKs de terceros para DRM comercial: Widevine
 * (Google) y PlayReady (Microsoft).
 *
 * Estas clases representan código que NO podemos modificar: en un
 * proyecto real vendrían como una librería externa (paquete npm o
 * SDK nativo) con su propia interfaz, distinta a la que usa nuestro
 * sistema (LicenseManager, definido en ProductosDRM.js). Por eso son
 * el "adaptee" del patrón Adapter: existen, funcionan, pero "hablan
 * un idioma distinto" al de nuestra aplicación (nombres de método,
 * nombres de parámetros y formato de respuesta diferentes).
 * ------------------------------------------------------------------
 */

/**
 * WidevineClientSDK (simulado)
 * Interfaz ficticia inspirada en cómo un SDK real de Widevine pediría
 * una licencia: por deviceId y assetKey, no por "usuario" y
 * "contenidoId" como en el vocabulario de nuestro dominio.
 */
export class WidevineClientSDK {
  requestLicense(deviceId, assetKey) {
    console.log(`🌐 [Widevine SDK externo] requestLicense(deviceId=${deviceId}, assetKey=${assetKey})`);
    return {
      widevineLicenseToken: `WV-${deviceId}-${assetKey}-${Date.now()}`,
      ttlSeconds: 86400, // 24h, expresado en SEGUNDOS (nuestro sistema usa minutos)
      offlineAllowed: true,
      provider: 'Widevine',
    };
  }
}

/**
 * PlayReadyClientSDK (simulado)
 * Interfaz ficticia inspirada en PlayReady: pide un "challenge" (un
 * objeto, no dos parámetros sueltos) y devuelve una licencia con
 * nombres de campo completamente distintos a los de Widevine.
 */
export class PlayReadyClientSDK {
  acquireLicense(challenge) {
    console.log(`🌐 [PlayReady SDK externo] acquireLicense(challenge=${JSON.stringify(challenge)})`);
    return {
      prLicenseBlob: `PR-${challenge.userId}-${challenge.contentRef}-${Date.now()}`,
      expiresInMinutes: 1440, // 24h, expresado en MINUTOS
      canDownload: true,
      provider: 'PlayReady',
    };
  }
}
