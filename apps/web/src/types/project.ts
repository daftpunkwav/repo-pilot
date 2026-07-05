export interface User {
  id: string;
  username: string;
  email?: string;
  avatar_url?: string;
  github_accounts: Array<{ email: string; github_id: string }>;
  created_at?: number;
}

export interface Project {
  id: string;
  user_id: string;
  name: string;
  url: string;
  description?: string;
  stars: number;
  language?: string;
  progress: string;
  note?: string;
  category?: string;
  tags: string[];
  created_at?: string;
  updated_at?: string;
}

export const PROGRESS_OPTIONS = ["none", "learning", "learned", "mastered"] as const;
export type ProgressOption = (typeof PROGRESS_OPTIONS)[number];

export const PROGRESS_LABELS: Record<ProgressOption, string> = {
  none: "未学习",
  learning: "正在学习",
  learned: "已经学习",
  mastered: "熟练掌握",
};
