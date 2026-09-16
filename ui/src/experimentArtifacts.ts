import type { ArtifactEntry } from "./api";

/** A file from an experiment's matched artifact subtree, ready to open. */
export interface ExperimentArtifactFile {
  /** Directory-relative path used by the artifacts file APIs. */
  path: string;
  /** Path relative to the matched top-level entry (nested folders flattened). */
  relativePath: string;
  name: string;
}

/**
 * Pick the project-artifact subtree that belongs to an experiment.
 *
 * Prefer a top-level entry whose `name` equals `slug`. Otherwise accept a
 * **single** top-level name that is `slug` plus a `-` suffix. No unique match
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
  const suffixed = entries.filter((entry) => entry.name.startsWith(prefix));
  return suffixed.length === 1 ? suffixed[0] : null;
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
