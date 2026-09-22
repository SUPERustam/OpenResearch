import { m } from "../paraglide/messages.js";
import { ltr } from "../i18n";
import { X } from "lucide-react";
import { timeAgo, type Hypothesis, type HypothesisExperimentLink, type HypothesisSource } from "../api";
import { Md } from "./Md";
import { StatusBadge } from "./StatusBadge";
import { IconButton } from "./ui";

function sourceLabel(source: HypothesisSource): string {
  return source.title?.trim() || source.paperId?.trim() || source.url?.trim() || source.id;
}

export function sourceHref(source: HypothesisSource): string | null {
  if (source.url?.trim()) return source.url.trim();
  if (source.paperId?.trim()) return `https://arxiv.org/abs/${encodeURIComponent(source.paperId.trim())}`;
  return null;
}

function experimentLabel(link: HypothesisExperimentLink): string {
  return link.experimentTitle?.trim() || link.experimentSlug || link.experimentId;
}

export function HypothesisOverview({
  hypothesis,
  parent,
  onOpenExperiment,
  onClose,
}: {
  hypothesis: Hypothesis;
  parent: Hypothesis | null;
  onOpenExperiment: (experimentId: string) => void;
  onClose: () => void;
}) {
  const origins = hypothesis.experiments.filter((link) => link.role === "origin");
  const tests = hypothesis.experiments.filter((link) => link.role === "test");
  return (
    <aside className="hypothesis-overview absolute inset-y-0 end-0 z-20 flex w-[380px] max-w-full flex-col border-s border-border bg-background shadow-elevated">
      <div className="flex items-start gap-2 border-b border-border px-4 py-3">
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center gap-2 text-xs text-muted">
            <span>{hypothesis.parentHypothesisId ? m.hypothesis_child() : m.hypothesis_root()}</span>
            <StatusBadge status={hypothesis.status} />
          </div>
          <h2 className="m-0 truncate text-sm font-semibold text-text" title={hypothesis.slug}>{ltr(hypothesis.slug)}</h2>
          {hypothesis.title && <p className="m-0 mt-1 text-sm text-text">{hypothesis.title}</p>}
        </div>
        <IconButton title={m.hypothesis_close()} aria-label={m.hypothesis_close()} onClick={onClose}>
          <X size={14} />
        </IconButton>
      </div>
      <div className="min-h-0 flex-1 overflow-auto px-4 py-4 text-sm">
        <section>
          <h3 className="m-0 mb-2 text-sm font-semibold text-text">{m.hypothesis_description()}</h3>
          {hypothesis.description?.trim() ? (
            <Md text={hypothesis.description} />
          ) : (
            <p className="m-0 text-subtext">{m.hypothesis_no_description()}</p>
          )}
        </section>
        <section className="mt-5 border-t border-border pt-4">
          <h3 className="m-0 mb-2 text-sm font-semibold text-text">{m.hypothesis_parent()}</h3>
          <p className="m-0 text-subtext">{parent ? parent.title?.trim() || parent.slug : m.hypothesis_root()}</p>
        </section>
        <section className="mt-5 border-t border-border pt-4">
          <h3 className="m-0 mb-2 text-sm font-semibold text-text">{m.hypothesis_internet_sources()}</h3>
          {hypothesis.sources.length === 0 ? (
            <p className="m-0 text-subtext">{m.hypothesis_no_internet_sources()}</p>
          ) : (
            <ul className="m-0 flex list-none flex-col gap-2 p-0">
              {hypothesis.sources.map((source) => {
                const href = sourceHref(source);
                const label = sourceLabel(source);
                return (
                  <li key={source.id}>
                    {href ? (
                      <a className="text-text underline underline-offset-2" href={href} target="_blank" rel="noopener noreferrer">
                        {label}
                      </a>
                    ) : (
                      <span className="text-text">{label}</span>
                    )}
                    {source.note && <p className="m-0 text-xs text-subtext">{source.note}</p>}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
        <LinkSection
          title={m.hypothesis_origin_experiments()}
          empty={m.hypothesis_no_origin_experiments()}
          links={origins}
          onOpenExperiment={onOpenExperiment}
        />
        <LinkSection
          title={m.hypothesis_testing_experiments()}
          empty={m.hypothesis_no_linked_experiments()}
          links={tests}
          onOpenExperiment={onOpenExperiment}
        />
        <p className="m-0 mt-5 text-xs text-muted">{timeAgo(hypothesis.updatedAt)}</p>
      </div>
    </aside>
  );
}

function LinkSection({
  title,
  empty,
  links,
  onOpenExperiment,
}: {
  title: string;
  empty: string;
  links: HypothesisExperimentLink[];
  onOpenExperiment: (experimentId: string) => void;
}) {
  return (
    <section className="mt-5 border-t border-border pt-4">
      <h3 className="m-0 mb-2 text-sm font-semibold text-text">{title}</h3>
      {links.length === 0 ? (
        <p className="m-0 text-subtext">{empty}</p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-1 p-0">
          {links.map((link) => (
            <li key={link.id}>
              <button
                type="button"
                className="w-full truncate rounded-sm px-1 py-0.5 text-start text-sm text-text hover:bg-surface"
                onClick={() => onOpenExperiment(link.experimentId)}
              >
                {experimentLabel(link)}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
