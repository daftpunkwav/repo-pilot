import type { User } from '@/api/types';

/** 本机 mock 身份。 */
export const MOCK_LOCAL_USER: User = {
  id: 'local',
  username: '小明',
  github_login: 'zhang-jie',
  github_bound: true,
  created_at: '2026-05-12T10:00:00Z',
};
