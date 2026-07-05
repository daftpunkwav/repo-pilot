import { AgentQuestion } from "../../types/agent";
import { Button } from "../ui/Button";

interface QuestionRendererProps {
  question: AgentQuestion;
  onSubmit: (answers: Record<string, unknown>, skipped: boolean) => void;
}

export function QuestionRenderer({ question, onSubmit }: QuestionRendererProps) {
  return (
    <div className="border border-border rounded-lg p-4 bg-surface">
      <p className="text-sm mb-3">{question.intro.content}</p>
      <div className="space-y-2">
        {question.questions.map((q) => (
          <div key={q.id} className="text-sm">
            <div className="mb-1">{q.text}</div>
            {q.type === "radio" && q.options && (
              <div className="space-y-1">
                {q.options.map((opt) => (
                  <label key={opt.value} className="flex items-center gap-2">
                    <input type="radio" name={q.id} value={opt.value} onChange={() => onSubmit({ [q.id]: opt.value }, false)} />
                    <span>{opt.text}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="mt-4 flex gap-2">
        <Button onClick={() => onSubmit({}, true)} variant="ghost">跳过，用默认深度讲解</Button>
      </div>
    </div>
  );
}
