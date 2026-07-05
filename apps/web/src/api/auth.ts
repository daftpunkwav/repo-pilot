import { api } from "./client";

export async function login(username: string, password: string) {
  return api.post("/auth/login", { username, password });
}

export async function register(username: string, password: string, email?: string) {
  return api.post("/auth/register", { username, password, email });
}
