import type { ProjectProgress } from '@/api/types';

const LABELS: Record<ProjectProgress, string> = {
  none: '未开始',
  learning: '学习中',
  learned: '已掌握',
  mastered: '精通',
};

const CLASS_MAP: Record<ProjectProgress, string> = {
  none: 'progress-badge--none',
  learning: 'progress-badge--learning',
  learned: 'progress-badge--learned',
  mastered: 'progress-badge--mastered',
};

interface ProgressBadgeProps {
  progress: ProjectProgress;
}

export function ProgressBadge({ progress }: ProgressBadgeProps) {
  return (
    <span className={`progress-badge ${CLASS_MAP[progress]}`}>{LABELS[progress]}</span>
  );
}
