import type { Category } from '@/api/types';

export const MOCK_CATEGORIES: Category[] = [
  { id: 'cat_frontend', name: 'Web 前端', icon: 'layout', color: '#007aff', is_preset: true },
  { id: 'cat_backend', name: 'Web 后端', icon: 'server', color: '#34c759', is_preset: true },
  { id: 'cat_ai', name: 'AI / 机器学习', icon: 'brain', color: '#ff3b30', is_preset: true },
  { id: 'cat_data', name: '数据科学', icon: 'bar-chart', color: '#ff9f0a', is_preset: true },
  { id: 'cat_devops', name: 'DevOps / 运维', icon: 'cloud', color: '#5e5ce6', is_preset: true },
  { id: 'cat_mobile', name: '移动开发', icon: 'smartphone', color: '#30d158', is_preset: true },
  { id: 'cat_desktop', name: '桌面应用', icon: 'monitor', color: '#007aff', is_preset: true },
  { id: 'cat_game', name: '游戏开发', icon: 'gamepad', color: '#ff375f', is_preset: true },
  { id: 'cat_security', name: '安全', icon: 'shield', color: '#bf5af2', is_preset: true },
  { id: 'cat_tools', name: '工具 / 库', icon: 'wrench', color: '#8e8e93', is_preset: true },
  { id: 'cat_learning', name: '学习资源', icon: 'book', color: '#ff9f0a', is_preset: true },
  { id: 'cat_other', name: '其他', icon: 'folder', color: '#6e6e73', is_preset: true },
];
