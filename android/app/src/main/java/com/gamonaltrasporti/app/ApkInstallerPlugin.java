package com.gamonaltrasporti.app;

import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import androidx.core.content.FileProvider;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.security.MessageDigest;

/**
 * Descarga el APK nuevo (URL firmada del bucket) y abre el instalador de Android encima de la app instalada.
 * Android exige que el usuario autorice a esta app a "instalar apps desconocidas" (una sola vez) y que el APK
 * tenga la misma firma y un versionCode mayor.
 */
@CapacitorPlugin(name = "ApkInstaller")
public class ApkInstallerPlugin extends Plugin {

    private volatile boolean downloading = false;

    @PluginMethod
    public void canInstall(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("allowed", canRequestInstalls());
        call.resolve(ret);
    }

    @PluginMethod
    public void openInstallSettings(PluginCall call) {
        Context context = getContext();
        Intent intent = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + context.getPackageName()));
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        context.startActivity(intent);
        call.resolve();
    }

    @PluginMethod
    public void downloadAndInstall(PluginCall call) {
        final String url = call.getString("url");
        final String sha256 = call.getString("sha256");
        if (url == null || !url.startsWith("https://")) {
            call.reject("La direccion de descarga no es valida.");
            return;
        }
        if (!canRequestInstalls()) {
            call.reject("NOT_ALLOWED");
            return;
        }
        if (downloading) {
            call.reject("Ya se esta descargando la actualizacion.");
            return;
        }
        downloading = true;

        new Thread(() -> {
            File target = null;
            try {
                File dir = new File(getContext().getCacheDir(), "updates");
                if (!dir.exists() && !dir.mkdirs()) throw new IllegalStateException("No pude crear la carpeta de descarga.");
                // Un solo APK a la vez: se borran los de descargas anteriores.
                File[] old = dir.listFiles();
                if (old != null) for (File f : old) f.delete();
                target = new File(dir, "gamonal-driver-update.apk");

                HttpURLConnection connection = (HttpURLConnection) new URL(url).openConnection();
                connection.setConnectTimeout(20000);
                connection.setReadTimeout(30000);
                int status = connection.getResponseCode();
                if (status != 200) throw new IllegalStateException("El servidor respondio " + status + ".");
                long total = connection.getContentLengthLong();

                MessageDigest digest = MessageDigest.getInstance("SHA-256");
                long received = 0;
                long lastNotify = 0;
                try (InputStream in = connection.getInputStream(); OutputStream out = new FileOutputStream(target)) {
                    byte[] buffer = new byte[64 * 1024];
                    int read;
                    while ((read = in.read(buffer)) != -1) {
                        out.write(buffer, 0, read);
                        digest.update(buffer, 0, read);
                        received += read;
                        long now = System.currentTimeMillis();
                        if (now - lastNotify > 250) {
                            lastNotify = now;
                            JSObject progress = new JSObject();
                            progress.put("received", received);
                            progress.put("total", total);
                            notifyListeners("progress", progress);
                        }
                    }
                } finally {
                    connection.disconnect();
                }

                if (sha256 != null && !sha256.isEmpty()) {
                    StringBuilder hex = new StringBuilder();
                    for (byte b : digest.digest()) hex.append(String.format("%02x", b));
                    if (!hex.toString().equalsIgnoreCase(sha256)) {
                        throw new IllegalStateException("El archivo descargado esta incompleto o danado. Intenta de nuevo.");
                    }
                }

                JSObject progress = new JSObject();
                progress.put("received", received);
                progress.put("total", total);
                notifyListeners("progress", progress);

                final File apk = target;
                getActivity().runOnUiThread(() -> {
                    try {
                        Context context = getContext();
                        Uri uri = FileProvider.getUriForFile(context, context.getPackageName() + ".fileprovider", apk);
                        Intent intent = new Intent(Intent.ACTION_VIEW);
                        intent.setDataAndType(uri, "application/vnd.android.package-archive");
                        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
                        context.startActivity(intent);
                        downloading = false;
                        JSObject ret = new JSObject();
                        ret.put("started", true);
                        call.resolve(ret);
                    } catch (Exception e) {
                        downloading = false;
                        call.reject("No pude abrir el instalador: " + e.getMessage());
                    }
                });
            } catch (Exception e) {
                downloading = false;
                if (target != null) target.delete();
                call.reject(e.getMessage() != null ? e.getMessage() : "No se pudo descargar la actualizacion.");
            }
        }).start();
    }

    private boolean canRequestInstalls() {
        return Build.VERSION.SDK_INT < Build.VERSION_CODES.O || getContext().getPackageManager().canRequestPackageInstalls();
    }
}
