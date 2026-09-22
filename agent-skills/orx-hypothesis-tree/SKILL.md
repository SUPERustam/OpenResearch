---
name: orx-hypothesis-tree
description: "Record and maintain the hypothesis tree: claims, internet sources, originating experiments, and experiments that test each claim. Use before stating a hypothesis, attaching literature or a finished experiment as its source, linking experiments that test it, or updating hypothesis status."
---

A project has two trees. The **experiment tree** is code, a fixed run command, and measured runs. The **hypothesis tree** is the claims those runs exist to test. A hypothesis has no git branch and no run command. Do not create an experiment merely to store a claim, and do not leave a claim only in an experiment description.

## When to write a hypothesis

Create a node when a claim is specific enough to test:

- literature suggested it (internet sources), or
- a finished experiment's result suggested it (originating experiments), or
- the user asked for a claim the next round should test.

Skip the source list that does not exist. A claim with no paper and no prior run is still a hypothesis; leave both source lists empty.

## Shape

Same stacked-bush rule as experiments. Before you parent X under Y, name what Y claimed that X refines.

- You can name it → X is a **child** of Y.
- X and Y are co-equal alternatives → they are **siblings** (both roots, or both children of the same parent). A missing `--parent` always creates a root. It does not attach to the oldest root.

Re-read before adding nodes:

```sh
orx hypothesis list <projectId>
```

## Record the claim

```sh
orx hypothesis create <projectId> --title "Muon matrix LR improves early val BPB" \
  --description "Doubling the matrix LR, changing nothing else, lowers val BPB at step 200."

# A refinement of that claim:
orx hypothesis create <projectId> --parent <hypId> --title "Only the matrix LR matters" \
  --description "The scalar LR stays at the baseline; only the matrix LR changes."
```

Status is `open` until a linked experiment is in flight, then `testing`. After the tests answer, set `supported`, `refuted`, or `inconclusive`. Do not infer the verdict from a non-zero exit code.

```sh
orx hypothesis set <hypId> --status testing
orx hypothesis desc <hypId>                         # print notes
orx hypothesis desc <hypId> --set "Step 200 val BPB moved 0.04."
orx hypothesis status <hypId>                       # claim, sources, and links
```

## Internet sources

When `orx discover` or `orx paper` produced the claim, attach that source. Pass `--url`, `--paper-id`, or both.

```sh
orx hypothesis source add <hypId> \
  --title "LIMA: Less Is More for Alignment" \
  --url "https://arxiv.org/abs/2305.11206" \
  --paper-id "2305.11206"
```

Remove a source with the id printed by `orx hypothesis status`:

```sh
orx hypothesis source remove <hypId> <sourceId>
```

## Originating experiments

When a measured result created the claim, point at that experiment. This is not the experiment you are about to launch.

```sh
orx hypothesis source add <hypId> --experiment <expId>
```

## Experiments that test the claim

Create or reuse a normal experiment node (`orx-experiment-tree`, `orx create-experiment`), then link it. The link does not launch a run.

```sh
orx create-experiment <projectId> --parent <baseId> --title "Muon matrix LR 2x" \
  --description "Set the matrix LR to 2x the baseline; change nothing else."
orx hypothesis link <hypId> --experiment <expId>
```

One hypothesis may link several testing experiments. One experiment may test several hypotheses. Unlink a test with `orx hypothesis unlink <hypId> --experiment <expId>`.

Deleting a hypothesis fails while it still has children. Delete or reparent the children first: `orx hypothesis delete <hypId>`.

## What stays on the experiment tree

Frozen nodes, the run command, repair, and promotion do not move. Load `orx-experiment-tree` before creating, launching, or editing experiment nodes. Load `orx-evidence` before judging a run, and `orx-lit-review` before the retrieval that becomes an internet source.
