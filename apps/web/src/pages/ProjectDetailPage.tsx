import { useParams } from "react-router-dom";
import { api } from "../api/client";
import { PROGRESS_LABELS } from "../types/project";

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [name, setName] = useState("加载中...");
  const [description, setDescription] = useState("");
  const [progress, setProgress] = useState("none");

  useEffect(() => {
    api.get(`/projects/${id}`).then((res) => {
      const data = res as { data: import("../types/project").Project };
      setName(data.data.name);
      setDescription(data.data.description || "");
      setProgress(data.data.progress);
    });
  }, [id]);

  const updateProgress = async (newProgress: string) => {
    await api.put(`/projects/${id}/progress?progress=${newProgress}`);
    setProgress(newProgress);
  };

  return (
    <div className="min-h-screen">
      <header className="px-6 py-4 border-b border-border flex items-center justify-between">
        <h1 className="text-lg font-semibold">{name}</h1>
        <span className="text-sm text-muted">{PROGRESS_LABELS[progress as keyof typeof PROGRESS_LABELS] || progress}</span>
      </header>
      <main className="p-6 max-w-3xl">
        <p className="text-muted whitespace-pre-wrap">{description || "暂无描述"}</p>
        <div className="mt-6">
          <h2 className="text-sm font-medium mb-2">学习进度</h2>
          <div className="flex gap-2">
            {["none", "learning", "learned", "mastered"].map((p) => (
              <button
                key={p}
                onClick={() => updateProgress(p)}
                className={`px-3 py-1 rounded border text-sm ${
                  progress === p ? "border-primary bg-primary/10" : "border-border hover:border-primary"
                }`}
              >
                {PROGRESS_LABELS[p as keyof typeof PROGRESS_LABELS] || p}
              </button>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
