export const canManageFinance = (user) => ["OWNER", "ADMIN", "RRHH"].includes(user?.cargo);

export const canConfigureFinance = (user) => user?.cargo === "OWNER" || user?.cargo === "RRHH";
