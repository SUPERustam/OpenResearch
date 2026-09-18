import { WorkspaceEmptyState } from "./WorkspaceEmptyState";
import { m } from "../paraglide/messages.js";
import { ltr } from "../i18n";
import { FlaskConical, CircleStop, FolderTree, GitBranch, Package, Terminal } from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  fmtNumber,
  runDisplayStatus,
  timeAgo,
  type ArtifactEntry,
  type Experiment,
  type Run,
  type RunDisplayStatus,
} from "../api";
import { experimentArtifactFiles } from "../experimentArtifacts";
import { getArtifactsQuery } from "../queries/files";
import { StatusBadge } from "./StatusBadge";
import { ExperimentArtifactsMenu } from "./ExperimentArtifactsMenu";
import { tabOpenGestureHandlers, type TabOpenIntent } from "../tabPreview";
import { Button } from "./ui";

const EMPTY_ARTIFACT_ENTRIES: ArtifactEntry[] = [];

export function ExperimentsTable({
  runs,
  experiments,
  emptyHint,
  projectId,
  onOpen,
  onOpenLogs,
  onOpenCode,
  onOpenArtifact,
  onCancel,
}: {
  runs: Run[];
  experiments: Experiment[];
  emptyHint?: string;
  projectId: string;
  onOpen: (experiment: Experiment, intent: TabOpenIntent) => void;
  onOpenLogs: (experimentId: string, runId: string, intent: TabOpenIntent) => void;
  onOpenCode: (experimentId: string, intent: TabOpenIntent) => void;
  onOpenArtifact: (path: string, intent: TabOpenIntent) => void;
  onCancel: (runId: string) => Promise<void>;
}) {
  const artifactsQuery = useQuery(getArtifactsQuery(projectId));
  const entries = artifactsQuery.data?.entries ?? EMPTY_ARTIFACT_ENTRIES;
  const [pendingCancellation, setPendingCancellation] = useState<ReadonlySet<string>>(new Set());
  const [cancelError, setCancelError] = useState<string | null>(null);
  const runsByExperiment = new Map<string, Run[]>();
  for (const run of runs) {
    const experimentRuns = runsByExperiment.get(run.experimentId);
    if (experimentRuns) experimentRuns.push(run);
    else runsByExperiment.set(run.experimentId, [run]);
  }
  for (const experimentRuns of runsByExperiment.values()) {
    experimentRuns.sort((a, b) => b.createdAt - a.createdAt);
  }

  const sortedExperiments = [...experiments].sort((a, b) => {
    const aActivity = runsByExperiment.get(a.id)?.[0]?.createdAt ?? a.createdAt;
    const bActivity = runsByExperiment.get(b.id)?.[0]?.createdAt ?? b.createdAt;
    return bActivity - aActivity;
  });

  if (sortedExperiments.length === 0) {
    return (
      <WorkspaceEmptyState
        icon={FlaskConical}
        title={emptyHint ?? m.experiments_none_yet()}
        description={emptyHint ? undefined : m.experiments_empty_description()}
      />
    );
  }

  async function requestCancel(runId: string) {
    setCancelError(null);
    setPendingCancellation((current) => new Set(current).add(runId));
    try {
      await onCancel(runId);
    } catch (cause) {
      setPendingCancellation((current) => {
        const next = new Set(current);
        next.delete(runId);
        return next;
      });
      setCancelError(cause instanceof Error ? cause.message : String(cause));
    }
  }

  return (
    <div className="experiments-table-wrap absolute inset-0 overflow-auto bg-background @container">
      {cancelError && (
        <div className="experiments-table-error py-2 px-3 text-accent-red text-sm border-b border-b-border" role="alert">
          {m.experiments_table_stop_failed()} {cancelError}
        </div>
      )}
      <div className="experiments-table w-full text-sm bg-background" role="list" aria-label={m.experiments_table_experiments()}>
        {sortedExperiments.map((experiment) => {
          const experimentRuns = runsByExperiment.get(experiment.id) ?? [];
          const latestRun = experimentRuns[0] ?? null;
          const liveRun = experimentRuns.find(
            (run) => run.status === "running" || run.status === "starting",
          );
          const logsRun = liveRun ?? latestRun;
          const cancelling = Boolean(
            liveRun && (liveRun.cancelRequested || pendingCancellation.has(liveRun.id)),
          );
          const status = liveRun
            ? cancelling
              ? "cancelling"
              : runDisplayStatus(liveRun)
            : latestRun
              ? runDisplayStatus(latestRun)
              : "idle";

          return (
            <ExperimentTableRow
              key={experiment.id}
              experiment={experiment}
              experimentRuns={experimentRuns}
              latestRun={latestRun}
              liveRun={liveRun ?? null}
              logsRun={logsRun}
              cancelling={cancelling}
              status={status}
              entries={entries}
              artifactsPending={artifactsQuery.isPending}
              onOpen={onOpen}
              onOpenLogs={onOpenLogs}
              onOpenCode={onOpenCode}
              onOpenArtifact={onOpenArtifact}
              onCancelRun={requestCancel}
            />
          );
        })}
      </div>
    </div>
  );
}

function ExperimentTableRow({
  experiment,
  experimentRuns,
  latestRun,
  liveRun,
  logsRun,
  cancelling,
  status,
  entries,
  artifactsPending,
  onOpen,
  onOpenLogs,
  onOpenCode,
  onOpenArtifact,
  onCancelRun,
}: {
  experiment: Experiment;
  experimentRuns: Run[];
  latestRun: Run | null;
  liveRun: Run | null;
  logsRun: Run | null;
  cancelling: boolean;
  status: RunDisplayStatus | "idle";
  entries: ArtifactEntry[];
  artifactsPending: boolean;
  onOpen: (experiment: Experiment, intent: TabOpenIntent) => void;
  onOpenLogs: (experimentId: string, runId: string, intent: TabOpenIntent) => void;
  onOpenCode: (experimentId: string, intent: TabOpenIntent) => void;
  onOpenArtifact: (path: string, intent: TabOpenIntent) => void;
  onCancelRun: (runId: string) => void;
}) {
  const files = useMemo(
    () => experimentArtifactFiles(entries, experiment.slug),
    [entries, experiment.slug],
  );
  const artifactsBtnRef = useRef<HTMLElement>(null);
  const [artifactsOpen, setArtifactsOpen] = useState(false);
  const closeArtifacts = useCallback(() => setArtifactsOpen(false), []);
  const openArtifact = useCallback(
    (path: string, intent: TabOpenIntent) => {
      closeArtifacts();
      onOpenArtifact(path, intent);
    },
    [closeArtifacts, onOpenArtifact],
  );

  return (
    <div
      className="experiment-table-group grid grid-cols-[minmax(0,_1fr)_auto] [grid-template-areas:'name_meta'_'actions_actions'] gap-x-8 items-center py-4 px-5 gap-y-[7px] border-b border-b-divider-subtle bg-background cursor-pointer [&:hover]:bg-canvas [&:last-child]:border-b-0 [@container((max-width:_560px))]:grid-cols-[minmax(0,_1fr)_auto] [@container((max-width:_560px))]:gap-x-3.5 [@container((max-width:_560px))]:gap-y-[9px] [@container((max-width:_400px))]:grid-cols-[minmax(0,_1fr)] [@container((max-width:_400px))]:[grid-template-areas:'name'_'meta'_'actions']"
      role="listitem"
      onClick={() => onOpen(experiment, "preview")}
      onDoubleClick={() => onOpen(experiment, "keepOpen")}
      onAuxClick={(event) => {
        if (event.button !== 1) return;
        event.preventDefault();
        onOpen(experiment, "keepOpen");
      }}
    >
      <div className="experiment-table-name [grid-area:name] self-start min-w-0">
        <button
          type="button"
          className="experiment-table-title block w-full overflow-hidden text-text font-semibold text-start text-ellipsis whitespace-nowrap"
          {...tabOpenGestureHandlers<HTMLButtonElement>((intent) =>
            onOpen(experiment, intent),
          { stopPropagation: true })}
        >
          {experiment.title || experiment.slug}
        </button>
        <span className="experiment-table-subtitle flex items-center min-w-0 gap-1.5 mt-1 overflow-hidden text-subtext text-sm [&_>_svg]:shrink-0 [&_code]:min-w-0 [&_code]:overflow-hidden [&_code]:text-ellipsis [&_code]:whitespace-nowrap" title={experiment.branchName}>
          <GitBranch size={14} aria-hidden="true" />
          <code>{experiment.branchName}</code>
        </span>
      </div>
      <div className="experiment-table-meta [grid-area:meta] self-start flex items-center justify-end gap-4.5 whitespace-nowrap [@container((max-width:_560px))]:flex-col [@container((max-width:_560px))]:items-end [@container((max-width:_560px))]:gap-1.5 [@container((max-width:_400px))]:!flex-row [@container((max-width:_400px))]:!items-center [@container((max-width:_400px))]:flex-wrap [@container((max-width:_400px))]:justify-start [@container((max-width:_400px))]:gap-3">
        <div className="experiment-table-status flex items-center min-w-0">
          <StatusBadge status={status} />
        </div>
        <div className="experiment-run-summary flex items-center min-w-0 gap-2 text-subtext text-sm font-medium">
          <span>{experimentRuns.length === 1 ? m.experiments_one_run() : m.experiments_run_count({ count: fmtNumber(experimentRuns.length) })}</span>
        </div>
        <div className="experiment-table-latest flex items-center gap-1.5 min-w-0 text-subtext text-sm font-medium whitespace-nowrap">
          <span>{latestRun ? timeAgo(latestRun.createdAt) : m.experiments_not_run_yet()}</span>
        </div>
      </div>
      <div
        className="experiment-table-actions [grid-area:actions] flex flex-wrap items-center justify-start gap-2 mt-3"
        role="group"
        aria-label={m.a11y_actions_for({ name: experiment.title || experiment.slug })}
        onClick={(event) => event.stopPropagation()}
        onDoubleClick={(event) => event.stopPropagation()}
        onAuxClick={(event) => event.stopPropagation()}
      >
        <Button
          size="small"
          disabled={!logsRun}
          title={logsRun ? m.experiments_open_logs() : m.experiments_no_runs_yet()}
          {...tabOpenGestureHandlers<HTMLButtonElement>((intent) => {
            if (logsRun) onOpenLogs(experiment.id, logsRun.id, intent);
          }, { stopPropagation: true })}
        >
          <Terminal size={15} />
          {m.experiments_table_logs()}
        </Button>
        <Button
          size="small"
          title={m.a11y_browse_code_on({ branch: ltr(experiment.branchName) })}
          {...tabOpenGestureHandlers<HTMLButtonElement>((intent) =>
            onOpenCode(experiment.id, intent),
          { stopPropagation: true })}
        >
          <FolderTree size={15} />
          {m.experiments_table_code()}
        </Button>
        <span ref={artifactsBtnRef} className="inline-flex">
          <Button
            type="button"
            size="small"
            title={m.experiments_table_open_artifacts()}
            aria-haspopup="menu"
            aria-expanded={artifactsOpen}
            onClick={() => setArtifactsOpen((open) => !open)}
          >
            <Package size={15} />
            {m.experiments_table_artifacts()}
          </Button>
        </span>
        {liveRun && (
          <Button
            size="small"
            variant="danger"
            className="[@container((max-width:_560px))]:ms-auto"
            disabled={cancelling}
            title={cancelling ? m.experiments_stop_requested() : m.experiments_stop_run()}
            onClick={() => onCancelRun(liveRun.id)}
          >
            <CircleStop size={15} />
            {cancelling ? m.common_stopping() : m.common_stop()}
          </Button>
        )}
      </div>
      {artifactsOpen && (
        <ExperimentArtifactsMenu
          triggerRef={artifactsBtnRef}
          files={files}
          pending={artifactsPending}
          onOpen={openArtifact}
          onClose={closeArtifacts}
        />
      )}
    </div>
  );
}
