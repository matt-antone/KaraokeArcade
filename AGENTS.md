# Working in this repo

Instructions for coding agents. Short on purpose — everything here is a rule that
has been broken at least once.

## graft skill
always initate graph skill at session start. never commit grapt caches

## Check whether the PR is merged before you keep working on its branch

**Before pushing to a branch, or continuing any work on it, check the state of its
pull request:**

```bash
gh pr view --json state,mergedAt,url
```

A branch does not stop existing when its PR merges, and `git push` to it keeps
succeeding. Nothing warns you. Work pushed to a merged branch is not in `main`, is
not in any open PR, and is not being reviewed by anyone — it is invisible until
somebody notices it is missing.

- `state: OPEN` — carry on, push to it.
- `state: MERGED` or `CLOSED` — **stop.** The branch is finished. Start a new one
  from the updated `main` (`git fetch origin && git checkout -b <new> origin/main`)
  and open a new PR for the next piece of work.

This applies to work that arrives mid-session too. A session that begins with one
task and grows a second is exactly where this goes wrong: the first PR merges while
the second task is still being worked on, and the new commits land on a dead branch.
Re-check between tasks, not just at the start of the session.

**Never edit a merged PR's description to describe work that is not in it.** The
description is the record of what that merge contained. New work gets a new PR.

## Before you commit

Run `fallow` on the repository. Pre-existing findings across the repo are not a
reason to stop; findings your own change introduced are.

## Verify before claiming it works

Run it, hit the endpoint, look at the page. "It should work" is not a result. When
something could not be verified, say so plainly and say why.

<!-- graft:start -->
## Graft — repo context graph

This repo is indexed in `graft/`: small linked markdown nodes that explain each
system and carry exact file:line spans, kept in sync with the code through git.

For ANY task here — understanding how something works, finding where code lives,
or scoping a change — get context from the graph before grepping or opening
source files. Re-ask freely (it's cheap) and reuse literal identifiers you
already have (symbol, error string, file name) as the query. New to this repo?
Run `graft map` first — a token-budgeted orientation (dir clusters, hubs,
hotspots), no LLM, no key.

- Run `graft ask "<your question>" --source` → ranked nodes with the relevant
  code spans inlined (each hit's ≤8-line crux by default; `--full` for whole
  definitions when the crux isn't enough). Match the tool to the task shape:
  for understanding or editing, the top node IS the answer — cite its
  `covers:` file:line spans and edit straight from `--source`. For
  exhaustive tasks ("every occurrence / every caller of this pattern"), ranked
  results are top-N, not complete — run `graft grep "<literal>"` instead
  (exhaustive over indexed files, grouped by enclosing symbol), falling back
  to raw `grep -rn` only for unindexed files.
- `graft skeleton <file>` → every definition's signature + span, ~10× cheaper
  than reading the file; use it to skim an API surface.
- `graft callers <symbol>` gives precomputed, exact edges — who calls this.
  Add `--direction out` for what it calls, or `--depth N` to walk
  transitively for the full blast radius. For structural questions, skip
  ranking and use this directly.
- Or browse: `graft/INDEX.md` lists every node; follow the links.
- Monorepos and folders of multiple repos rank fairly across sub-projects —
  hits carry `[scope/]` labels naming which one they're from. Narrow with
  `graft ask "<task>" --in <scope>/` once you know where you're working.

If a returned span is truncated ("+N more lines"), open the file at that exact
range before finalizing. Only open source files when a node genuinely lacks a
needed detail, and then at the exact file:line the node points to — never
re-read whole files.

After big code changes, refresh the graph with `graft build` (deterministic,
no API key, $0).
<!-- graft:end -->
