export interface User {
  id: string;
  username: string;
  email?: string;
  avatar_url?: string;
  github_accounts: Array<{ email: string; github_id: string }>;
  created_at?: number;
}

export interface LoginRequest {
  username: string;
  password: string;
  remember_me?: boolean;
}

export interface RegisterRequest {
  username: string;
  password: string;
  email?: string;
}
