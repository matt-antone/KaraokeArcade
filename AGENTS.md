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
