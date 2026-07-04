import { useState } from 'react';
import { useCreateProject, useImportProjects } from '@/hooks/useProjects';
import { useUIStore } from '@/stores/uiStore';
import { validateGithubUrls } from '@/utils/validators';

interface ImportUrlsModalProps {
  open: boolean;
  onClose: () => void;
}

export function ImportUrlsModal({ open, onClose }: ImportUrlsModalProps) {
  const [text, setText] = useState('');
  const importMutation = useImportProjects();
  const createMutation = useCreateProject();
  const addToast = useUIStore((s) => s.addToast);

  if (!open) return null;

  const { valid, invalid } = validateGithubUrls(text);

  const handleImport = async () => {
    if (valid.length === 0) {
      addToast({ type: 'warning', message: '没有有效的 URL' });
      return;
    }
    try {
      const result = await importMutation.mutateAsync(
        valid.map((v) => ({ owner: v.owner, repo: v.repo, url: v.url }))
      );
      addToast({ type: 'success', message: result.summary });
      setText('');
      onClose();
    } catch {
      // 逐条 create 作为降级
      let ok = 0;
      for (const v of valid) {
        try {
          await createMutation.mutateAsync({ name: v.name, url: v.url });
          ok += 1;
        } catch {
          // 重复等错误跳过
        }
      }
      addToast({ type: ok > 0 ? 'success' : 'error', message: `成功 ${ok} 条` });
      onClose();
    }
  };

  return (
    <div className="modal-overlay" role="presentation" onClick={onClose}>
      <div className="modal glass modal--wide" role="dialog" onClick={(e) => e.stopPropagation()}>
        <h3 className="modal__title">批量粘贴 URL</h3>
        <p className="modal__hint">每行一个 GitHub 仓库 URL</p>
        <textarea
          className="input textarea"
          rows={8}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="https://github.com/owner/repo"
        />
        <p className="modal__preview">
          有效 {valid.length} 行，无效 {invalid.length} 行
        </p>
        <div className="modal__actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            取消
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={importMutation.isPending}
            onClick={handleImport}
          >
            确认导入
          </button>
        </div>
      </div>
    </div>
  );
}
