import axios from "axios";
import type { AxiosInstance, AxiosError } from "axios";

const API_BASE = "/api/v1";

class ApiClient {
  client: AxiosInstance;

  constructor() {
    this.client = axios.create({ baseURL: API_BASE });
    this.client.interceptors.request.use((config) => {
      const token = localStorage.getItem("repopilot_token");
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });
    this.client.interceptors.response.use(
      (res) => res.data,
      (error: AxiosError) => {
        const data = error.response?.data as { error?: { code?: string; message?: string } } | undefined;
        throw new Error(data?.error?.message || error.message);
      }
    );
  }

  async get(url: string) {
    return this.client.get(url);
  }

  async post(url: string, body?: unknown) {
    return this.client.post(url, body);
  }

  async put(url: string, body?: unknown) {
    return this.client.put(url, body);
  }

  async delete(url: string) {
    return this.client.delete(url);
  }
}

export const api = new ApiClient();
