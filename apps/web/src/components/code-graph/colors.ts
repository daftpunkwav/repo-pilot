/** 节点类型 / 状态着色 —— 对齐 CBM graph-ui/src/lib/colors.ts 并扩展 */
const LABEL_COLORS: Record<string, string> = {
  Project: '#e11d48',
  Package: '#f97316',
  Module: '#f97316',
  Folder: '#22c55e',
  File: '#3b82f6',
  Class: '#a855f7',
  Interface: '#a855f7',
  Function: '#06b6d4',
  Method: '#06b6d4',
  Variable: '#94a3b8',
  Type: '#94a3b8',
  Route: '#eab308',
  Decorator: '#64748b',
  Section: '#cbd5e1',
  Branch: '#64748b',
  EnvVar: '#14b8a6',
};

const STATUS_COLORS: Record<string, string> = {
  dead: '#ef4444',
  single: '#f97316',
  entry: '#3b82f6',
  test: '#a855f7',
  exported: '#475569',
  normal: '#22c55e',
  structural: '#334155',
};

export function colorForLabel(label: string): string {
  if (!label) return '#94a3b8';
  /* 大小写不敏感匹配 */
  const hit = LABEL_COLORS[label] || LABEL_COLORS[label[0]!.toUpperCase() + label.slice(1)];
  return hit || '#94a3b8';
}

export function colorForStatus(status: string): string {
  return STATUS_COLORS[status] || '#334155';
}

export const STATUS_LEGEND = Object.keys(STATUS_COLORS);

export const LABEL_COLOR_ENTRIES = Object.entries(LABEL_COLORS);
