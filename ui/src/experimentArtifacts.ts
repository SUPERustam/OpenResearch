import type { ArtifactEntry } from "./api";

/** A file from an experiment's matched artifact subtree, ready to open. */
export interface ExperimentArtifactFile {
  /** Directory-relative path used by the artifacts file APIs. */
  path: string;
  /** Path relative to the matched top-level entry (nested folders flattened). */
  relativePath: string;
  name: string;
}

/** Filename without a trailing extension (`report.md` → `report`). Directories keep their name. */
function entryStem(entry: ArtifactEntry): string {
  if (entry.isDir) return entry.name;
  const dot = entry.name.lastIndexOf(".");
  return dot > 0 ? entry.name.slice(0, dot) : entry.name;
}

function hyphenParts(value: string): string[] {
  return value.split("-").filter(Boolean);
}

/** How many leading hyphen-separated tokens `a` and `b` share. */
export function sharedHyphenPrefixLength(a: string, b: string): number {
  const left = hyphenParts(a);
  const right = hyphenParts(b);
  let n = 0;
  while (n < left.length && n < right.length && left[n] === right[n]) n += 1;
  return n;
}

/**
 * Pick the project-artifact subtree that belongs to an experiment.
 *
 * Prefer a top-level entry whose `name` equals `slug`. Otherwise accept a
 * **single** top-level name that is `slug` plus a `-` suffix, a file whose
 * stem equals `slug`, or a unique top-level name that shares at least two
 * hyphen-separated tokens with the slug (so `cpu-apple-silicon-pipeline-results.md`
 * still matches `cpu-apple-silicon-end-to-end-baseline`). No unique match
 * yields an empty list — never the whole project tree.
 */
export function matchExperimentArtifactRoot(
  entries: ArtifactEntry[],
  slug: string,
): ArtifactEntry | null {
  if (!slug) return null;
  const exact = entries.find((entry) => entry.name === slug);
  if (exact) return exact;
  const prefix = `${slug}-`;
  const suffixed = entries.filter((entry) => {
    const stem = entryStem(entry);
    return entry.name.startsWith(prefix) || stem === slug || stem.startsWith(prefix);
  });
  if (suffixed.length === 1) return suffixed[0];
  if (suffixed.length > 1) return null;

  const MIN_SHARED = 2;
  const ranked = entries
    .map((entry) => ({ entry, shared: sharedHyphenPrefixLength(entryStem(entry), slug) }))
    .filter((row) => row.shared >= MIN_SHARED);
  return ranked.length === 1 ? ranked[0].entry : null;
}

/** Flatten the matched subtree to files. Directories contribute their descendants only. */
export function experimentArtifactFiles(
  entries: ArtifactEntry[],
  slug: string,
): ExperimentArtifactFile[] {
  const root = matchExperimentArtifactRoot(entries, slug);
  if (!root) return [];
  if (!root.isDir) {
    return [{ path: root.path, relativePath: root.name, name: root.name }];
  }
  const files: ExperimentArtifactFile[] = [];
  const prefix = `${root.path}/`;
  const walk = (items: ArtifactEntry[]) => {
    for (const entry of items) {
      if (entry.isDir) {
        walk(entry.children ?? []);
        continue;
      }
      const relativePath = entry.path === root.path
        ? entry.name
        : entry.path.startsWith(prefix)
          ? entry.path.slice(prefix.length)
          : entry.name;
      files.push({ path: entry.path, relativePath, name: entry.name });
    }
  };
  walk(root.children ?? []);
  files.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
  return files;
}
