import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const require = createRequire(import.meta.url);
const source = readFileSync(new URL("../src/components/HypothesisOverview.tsx", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
const mocks = {
  "../paraglide/messages.js": { m: new Proxy({}, { get: (_, name) => () => String(name) }) },
  "../i18n": { ltr: (value) => value },
  "../api": { timeAgo: () => "8h ago" },
  "./Md": { Md: ({ text }) => text },
  "./StatusBadge": { StatusBadge: () => null },
  "./ui": { IconButton: ({ children }) => React.createElement("button", null, children) },
  "lucide-react": { X: () => null },
};
const exports = {};
new Function("require", "exports", compiled)((name) => mocks[name] ?? require(name), exports);

const child = {
  id: "child",
  slug: "more-iid-slices",
  title: "More iid slices still false-certify a high-dimensional cube",
  description: "Still a certificate.",
  status: "supported",
  parentHypothesisId: "parent",
  sources: [],
  experiments: [
    { id: "origin", role: "origin", experimentId: "exp-origin", experimentTitle: "VISReg G1 cube equivalence test", experimentSlug: "g1" },
    { id: "test", role: "test", experimentId: "exp-test", experimentTitle: "VISReg follow-up K4096 cube test", experimentSlug: "k4096" },
  ],
  updatedAt: 1,
};
const parent = {
  id: "parent",
  slug: "g1-high-dimensional-cube",
  title: "G1: high-dimensional cube passes practical shape-loss equivalence",
  status: "supported",
  sources: [],
  experiments: [],
  updatedAt: 1,
};

test("child overview renders the parent title as an in-app link", () => {
  const html = renderToStaticMarkup(React.createElement(exports.HypothesisOverview, {
    hypothesis: child,
    parent,
    onOpenExperiment: () => {},
    onOpenHypothesis: () => {},
    onClose: () => {},
  }));
  const parentButton = html.match(/<button[^>]*>G1: high-dimensional cube passes practical shape-loss equivalence<\/button>/);
  assert.ok(parentButton, "parent title is a button");
  assert.doesNotMatch(parentButton[0], /underline/);
  assert.match(html, /VISReg G1 cube equivalence test/);
  assert.match(html, /VISReg follow-up K4096 cube test/);
});

test("root overview keeps the parent section as plain text", () => {
  const html = renderToStaticMarkup(React.createElement(exports.HypothesisOverview, {
    hypothesis: { ...child, parentHypothesisId: null },
    parent: null,
    onOpenExperiment: () => {},
    onOpenHypothesis: () => {},
    onClose: () => {},
  }));
  assert.match(html, /hypothesis_parent<\/h3><p[^>]*>hypothesis_root<\/p>/);
  assert.doesNotMatch(html, /G1: high-dimensional cube/);
});
