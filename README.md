# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and Oxlint's TypeScript related rules in your project.

## Cómo llegan los cambios a los celulares (Android)

- **Cambios de la parte web** (pantallas, colores, textos, lógica React): llegan solos. La app Android carga la web desde Vercel (`server.url` en `capacitor.config.json`), así que cada despliegue de Vercel se ve al abrir la app, sin instalar nada. Si no hay internet, muestra `public/offline.html` con un botón para reintentar.
- **Cambios nativos** (algo dentro de `android/`, permisos, plugins de Capacitor, `capacitor.config.json`): GitHub Actions (`.github/workflows/android-apk.yml`) compila el APK, lo firma y lo publica en el backend al hacer push. Los testers ven «Hay una versión nueva» al abrir la app y la instalan desde Ajustes > Acerca de la app > Actualizar aplicación (Android no permite instalar sin que la persona toque el botón). También se puede lanzar a mano desde GitHub > Actions > «APK de Android» > Run workflow.
- **Secretos de GitHub** (Settings > Secrets and variables > Actions): `ANDROID_KEYSTORE_BASE64` (la clave de firma, `base64 -i ~/.android/debug.keystore`) y `APP_PUBLISH_TOKEN` (el mismo valor que la variable `APP_PUBLISH_TOKEN` de Render). El APK debe firmarse siempre con la misma clave: con otra, Android no deja actualizar encima y hay que desinstalar. Guarda una copia de `~/.android/debug.keystore`.
- El número de versión sube solo: `versionCode = run_number + 10` y `versionName = 1.2.<run_number>` (en `build.gradle` se leen de `APP_VERSION_CODE` y `APP_VERSION_NAME`; compilando a mano valen 2 y 1.1).
- **A mano, sin GitHub:** `pnpm android:build` y luego `cd ../AppGamonalTrasportiBack && node scripts/publicar-apk.mjs ../AppGamonalTrasportiFront/android/app/build/outputs/apk/debug/app-debug.apk --notas "Qué hay de nuevo"` (antes sube `APP_VERSION_CODE`/`versionCode`).
