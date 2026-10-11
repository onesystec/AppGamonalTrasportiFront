# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and Oxlint's TypeScript related rules in your project.

## Publicar una actualización del APK (Ajustes > Acerca de la app > Actualizar aplicación)

1. Sube `versionCode` (un número entero mayor) y `versionName` en `android/app/build.gradle`. Android no instala un APK con el mismo `versionCode`.
2. Compila: `pnpm android:build` (queda en `android/app/build/outputs/apk/debug/app-debug.apk`).
3. Publícalo desde el backend (sube el APK al bucket privado y guarda la versión):
   `cd ../AppGamonalTrasportiBack && node scripts/publicar-apk.mjs ../AppGamonalTrasportiFront/android/app/build/outputs/apk/debug/app-debug.apk --notas "Qué hay de nuevo"`

Los testers verán «Hay una versión nueva» al abrir la app. El APK debe firmarse siempre con la misma clave (`~/.android/debug.keystore`): hay que guardar una copia, porque con otra clave Android no deja actualizar encima. Las pantallas web (cambios solo de React) también viajan dentro del APK, así que hoy requieren un APK nuevo.
