export const PROGRESS_OPTIONS = ["none", "learning", "learned", "mastered"] as const;
export const PROGRESS_LABELS: Record<string, string> = {
  none: "未学习",
  learning: "正在学习",
  learned: "已经学习",
  mastered: "熟练掌握",
};
