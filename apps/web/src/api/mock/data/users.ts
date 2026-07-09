import type { User } from '@/api/types';

export interface MockUserRecord {
  user: User;
  password: string;
}

export const MOCK_USERS: MockUserRecord[] = [
  {
    password: 'demo1234',
    user: {
      id: 'usr_zhang_jie',
      username: 'zhang.jie',
      email: 'zhang.jie@example.com',
      avatar_url: 'https://avatars.githubusercontent.com/u/1?v=4',
      github_login: 'zhang-jie',
      github_bound: true,
      created_at: '2026-05-12T10:00:00Z',
    },
  },
  {
    password: 'test1234',
    user: {
      id: 'usr_test',
      username: 'testuser',
      email: 'test@example.com',
      github_bound: false,
      created_at: '2026-06-01T08:00:00Z',
    },
  },
];

export function findMockUser(username: string): MockUserRecord | undefined {
  return MOCK_USERS.find((r) => r.user.username === username);
}
