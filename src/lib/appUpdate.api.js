import { api } from "./api";

// Ultima version del APK publicada (con una URL firmada, valida unos minutos) o null si no hay ninguna.
export const getAndroidUpdateRequest = async () => (await api.get("/app/android")).data.data.android;
