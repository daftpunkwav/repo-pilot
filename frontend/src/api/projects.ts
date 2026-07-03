import { api } from "./client";
import type { Project, ProjectCreate, ProjectUpdate } from "../types/project";

export async function fetchProjects() {
  const res = await api.get("/projects");
  return res as { data: Project[] };
}

export async function createProject(data: ProjectCreate) {
  return api.post("/projects", data);
}

export async function updateProject(id: string, data: ProjectUpdate) {
  return api.put(`/projects/${id}`, data);
}

export async function deleteProject(id: string) {
  return api.delete(`/projects/${id}`);
}
