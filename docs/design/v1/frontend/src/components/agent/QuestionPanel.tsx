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

export function QuestionPanel({ question, onSubmit, onSkip }: QuestionPanelProps) {
  const [answers, setAnswers] = useState<Record<string, QuestionAnswer>>({});

  const handleSubmit = () => {
    onSubmit(Object.values(answers));
  };

  return (
    <div className="question-panel glass" data-testid="question-panel">
      <MarkdownRenderer content={question.intro.content} />
      {question.questions.map((q) => (
        <QuestionItemRenderer
          key={q.id}
          item={q}
          onChange={(a) => setAnswers((prev) => ({ ...prev, [q.id]: a }))}
        />
      ))}
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
  onChange,
}: {
  item: QuestionItem;
  onChange: (a: QuestionAnswer) => void;
}) {
  switch (item.type) {
    case 'radio':
      return <RadioItem item={item} onChange={onChange} />;
    case 'checkbox':
      return <CheckboxItem item={item} onChange={onChange} />;
    case 'slider':
      return <SliderItem item={item} onChange={onChange} />;
    case 'drag_sort':
      return <DragSortItem item={item} onChange={onChange} />;
    case 'knowledge_map':
      return <KnowledgeMapItem item={item} onChange={onChange} />;
    default:
      return null;
  }
}

function RadioItem({
  item,
  onChange,
}: {
  item: RadioQuestion;
  onChange: (a: QuestionAnswer) => void;
}) {
  const [other, setOther] = useState('');
  return (
    <fieldset className="question-item">
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
  onChange,
}: {
  item: CheckboxQuestion;
  onChange: (a: QuestionAnswer) => void;
}) {
  const [values, setValues] = useState<string[]>([]);
  const toggle = (v: string) => {
    const next = values.includes(v) ? values.filter((x) => x !== v) : [...values, v];
    setValues(next);
    onChange({ type: 'checkbox', values: next });
  };
  return (
    <fieldset className="question-item">
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
  onChange,
}: {
  item: SliderQuestion;
  onChange: (a: QuestionAnswer) => void;
}) {
  const mid = Math.floor((item.min + item.max) / 2);
  const [value, setValue] = useState(mid);
  return (
    <div className="question-item">
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
  onChange,
}: {
  item: DragSortQuestion;
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
    <div className="question-item">
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
  onChange,
}: {
  item: KnowledgeMapQuestion;
  onChange: (a: QuestionAnswer) => void;
}) {
  const [checked, setChecked] = useState<string[]>([]);

  const toggle = (id: string) => {
    const next = checked.includes(id) ? checked.filter((x) => x !== id) : [...checked, id];
    setChecked(next);
    onChange({ type: 'knowledge_map', checked: next });
  };

  return (
    <div className="question-item">
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
