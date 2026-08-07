/**
 * Auth 域 — register / login / logout / refresh / me / profile / GitHub 账号 / Stars
 * 对应 IApiClient 的前 11 个方法
 */
import type { ApiResponse, GitHubAccount, LoginResponse, StarsListResult, User } from '@/api/types';
import type { HttpCtx } from './http-ctx';

export class AuthApi {
  constructor(private readonly ctx: HttpCtx) {}

  async register(params: { username: string; password: string }): Promise<ApiResponse<LoginResponse>> {
    const res = await this.ctx.apiRequest<LoginResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(params),
    });
    // 凭证由服务端 Set-Cookie (httpOnly);清理历史 localStorage
    this.ctx.clearLegacyTokenStorage();
    return res;
  }

  async login(params: { username: string; password: string }): Promise<ApiResponse<LoginResponse>> {
    const res = await this.ctx.apiRequest<LoginResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(params),
    });
    this.ctx.clearLegacyTokenStorage();
    return res;
  }

  async logout(): Promise<ApiResponse<{ success: boolean }>> {
    try {
      // Cookie 中的 refresh 由服务端读取并吊销
      await this.ctx.apiRequest('/auth/logout', {
        method: 'POST',
        body: JSON.stringify({}),
      });
    } finally {
      this.ctx.clearLegacyTokenStorage();
    }
    return { data: { success: true }, meta: { ts: Date.now() } };
  }

  async refresh(): Promise<ApiResponse<{ access_token: string; refresh_token?: string }>> {
    const res = await this.ctx.apiRequest<{ access_token: string; refresh_token?: string }>(
      '/auth/refresh',
      {
        method: 'POST',
        body: JSON.stringify({}),
      }
    );
    this.ctx.clearLegacyTokenStorage();
    return res;
  }

  async me(): Promise<ApiResponse<User>> {
    return this.ctx.apiRequest<User>('/auth/me');
  }

  async updateProfile(data: Partial<User>): Promise<ApiResponse<User>> {
    return this.ctx.apiRequest<User>('/auth/me', {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async changePassword(params: { old_password: string; new_password: string }): Promise<ApiResponse<{ success: boolean }>> {
    await this.ctx.apiRequest('/auth/password', {
      method: 'PUT',
      body: JSON.stringify(params),
    });
    return { data: { success: true }, meta: { ts: Date.now() } };
  }

  async listGithubAccounts(): Promise<ApiResponse<GitHubAccount[]>> {
    return this.ctx.apiRequest<GitHubAccount[]>('/github/accounts');
  }

  async bindGithub(params: { username: string; pat: string }): Promise<ApiResponse<GitHubAccount>> {
    return this.ctx.apiRequest<GitHubAccount>('/github/bindaccount', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  async unbindGithub(id: string): Promise<ApiResponse<{ success: boolean }>> {
    return this.ctx.apiRequest(`/github/accounts/${id}`, { method: 'DELETE' });
  }

  async listStars(params?: { username?: string; refresh?: boolean }): Promise<ApiResponse<StarsListResult>> {
    return this.ctx.apiRequest<StarsListResult>('/github/stars', {}, {
      username: params?.username,
      refresh: params?.refresh ? 'true' : undefined,
    });
  }
}
