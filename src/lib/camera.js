import { Capacitor } from "@capacitor/core";

// En el APK / app iOS se usa el plugin nativo de camara, que abre SIEMPRE la camara trasera (el WebView de Android ignora
// capture="environment" y suele abrir la frontal). En el navegador, o en un APK anterior sin el plugin, se usa el input de archivo.
export const hasNativeCamera = () => Capacitor.isNativePlatform() && Capacitor.isPluginAvailable("Camera");

// Abre la camara trasera y devuelve la foto como File, o null si la persona cancela.
export const takeNativePhoto = async () => {
  const { Camera, CameraResultType, CameraSource, CameraDirection } = await import("@capacitor/camera");
  try {
    const photo = await Camera.getPhoto({
      source: CameraSource.Camera,
      direction: CameraDirection.Rear,
      resultType: CameraResultType.Uri,
      quality: 85,
      correctOrientation: true,
    });
    const blob = await (await fetch(photo.webPath)).blob();
    const ext = photo.format === "png" ? "png" : "jpeg";
    return new File([blob], `foto-${Date.now()}.${ext === "jpeg" ? "jpg" : ext}`, { type: `image/${ext}` });
  } catch (err) {
    if (/cancel/i.test(String(err?.message ?? err))) return null;
    throw err;
  }
};
