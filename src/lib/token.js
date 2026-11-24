const TOKEN_KEY = "gt_token";

export const getToken = () => localStorage.getItem(TOKEN_KEY);

export const setToken = (token) => localStorage.setItem(TOKEN_KEY, token);

export const clearToken = () => localStorage.removeItem(TOKEN_KEY);

export const sessionExpiresAt = (token, cargo) => {
  try {
    const encoded = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const { exp, iat } = JSON.parse(atob(encoded));
    const hours = cargo === "CHOFER" ? 2 : ["OWNER", "ADMIN", "RRHH"].includes(cargo) ? 12 : null;
    const expiry = hours === null ? exp : Math.min(exp, iat + hours * 3600);
    return Number.isFinite(expiry) ? expiry * 1000 : null;
  } catch {
    return null;
  }
};
