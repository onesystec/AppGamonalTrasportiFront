import { api } from "./api";

export const loginRequest = (payload) =>
  api.post("/auth/login", payload).then((res) => res.data.data);

// Cambia un ticket de single sign-on de OneSystec por una sesión real acá, sin
// password — ver AuthContext.jsx.
export const ssoLoginRequest = (ticket) =>
  api.post("/auth/sso", { ticket }).then((res) => res.data.data);

export const meRequest = () => api.get("/auth/me").then((res) => res.data.data.user);

export const forgotPasswordRequest = (correoElectronico) =>
  api.post("/auth/forgot-password", { correoElectronico }).then((res) => res.data);

export const resetPasswordRequest = (token, newPassword) =>
  api.post("/auth/reset-password", { token, newPassword }).then((res) => res.data);
