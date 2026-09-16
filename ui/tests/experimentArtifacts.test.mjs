import assert from "node:assert/strict";
import test from "node:test";

import {
  experimentArtifactFiles,
  matchExperimentArtifactRoot,
} from "../src/experimentArtifacts.ts";

function file(path, extras = {}) {
  const name = path.split("/").pop();
  return { name, path, isDir: false, size: extras.size ?? 1, modifiedAt: extras.modifiedAt ?? 0 };
}

function dir(path, children = []) {
  const name = path.split("/").pop();
  return { name, path, isDir: true, size: 0, modifiedAt: 0, children };
}

const project = [
  dir("notes", [file("notes/readme.md")]),
  dir("transformer-sweep", [
    file("transformer-sweep/metrics.csv"),
    dir("transformer-sweep/figures", [
      file("transformer-sweep/figures/patch-size.jpg"),
      file("transformer-sweep/figures/loss.pdf"),
    ]),
    file("transformer-sweep/report.md"),
  ]),
  dir("transformer-sweep-old", [file("transformer-sweep-old/legacy.csv")]),
  file("unrelated.png"),
];

test("prefers a top-level name equal to the experiment slug", () => {
  const root = matchExperimentArtifactRoot(project, "transformer-sweep");
  assert.equal(root?.path, "transformer-sweep");
  assert.deepEqual(
    experimentArtifactFiles(project, "transformer-sweep").map((entry) => entry.relativePath),
    ["figures/loss.pdf", "figures/patch-size.jpg", "metrics.csv", "report.md"],
  );
});

test("falls back to a single top-level slug-plus-hyphen suffix", () => {
  const entries = [
    dir("notes", [file("notes/readme.md")]),
    dir("transformer-sweep-v2", [
      file("transformer-sweep-v2/metrics.csv"),
      file("transformer-sweep-v2/plot.jpg"),
    ]),
  ];
  assert.equal(matchExperimentArtifactRoot(entries, "transformer-sweep")?.path, "transformer-sweep-v2");
  assert.deepEqual(
    experimentArtifactFiles(entries, "transformer-sweep").map((entry) => entry.path),
    ["transformer-sweep-v2/metrics.csv", "transformer-sweep-v2/plot.jpg"],
  );
});

test("a matching top-level file is listed by itself", () => {
  const entries = [file("baseline.pdf"), dir("other", [file("other/a.csv")])];
  assert.deepEqual(experimentArtifactFiles(entries, "baseline.pdf"), [
    { path: "baseline.pdf", relativePath: "baseline.pdf", name: "baseline.pdf" },
  ]);
});

test("returns an empty list when nothing uniquely matches", () => {
  assert.deepEqual(experimentArtifactFiles(project, "missing-exp"), []);
  assert.deepEqual(experimentArtifactFiles(project, "unrelated"), []);
  assert.equal(matchExperimentArtifactRoot(project, "transformer"), null);
});

test("multiple hyphen-suffix matches do not dump the project", () => {
  const entries = [
    dir("sweep-a", [file("sweep-a/a.csv")]),
    dir("sweep-b", [file("sweep-b/b.csv")]),
    file("readme.md"),
  ];
  assert.equal(matchExperimentArtifactRoot(entries, "sweep"), null);
  assert.deepEqual(experimentArtifactFiles(entries, "sweep"), []);
});

test("exact slug wins over hyphen-suffix siblings", () => {
  assert.equal(matchExperimentArtifactRoot(project, "transformer-sweep")?.name, "transformer-sweep");
  assert.ok(
    experimentArtifactFiles(project, "transformer-sweep").every((entry) =>
      entry.path.startsWith("transformer-sweep/"),
    ),
  );
});

test("an empty matching folder yields an empty list", () => {
  const entries = [dir("empty-exp"), file("other.csv")];
  assert.deepEqual(experimentArtifactFiles(entries, "empty-exp"), []);
});
