/** 节点类型 / 状态着色（对齐参考仓，适配 RepoPilot token） */
const LABEL_COLORS: Record<string, string> = {
  Project: '#ef4444',
  Branch: '#64748b',
  Folder: '#22c55e',
  File: '#06b6d4',
  Module: '#f59e0b',
  Class: '#a855f7',
  Interface: '#8b5cf6',
  Method: '#3b82f6',
  Function: '#60a5fa',
  Variable: '#fb923c',
  Type: '#ec4899',
  Route: '#eab308',
  Decorator: '#7c3aed',
  Section: '#94a3b8',
  EnvVar: '#14b8a6',
};

const STATUS_COLORS: Record<string, string> = {
  dead: '#ef4444',
  single: '#f97316',
  entry: '#22c55e',
  test: '#06b6d4',
  exported: '#3b82f6',
  normal: '#94a3b8',
  structural: '#64748b',
};

export function colorForLabel(label: string): string {
  return LABEL_COLORS[label] || '#60a5fa';
}

export function colorForStatus(status: string): string {
  return STATUS_COLORS[status] || '#94a3b8';
}

export const STATUS_LEGEND = Object.keys(STATUS_COLORS);
