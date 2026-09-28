import { m } from "../paraglide/messages.js";
import { Lightbulb } from "lucide-react";
import { type Hypothesis } from "../api";
import { StatusBadge } from "./StatusBadge";
import { WorkspaceEmptyState } from "./WorkspaceEmptyState";

export function HypothesisTable({
  hypotheses,
  onOpen,
}: {
  hypotheses: Hypothesis[];
  onOpen: (hypothesis: Hypothesis) => void;
}) {
  if (hypotheses.length === 0) {
    return (
      <WorkspaceEmptyState
        icon={Lightbulb}
        title={m.hypothesis_empty_title()}
        description={m.hypothesis_empty_hint()}
      />
    );
  }
  const rows = [...hypotheses].sort((a, b) => b.updatedAt - a.updatedAt);
  return (
    <div className="absolute inset-0 overflow-auto bg-background" role="list" aria-label={m.hypothesis_table()}>
      {rows.map((hypothesis) => {
        const origins = hypothesis.experiments.filter((link) => link.role === "origin").length;
        const tests = hypothesis.experiments.filter((link) => link.role === "test").length;
        return (
          <button
            key={hypothesis.id}
            type="button"
            role="listitem"
            className="flex w-full items-center gap-3 border-b border-border px-4 py-3 text-start hover:bg-surface"
            onClick={() => onOpen(hypothesis)}
          >
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-text">{hypothesis.title?.trim() || hypothesis.slug}</span>
              <span className="block truncate text-xs text-subtext">{hypothesis.slug}</span>
            </span>
            <StatusBadge status={hypothesis.status} />
            <span className="shrink-0 text-xs text-muted">{m.hypothesis_source_count({ count: String(hypothesis.sources.length) })}</span>
            <span className="shrink-0 text-xs text-muted">{m.hypothesis_origin_count({ count: String(origins) })}</span>
            <span className="shrink-0 text-xs text-muted">{m.hypothesis_test_count({ count: String(tests) })}</span>
          </button>
        );
      })}
    </div>
  );
}
