import { useEffect, useMemo, useState } from 'react';
import type { Category, Project, Tag } from '@/api/types';
import { useProjectStore } from '@/stores/projectStore';

interface FilterBarProps {
  categories: Category[];
  tags: Tag[];
  languages: string[];
}

export function FilterBar({ categories, tags, languages }: FilterBarProps) {
  const search = useProjectStore((s) => s.search);
  const setSearch = useProjectStore((s) => s.setSearch);
  const categoryId = useProjectStore((s) => s.categoryId);
  const setCategoryId = useProjectStore((s) => s.setCategoryId);
  const language = useProjectStore((s) => s.language);
  const setLanguage = useProjectStore((s) => s.setLanguage);
  const progress = useProjectStore((s) => s.progress);
  const setProgress = useProjectStore((s) => s.setProgress);
  const tagId = useProjectStore((s) => s.tagId);
  const setTagId = useProjectStore((s) => s.setTagId);
  const sortBy = useProjectStore((s) => s.sortBy);
  const setSortBy = useProjectStore((s) => s.setSortBy);
  const sortOrder = useProjectStore((s) => s.sortOrder);
  const setSortOrder = useProjectStore((s) => s.setSortOrder);

  const [localSearch, setLocalSearch] = useState(search);

  // 搜索防抖 300ms
  useEffect(() => {
    const t = setTimeout(() => setSearch(localSearch), 300);
    return () => clearTimeout(t);
  }, [localSearch, setSearch]);

  return (
    <div className="filter-bar">
      <input
        className="input filter-bar__search"
        type="search"
        placeholder="搜索项目…"
        value={localSearch}
        onChange={(e) => setLocalSearch(e.target.value)}
      />
      <select
        className="input filter-bar__select"
        value={categoryId ?? ''}
        onChange={(e) => setCategoryId(e.target.value || null)}
      >
        <option value="">全部分类</option>
        {categories.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      <select
        className="input filter-bar__select"
        value={language ?? ''}
        onChange={(e) => setLanguage(e.target.value || null)}
      >
        <option value="">全部语言</option>
        {languages.map((l) => (
          <option key={l} value={l}>
            {l}
          </option>
        ))}
      </select>
      <select
        className="input filter-bar__select"
        value={progress ?? ''}
        onChange={(e) =>
          setProgress((e.target.value || null) as Project['progress'] | null)
        }
      >
        <option value="">全部进度</option>
        <option value="none">未开始</option>
        <option value="learning">学习中</option>
        <option value="learned">已掌握</option>
        <option value="mastered">精通</option>
      </select>
      <select
        className="input filter-bar__select"
        value={tagId ?? ''}
        onChange={(e) => setTagId(e.target.value || null)}
      >
        <option value="">全部标签</option>
        {tags.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>
      <select
        className="input filter-bar__select"
        value={sortBy}
        onChange={(e) =>
          setSortBy(e.target.value as 'name' | 'stars' | 'imported_at' | 'updated_at')
        }
      >
        <option value="imported_at">导入时间</option>
        <option value="updated_at">更新时间</option>
        <option value="stars">Stars</option>
        <option value="name">名称</option>
      </select>
      <select
        className="input filter-bar__select"
        value={sortOrder}
        onChange={(e) => setSortOrder(e.target.value as 'asc' | 'desc')}
      >
        <option value="desc">降序</option>
        <option value="asc">升序</option>
      </select>
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
