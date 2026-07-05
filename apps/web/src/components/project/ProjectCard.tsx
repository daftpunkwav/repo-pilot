import { PROGRESS_LABELS, PROGRESS_OPTIONS } from "../../utils/constants";
import type { Project } from "../../types/project";
import { useNavigate } from "react-router-dom";

interface ProjectCardProps {
  project: Project;
}

export function ProjectCard({ project }: ProjectCardProps) {
  const navigate = useNavigate();
  return (
    <div onClick={() => navigate(`/projects/${project.id}`)} className="p-4 bg-surface border border-border rounded cursor-pointer hover:border-primary transition">
      <h3 className="font-medium truncate">{project.name}</h3>
      <p className="text-sm text-muted mt-1 line-clamp-2">{project.description}</p>
      <div className="mt-3 flex items-center justify-between text-xs text-muted">
        <span>{project.language || "未知语言"}</span>
        <span>{PROGRESS_LABELS[project.progress as keyof typeof PROGRESS_LABELS] || project.progress}</span>
      </div>
    </div>
  );
}
