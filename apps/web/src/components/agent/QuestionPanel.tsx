import { useState } from 'react';
import type {
  AgentQuestion,
  CheckboxQuestion,
  DragSortQuestion,
  KnowledgeMapQuestion,
  QuestionAnswer,
  QuestionItem,
  RadioQuestion,
  SliderQuestion,
} from '@/api/types';
import { MarkdownRenderer } from '@/components/common/MarkdownRenderer';

interface QuestionPanelProps {
  question: AgentQuestion;
  onSubmit: (answers: QuestionAnswer[]) => void;
  onSkip?: () => void;
}

/** 检查某题是否已有效回答 */
function isAnswered(answer: QuestionAnswer | undefined): boolean {
  if (!answer) return false;
  switch (answer.type) {
    case 'radio':
      return Boolean(answer.value);
    case 'checkbox':
      return Array.isArray(answer.values) && answer.values.length > 0;
    case 'knowledge_map':
      return Array.isArray(answer.checked) && answer.checked.length > 0;
    case 'slider':
      return typeof answer.value === 'number';
    case 'drag_sort':
      return Array.isArray(answer.order) && answer.order.length > 0;
    default:
      return false;
  }
}

export function QuestionPanel({ question, onSubmit, onSkip }: QuestionPanelProps) {
  const [answers, setAnswers] = useState<Record<string, QuestionAnswer>>({});
  const [invalidIds, setInvalidIds] = useState<Set<string>>(new Set());

  const handleChange = (id: string, answer: QuestionAnswer) => {
    setAnswers((prev) => ({ ...prev, [id]: answer }));
    if (isAnswered(answer)) {
      setInvalidIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const handleSubmit = () => {
    const missing = question.questions.filter((q) => !isAnswered(answers[q.id])).map((q) => q.id);
    if (missing.length > 0) {
      setInvalidIds(new Set(missing));
      return;
    }
    setInvalidIds(new Set());
    onSubmit(Object.values(answers));
  };

  return (
    <div className="question-panel glass" data-testid="question-panel">
      <MarkdownRenderer content={question.intro.content} />
      {question.questions.map((q) => (
        <QuestionItemRenderer
          key={q.id}
          item={q}
          invalid={invalidIds.has(q.id)}
          onChange={(a) => handleChange(q.id, a)}
        />
      ))}
      {invalidIds.size > 0 && (
        <p className="question-panel__error">请回答所有必填问题后再提交</p>
      )}
      <div className="question-panel__actions">
        <button type="button" className="btn btn-primary" onClick={handleSubmit}>
          {question.actions.submit.text}
        </button>
        {question.allow_skip && question.actions.skip && onSkip && (
          <button type="button" className="btn btn-ghost" onClick={onSkip}>
            {question.actions.skip.text}
          </button>
        )}
      </div>
    </div>
  );
}

function QuestionItemRenderer({
  item,
  invalid,
  onChange,
}: {
  item: QuestionItem;
  invalid: boolean;
  onChange: (a: QuestionAnswer) => void;
}) {
  const className = invalid ? 'question-item question-item--invalid' : 'question-item';
  switch (item.type) {
    case 'radio':
      return <RadioItem item={item} className={className} onChange={onChange} />;
    case 'checkbox':
      return <CheckboxItem item={item} className={className} onChange={onChange} />;
    case 'slider':
      return <SliderItem item={item} className={className} onChange={onChange} />;
    case 'drag_sort':
      return <DragSortItem item={item} className={className} onChange={onChange} />;
    case 'knowledge_map':
      return <KnowledgeMapItem item={item} className={className} onChange={onChange} />;
    default:
      return null;
  }
}

function RadioItem({
  item,
  className,
  onChange,
}: {
  item: RadioQuestion;
  className: string;
  onChange: (a: QuestionAnswer) => void;
}) {
  const [other, setOther] = useState('');
  return (
    <fieldset className={className}>
      <legend>{item.text}</legend>
      {item.options.map((o) => (
        <label key={o.value} className="question-item__option">
          <input
            type="radio"
            name={item.id}
            value={o.value}
            onChange={() =>
              onChange({ type: 'radio', value: o.value, other_text: other || undefined })
            }
          />
          {o.label}
        </label>
      ))}
      {item.allow_other && (
        <input
          className="input"
          placeholder="其他…"
          value={other}
          onChange={(e) => {
            setOther(e.target.value);
            onChange({ type: 'radio', value: '__other__', other_text: e.target.value });
          }}
        />
      )}
    </fieldset>
  );
}

function CheckboxItem({
  item,
  className,
  onChange,
}: {
  item: CheckboxQuestion;
  className: string;
  onChange: (a: QuestionAnswer) => void;
}) {
  const [values, setValues] = useState<string[]>([]);
  const toggle = (v: string) => {
    const next = values.includes(v) ? values.filter((x) => x !== v) : [...values, v];
    setValues(next);
    onChange({ type: 'checkbox', values: next });
  };
  return (
    <fieldset className={className}>
      <legend>{item.text}</legend>
      {item.options.map((o) => (
        <label key={o.value} className="question-item__option">
          <input
            type="checkbox"
            checked={values.includes(o.value)}
            onChange={() => toggle(o.value)}
          />
          {o.text}
        </label>
      ))}
    </fieldset>
  );
}

function SliderItem({
  item,
  className,
  onChange,
}: {
  item: SliderQuestion;
  className: string;
  onChange: (a: QuestionAnswer) => void;
}) {
  const mid = Math.floor((item.min + item.max) / 2);
  const [value, setValue] = useState(mid);
  return (
    <div className={className}>
      <label>{item.text}</label>
      <input
        type="range"
        min={item.min}
        max={item.max}
        value={value}
        onChange={(e) => {
          const v = Number(e.target.value);
          setValue(v);
          onChange({ type: 'slider', value: v });
        }}
      />
      <span>{item.labels?.[String(value)] ?? value}</span>
    </div>
  );
}

function DragSortItem({
  item,
  className,
  onChange,
}: {
  item: DragSortQuestion;
  className: string;
  onChange: (a: QuestionAnswer) => void;
}) {
  const [order, setOrder] = useState([...item.items]);

  const move = (from: number, to: number) => {
    const next = [...order];
    const [removed] = next.splice(from, 1);
    if (removed) {
      next.splice(to, 0, removed);
      setOrder(next);
      onChange({ type: 'drag_sort', order: next });
    }
  };

  return (
    <div className={className}>
      <p>{item.text}</p>
      <ul className="drag-sort-list">
        {order.map((label, i) => (
          <li key={label} className="drag-sort-list__item">
            <span>{label}</span>
            <button type="button" disabled={i === 0} onClick={() => move(i, i - 1)}>
              ↑
            </button>
            <button
              type="button"
              disabled={i === order.length - 1}
              onClick={() => move(i, i + 1)}
            >
              ↓
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function KnowledgeMapItem({
  item,
  className,
  onChange,
}: {
  item: KnowledgeMapQuestion;
  className: string;
  onChange: (a: QuestionAnswer) => void;
}) {
  const [checked, setChecked] = useState<string[]>([]);

  const toggle = (id: string) => {
    const next = checked.includes(id) ? checked.filter((x) => x !== id) : [...checked, id];
    setChecked(next);
    onChange({ type: 'knowledge_map', checked: next });
  };

  return (
    <div className={className}>
      <p>{item.text}</p>
      <TreeNodes nodes={item.tree} checked={checked} onToggle={toggle} depth={0} />
    </div>
  );
}

function TreeNodes({
  nodes,
  checked,
  onToggle,
  depth,
}: {
  nodes: KnowledgeMapQuestion['tree'];
  checked: string[];
  onToggle: (id: string) => void;
  depth: number;
}) {
  return (
    <ul className="knowledge-tree" style={{ paddingLeft: depth * 16 }}>
      {nodes.map((n) => (
        <li key={n.id}>
          <label>
            <input
              type="checkbox"
              checked={checked.includes(n.id)}
              onChange={() => onToggle(n.id)}
            />
            {n.label}
          </label>
          {n.children && n.children.length > 0 && (
            <TreeNodes
              nodes={n.children}
              checked={checked}
              onToggle={onToggle}
              depth={depth + 1}
            />
          )}
        </li>
      ))}
    </ul>
  );
}
