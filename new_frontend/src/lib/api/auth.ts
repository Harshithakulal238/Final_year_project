import { api } from "./client";

export type ApiUser = {
  id: string;
  username: string;
  phone: string | null;
  hasProfile: boolean;
  profile: unknown | null;
};

export const authApi = {
  register: (input: { phone: string; username: string; password: string }) =>
    api<{ message: string }>("/api/auth/register", { method: "POST", body: JSON.stringify(input) }),
  login: (input: { username: string; password: string }) =>
    api<{ token: string; user: ApiUser }>("/api/auth/login", { method: "POST", body: JSON.stringify(input) }),
  me: () => api<{ user: ApiUser }>("/api/auth/me"),
  updateProfile: (profile: unknown) =>
    api<{ user: ApiUser }>("/api/auth/profile", { method: "PUT", body: JSON.stringify(profile) }),
};
