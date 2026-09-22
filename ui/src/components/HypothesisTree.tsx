import { m } from "../paraglide/messages.js";
import { fmtNumber } from "../i18n";
import {
  Background,
  BackgroundVariant,
  Handle,
  Position,
  ReactFlow,
  type Edge,
  type Node,
  type NodeProps,
  type Viewport,
} from "@xyflow/react";
import { FlaskConical, Link2 } from "lucide-react";
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import {
  runDisplayStatus,
  timeAgo,
  type Hypothesis,
  type HypothesisExperimentLink,
  type HypothesisSource,
  type Run,
} from "../api";
import { onTreeViewportMove } from "./ExpHoverCard";
import { sourceHref } from "./HypothesisOverview";
import { statusLabel, StatusBadge } from "./StatusBadge";

const NODE_W = 304;
const NODE_H = 148;
const GAP_X = 44;
const GAP_Y = 72;

type HypNodeData = {
  hypothesis: Hypothesis;
  runs: Run[];
  onSelect: (id: string) => void;
  onOpenExperiment: (experimentId: string) => void;
};

type FlowNode = Node<HypNodeData, "hypothesis">;

function links(hypothesis: Hypothesis, role: string): HypothesisExperimentLink[] {
  return hypothesis.experiments.filter((link) => link.role === role);
}

function labelLink(link: HypothesisExperimentLink): string {
  return link.experimentTitle?.trim() || link.experimentSlug || link.experimentId;
}

function runSquareClass(status: string): string {
  if (status === "done") return "pass";
  if (status === "failed" || status === "cancelled") return "fail";
  if (status === "running" || status === "starting" || status === "cancelling") return "live";
  return "other";
}

const HypNode = memo(function HypNode({ data }: NodeProps<FlowNode>) {
  const { hypothesis, runs, onSelect, onOpenExperiment } = data;
  const sourcesRef = useRef<HTMLButtonElement>(null);
  const experimentsRef = useRef<HTMLButtonElement>(null);
  const [menu, setMenu] = useState<"sources" | "experiments" | null>(null);
  const origins = links(hypothesis, "origin");
  const tests = links(hypothesis, "test");
  const latestByExperiment = new Map<string, Run>();
  for (const run of runs) {
    if (!tests.some((link) => link.experimentId === run.experimentId)) continue;
    const prev = latestByExperiment.get(run.experimentId);
    if (!prev || run.createdAt > prev.createdAt) latestByExperiment.set(run.experimentId, run);
  }
  const squares = [...latestByExperiment.values()].slice(0, 8);

  return (
    <div className="exp-node w-76 rounded-md border border-border bg-background px-3 py-2.5 text-sm shadow-tree">
      <Handle type="target" position={Position.Top} />
      <button
        type="button"
        className="nodrag block w-full border-0 bg-transparent p-0 text-start text-inherit"
        onClick={() => onSelect(hypothesis.id)}
      >
        <div className="mb-1.5 flex items-center justify-between gap-2 text-xs font-medium text-muted">
          <span>{hypothesis.parentHypothesisId ? m.hypothesis_child() : m.hypothesis_root()}</span>
          <StatusBadge status={hypothesis.status} />
        </div>
        <div className="truncate text-sm font-semibold text-text">{hypothesis.slug}</div>
        {(hypothesis.title || hypothesis.description) && (
          <div className="mt-1 line-clamp-2 text-sm text-text">{hypothesis.title || hypothesis.description}</div>
        )}
        <div className="mt-2 flex items-center gap-2 text-xs text-muted">
          <span>{m.hypothesis_source_count({ count: fmtNumber(hypothesis.sources.length) })}</span>
          <span>{m.hypothesis_origin_count({ count: fmtNumber(origins.length) })}</span>
          <span>{m.hypothesis_test_count({ count: fmtNumber(tests.length) })}</span>
          <span className="flex-1" />
          {squares.map((run) => (
            <span
              key={run.id}
              className={`h-[9px] w-[9px] shrink-0 [&.pass]:bg-accent-green [&.fail]:border-[1.5px] [&.fail]:border-danger-outline [&.live]:bg-accent-teal [&.other]:border-[1.5px] [&.other]:border-border ${runSquareClass(runDisplayStatus(run))}`}
              title={statusLabel(runDisplayStatus(run))}
            />
          ))}
          <span>{timeAgo(hypothesis.updatedAt)}</span>
        </div>
      </button>
      <div className="mt-2 flex items-center gap-[3px] border-t border-t-border-variant pt-1.5" onClick={(event) => event.stopPropagation()}>
        <button
          ref={sourcesRef}
          type="button"
          className="inline-flex items-center gap-[5px] rounded-sm px-1.5 py-[3px] text-sm font-medium text-text hover:bg-surface"
          aria-haspopup="menu"
          aria-expanded={menu === "sources"}
          onClick={() => setMenu((open) => (open === "sources" ? null : "sources"))}
        >
          <Link2 size={13} />
          {m.hypothesis_sources()}
        </button>
        <button
          ref={experimentsRef}
          type="button"
          className="inline-flex items-center gap-[5px] rounded-sm px-1.5 py-[3px] text-sm font-medium text-text hover:bg-surface"
          aria-haspopup="menu"
          aria-expanded={menu === "experiments"}
          onClick={() => setMenu((open) => (open === "experiments" ? null : "experiments"))}
        >
          <FlaskConical size={13} />
          {m.hypothesis_experiments()}
        </button>
      </div>
      <Handle type="source" position={Position.Bottom} />
      {menu === "sources" && (
        <PortalMenu
          triggerRef={sourcesRef}
          label={m.hypothesis_sources()}
          onClose={() => setMenu(null)}
        >
          {hypothesis.sources.length === 0 && origins.length === 0 ? (
            <div className="px-2 py-1.5 text-sm text-muted">{m.hypothesis_no_internet_sources()}</div>
          ) : (
            <>
              {hypothesis.sources.map((source) => (
                <SourceRow key={source.id} source={source} />
              ))}
              {origins.length === 0 ? (
                <div className="px-2 py-1.5 text-sm text-muted">{m.hypothesis_no_origin_experiments()}</div>
              ) : origins.map((link) => (
                <button
                  key={link.id}
                  type="button"
                  role="menuitem"
                  className="model-item flex w-full rounded-sm px-2 py-1 text-start text-sm text-text hover:bg-surface"
                  onClick={() => {
                    setMenu(null);
                    onOpenExperiment(link.experimentId);
                  }}
                >
                  {labelLink(link)}
                </button>
              ))}
            </>
          )}
        </PortalMenu>
      )}
      {menu === "experiments" && (
        <PortalMenu
          triggerRef={experimentsRef}
          label={m.hypothesis_experiments()}
          onClose={() => setMenu(null)}
        >
          {tests.length === 0 ? (
            <div className="px-2 py-1.5 text-sm text-muted">{m.hypothesis_no_linked_experiments()}</div>
          ) : tests.map((link) => (
            <button
              key={link.id}
              type="button"
              role="menuitem"
              className="model-item flex w-full rounded-sm px-2 py-1 text-start text-sm text-text hover:bg-surface"
              onClick={() => {
                setMenu(null);
                onOpenExperiment(link.experimentId);
              }}
            >
              {labelLink(link)}
            </button>
          ))}
        </PortalMenu>
      )}
    </div>
  );
});

function SourceRow({ source }: { source: HypothesisSource }) {
  const href = sourceHref(source);
  const label = source.title?.trim() || source.paperId?.trim() || source.url?.trim() || source.id;
  if (!href) return <div className="px-2 py-1 text-sm text-text">{label}</div>;
  return (
    <a
      role="menuitem"
      className="model-item flex w-full rounded-sm px-2 py-1 text-sm text-text no-underline hover:bg-surface"
      href={href}
      target="_blank"
      rel="noopener noreferrer"
    >
      {label}
    </a>
  );
}

function PortalMenu({
  triggerRef,
  label,
  onClose,
  children,
}: {
  triggerRef: RefObject<HTMLElement | null>;
  label: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const menuRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const triggerRect = triggerRef.current?.getBoundingClientRect();
  const [position, setPosition] = useState({
    x: triggerRect?.left ?? 0,
    y: (triggerRect?.bottom ?? 0) + 6,
  });
  useLayoutEffect(() => {
    const menu = menuRef.current;
    const trigger = triggerRef.current;
    if (!menu || !trigger) return;
    const rect = trigger.getBoundingClientRect();
    setPosition({
      x: Math.max(8, Math.min(rect.left, window.innerWidth - menu.offsetWidth - 8)),
      y: Math.max(8, Math.min(rect.bottom + 6, window.innerHeight - menu.offsetHeight - 8)),
    });
  }, [triggerRef, children]);
  useEffect(() => {
    const close = () => onCloseRef.current();
    const dismiss = (event: Event) => {
      const target = event.target instanceof Node ? event.target : null;
      if (menuRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      onCloseRef.current();
    };
    const keydown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      onCloseRef.current();
    };
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("keydown", keydown, true);
    window.addEventListener("resize", close);
    const stopExtra = onTreeViewportMove(close);
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      document.removeEventListener("keydown", keydown, true);
      window.removeEventListener("resize", close);
      stopExtra();
    };
  }, [triggerRef]);
  return createPortal(
    <div
      ref={menuRef}
      role="menu"
      aria-label={label}
      className="option-menu fixed z-100 min-w-56 max-w-80 max-h-80 overflow-y-auto overscroll-contain rounded-md border border-border bg-background p-1 shadow-menu"
      style={{ left: position.x, top: position.y }}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      {children}
    </div>,
    document.body,
  );
}

function buildForest(hypotheses: Hypothesis[]) {
  const byParent = new Map<string | null, Hypothesis[]>();
  const ids = new Set(hypotheses.map((hypothesis) => hypothesis.id));
  for (const hypothesis of hypotheses) {
    const parent = hypothesis.parentHypothesisId && ids.has(hypothesis.parentHypothesisId)
      ? hypothesis.parentHypothesisId
      : null;
    const list = byParent.get(parent);
    if (list) list.push(hypothesis);
    else byParent.set(parent, [hypothesis]);
  }
  return byParent;
}

export function HypothesisTree({
  hypotheses,
  runs,
  onSelect,
  onOpenExperiment,
  viewport,
  onViewportChange,
}: {
  hypotheses: Hypothesis[];
  runs: Run[];
  onSelect: (id: string) => void;
  onOpenExperiment: (experimentId: string) => void;
  viewport: Viewport | null;
  onViewportChange: (viewport: Viewport) => void;
}) {
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const onOpenRef = useRef(onOpenExperiment);
  onOpenRef.current = onOpenExperiment;
  const select = useCallback((id: string) => onSelectRef.current(id), []);
  const openExperiment = useCallback((id: string) => onOpenRef.current(id), []);

  const { nodes, edges } = useMemo(() => {
    const forest = buildForest(hypotheses);
    const nodes: FlowNode[] = [];
    const edges: Edge[] = [];
    function subtreeWidth(hypothesis: Hypothesis): number {
      const children = forest.get(hypothesis.id) ?? [];
      if (children.length === 0) return NODE_W;
      return children.reduce((sum, child) => sum + subtreeWidth(child), 0) + GAP_X * (children.length - 1);
    }
    function layout(hypothesis: Hypothesis, cx: number, y: number) {
      nodes.push({
        id: hypothesis.id,
        type: "hypothesis",
        position: { x: cx - NODE_W / 2, y },
        data: { hypothesis, runs, onSelect: select, onOpenExperiment: openExperiment },
      });
      const children = forest.get(hypothesis.id) ?? [];
      if (children.length === 0) return;
      const totalW = children.reduce((sum, child) => sum + subtreeWidth(child), 0) + GAP_X * (children.length - 1);
      let childX = cx - totalW / 2;
      for (const child of children) {
        const width = subtreeWidth(child);
        edges.push({
          id: `e-${hypothesis.id}-${child.id}`,
          source: hypothesis.id,
          target: child.id,
        });
        layout(child, childX + width / 2, y + NODE_H + GAP_Y);
        childX += width + GAP_X;
      }
    }
    const roots = forest.get(null) ?? [];
    let rx = 0;
    for (const root of roots) {
      const width = subtreeWidth(root);
      layout(root, rx + width / 2, 0);
      rx += width + GAP_X;
    }
    return { nodes, edges };
  }, [hypotheses, runs, select, openExperiment]);

  if (hypotheses.length === 0) {
    return (
      <div className="empty-state absolute inset-0 flex flex-col items-center justify-center gap-1.5 p-6 text-center">
        <p className="empty-state-title m-0 max-w-[46ch] text-2xl font-normal text-text">{m.hypothesis_empty_title()}</p>
        <p className="m-0 max-w-[46ch] text-lg text-subtext">{m.hypothesis_empty_hint()}</p>
      </div>
    );
  }

  return (
    <div className="absolute inset-0">
      <ReactFlow
        className="[&_.react-flow\_\_handle]:pointer-events-none [&_.react-flow\_\_handle]:opacity-0 [&_.react-flow\_\_attribution]:hidden!"
        nodes={nodes}
        edges={edges}
        nodeTypes={{ hypothesis: HypNode }}
        defaultEdgeOptions={{ type: "default", style: { stroke: "var(--text)", strokeWidth: 1.5, opacity: 0.3 } }}
        nodesDraggable={false}
        nodesConnectable={false}
        nodesFocusable={false}
        onMoveEnd={(event, nextViewport) => { if (event) onViewportChange(nextViewport); }}
        minZoom={0.15}
        defaultViewport={viewport ?? undefined}
        fitView={viewport === null}
        fitViewOptions={{ padding: 0.25, maxZoom: 1 }}
      >
        <Background variant={BackgroundVariant.Dots} color="var(--dots-strong)" gap={28} size={1.6} />
      </ReactFlow>
    </div>
  );
}
