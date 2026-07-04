import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent } from 'react';
import { Link } from 'react-router-dom';
import { AgentAvatar, type LookTarget } from '@/components/agent/AgentAvatar';
import {
  AGENT_CAROUSEL_INTERVAL_MS,
  AGENT_CAROUSEL_TRANSITION_MS,
  AGENT_CAROUSEL_VISIBLE,
  AGENT_CATALOG,
  type AgentDefinition,
} from '@/constants/agentCatalog';

const GAP_PX = 12;
const MOBILE_BREAKPOINT_PX = 1200;
const MOBILE_VISIBLE_COUNT = 2;
/** 轮播卡片头像尺寸（54px × 1.2） */
const AGENT_AVATAR_SIZE = Math.round(54 * 1.2);

function useResponsiveVisibleCount(defaultCount: number) {
  const [count, setCount] = useState(defaultCount);

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT_PX}px)`);
    const update = () => setCount(mq.matches ? MOBILE_VISIBLE_COUNT : defaultCount);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, [defaultCount]);

  return count;
}

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  return reduced;
}

function cardLookPoint(rect: DOMRect): LookTarget {
  return {
    x: rect.left + rect.width * 0.22,
    y: rect.top + rect.height * 0.42,
  };
}

interface AgentCarouselProps {
  agents?: AgentDefinition[];
  visibleCount?: number;
}

export function AgentCarousel({
  agents = AGENT_CATALOG,
  visibleCount = AGENT_CAROUSEL_VISIBLE,
}: AgentCarouselProps) {
  const resolvedVisible = useResponsiveVisibleCount(visibleCount);
  const prefersReducedMotion = usePrefersReducedMotion();
  const viewportRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [noTransition, setNoTransition] = useState(false);
  const [stepPx, setStepPx] = useState(0);
  const [lookTarget, setLookTarget] = useState<LookTarget | null>(null);
  const [focusedAgentId, setFocusedAgentId] = useState<string | null>(null);

  const loopAgents = useMemo(
    () => (agents.length > resolvedVisible ? [...agents, ...agents] : agents),
    [agents, resolvedVisible],
  );

  const canScroll = agents.length > resolvedVisible && !prefersReducedMotion;

  useEffect(() => {
    setIndex(0);
    setNoTransition(false);
  }, [resolvedVisible, agents.length]);

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const measure = () => {
      const width = viewport.clientWidth;
      const cardWidth = (width - GAP_PX * (resolvedVisible - 1)) / resolvedVisible;
      setStepPx(cardWidth + GAP_PX);
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [resolvedVisible]);

  useEffect(() => {
    if (!canScroll || paused) return;

    const timer = window.setInterval(() => {
      setIndex((prev) => prev + 1);
    }, AGENT_CAROUSEL_INTERVAL_MS);

    return () => window.clearInterval(timer);
  }, [canScroll, paused, agents.length]);

  useEffect(() => {
    if (!canScroll || index !== agents.length) return;

    const resetTimer = window.setTimeout(() => {
      setNoTransition(true);
      setIndex(0);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setNoTransition(false));
      });
    }, AGENT_CAROUSEL_TRANSITION_MS);

    return () => window.clearTimeout(resetTimer);
  }, [index, agents.length, canScroll]);

  const handleCarouselLeave = () => {
    setPaused(false);
    setLookTarget(null);
    setFocusedAgentId(null);
  };

  const handleCardEnter = (event: MouseEvent<HTMLAnchorElement>, agentId: string) => {
    setPaused(true);
    setFocusedAgentId(agentId);
    setLookTarget(cardLookPoint(event.currentTarget.getBoundingClientRect()));
  };

  const offsetPx = canScroll ? index * stepPx : 0;

  return (
    <section
      className="agent-carousel"
      aria-label="Agent 入口"
      style={{ '--agent-visible': resolvedVisible, '--agent-gap': `${GAP_PX}px` } as CSSProperties}
      onMouseLeave={handleCarouselLeave}
    >
      <div className="agent-carousel-viewport" ref={viewportRef}>
        <div
          className="agent-carousel-track"
          style={{
            transform: `translateX(-${offsetPx}px)`,
            transition: noTransition
              ? 'none'
              : `transform ${AGENT_CAROUSEL_TRANSITION_MS}ms var(--ease)`,
          }}
        >
          {loopAgents.map((agent, i) => (
            <Link
              key={`${agent.id}-${i}`}
              className="agent-carousel-card"
              to={`/agent?agent=${agent.id}`}
              onMouseEnter={(e) => handleCardEnter(e, agent.id)}
            >
              <div className="agent-card-meta">
                <AgentAvatar
                  agentId={agent.id}
                  lookTarget={lookTarget}
                  isFocused={focusedAgentId === agent.id}
                  size={AGENT_AVATAR_SIZE}
                />
                <div className="agent-name">{agent.name}</div>
              </div>
              <div className="agent-card-body">
                <p className="agent-card-tagline">{agent.tagline}</p>
                <p className="agent-card-intro">{agent.intro}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
