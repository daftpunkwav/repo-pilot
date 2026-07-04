import { useEffect, useMemo, useState } from 'react';
import type { Category, Project, Tag } from '@/api/types';
import { useProjectStore } from '@/stores/projectStore';

interface FilterBarProps {
  categories: Category[];
  tags: Tag[];
  languages: string[];
}

export function FilterBar({ categories, languages }: FilterBarProps) {
  const search = useProjectStore((s) => s.search);
  const setSearch = useProjectStore((s) => s.setSearch);
  const categoryId = useProjectStore((s) => s.categoryId);
  const setCategoryId = useProjectStore((s) => s.setCategoryId);
  const language = useProjectStore((s) => s.language);
  const setLanguage = useProjectStore((s) => s.setLanguage);
  const progress = useProjectStore((s) => s.progress);
  const setProgress = useProjectStore((s) => s.setProgress);
  const sortBy = useProjectStore((s) => s.sortBy);
  const setSortBy = useProjectStore((s) => s.setSortBy);
  const resetFilters = useProjectStore((s) => s.resetFilters);
  const [localSearch, setLocalSearch] = useState(search);

  useEffect(() => {
    const t = setTimeout(() => setSearch(localSearch), 300);
    return () => clearTimeout(t);
  }, [localSearch, setSearch]);

  const categoryLabelText = categoryId
    ? `分类：${categories.find((c) => c.id === categoryId)?.name ?? categoryId}`
    : '分类：全部';
  const languageLabel = language ? `语言：${language}` : '语言：全部';
  const progressLabelText = progress ? `进度：${progress}` : '进度：全部';
  const sortLabel =
    sortBy === 'stars'
      ? '排序：Stars'
      : sortBy === 'name'
        ? '排序：名称'
        : sortBy === 'imported_at'
          ? '排序：导入时间'
          : '排序：最近更新';

  const langs = useMemo(() => {
    if (languages.length > 0) return languages;
    return [];
  }, [languages]);

  return (
    <div className="filter-bar" role="toolbar" aria-label="项目筛选">
      <div className="filter-search">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width={14} height={14}>
          <circle cx="11" cy="11" r="7" />
          <path d="M21 21l-4.3-4.3" />
        </svg>
        <input
          type="text"
          placeholder="筛选当前列表：项目名 / 描述 / 标签"
          value={localSearch}
          onChange={(e) => setLocalSearch(e.target.value)}
        />
      </div>

      <label className="filter-btn">
        <span>{categoryLabelText}</span>
        <select
          className="filter-native-select"
          value={categoryId ?? ''}
          onChange={(e) => setCategoryId(e.target.value || null)}
          aria-label="分类筛选"
        >
          <option value="">全部分类</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>

      <label className="filter-btn">
        <span>{languageLabel}</span>
        <select
          className="filter-native-select"
          value={language ?? ''}
          onChange={(e) => setLanguage(e.target.value || null)}
          aria-label="语言筛选"
        >
          <option value="">全部语言</option>
          {langs.map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </select>
      </label>

      <label className="filter-btn">
        <span>{progressLabelText}</span>
        <select
          className="filter-native-select"
          value={progress ?? ''}
          onChange={(e) =>
            setProgress((e.target.value || null) as Project['progress'] | null)
          }
          aria-label="进度筛选"
        >
          <option value="">全部进度</option>
          <option value="none">待开始</option>
          <option value="learning">学习中</option>
          <option value="learned">已学习</option>
          <option value="mastered">已掌握</option>
        </select>
      </label>

      <label className="filter-btn" style={{ marginLeft: 'auto' }}>
        <span>{sortLabel}</span>
        <select
          className="filter-native-select"
          value={sortBy}
          onChange={(e) =>
            setSortBy(e.target.value as 'name' | 'stars' | 'imported_at' | 'updated_at')
          }
          aria-label="排序"
        >
          <option value="updated_at">最近更新</option>
          <option value="imported_at">导入时间</option>
          <option value="stars">Stars</option>
          <option value="name">名称</option>
        </select>
      </label>

      <button type="button" className="filter-clear" onClick={resetFilters}>
        清除筛选
      </button>
    </div>
  );
}

export function useProjectLanguages(projects: Project[]): string[] {
  return useMemo(() => {
    const set = new Set<string>();
    for (const p of projects) {
      if (p.language) set.add(p.language);
    }
    return Array.from(set).sort();
  }, [projects]);
}
