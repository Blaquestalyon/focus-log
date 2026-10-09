# CLAUDE.md

Project instructions for any AI agent working in this repository. Read before changing anything.

## What this repository is

An application built by VibeStack Builder™ for its owner, who is not a programmer. `blueprint.md` is the plan the owner approved; `decisions.md` records why things are the way they are. The owner reads plain English, not code.

## Spec discipline

The blueprint rules everything:
1. blueprint.md is the single source of truth. Code conforms to the blueprint, never the reverse. When behavior and blueprint disagree, one of them is wrong — decide which, fix that one first.
2. No invented details. Every user-visible behavior is pinned in the blueprint: labels, colors, empty states, sort orders, date formats, error messages. If the blueprint is silent, ambiguous, or infeasible on ANYTHING user-visible or that crosses module boundaries, STOP that item and ask the owner (propose a resolution) — never improvise.
3. The workaround rule. When a specced approach turns out infeasible mid-build, no silent improvisation: design the workaround at the spec level, tell the owner in plain English if they would notice the difference, record it in decisions.md, THEN implement it.
4. Spec-first repair. Triage every bug: code defect (code diverges from blueprint → fix the code) or spec defect (blueprint was ambiguous/wrong/infeasible → the blueprint text gets corrected first, then regenerate the affected part). Never patch code around a spec defect.
5. Spec and code version together. blueprint.md and decisions.md are committed to the repo in the same pushes that implement them.
6. Judgment is allowed only at the unit level — isolated internals a test can verify. Anything crossing module boundaries (data shapes, route contracts, shared behavior) follows the spec.

## Scope discipline

- The smallest change that satisfies the request. Touch nothing that is not broken or in scope.
- Anything else you notice, SURFACE to the owner as a finding for them to decide — never a silent "improvement", refactor, or cleanup alongside the work you were asked to do.
- When a constraint genuinely forces you away from the instruction, make the change AND say so plainly, with the reasoning. Silent-and-explained-later is the thing to avoid, not deviation itself.
- Explain in plain words. The owner can follow clear directions and copy/paste; they cannot make a decision that needs technical knowledge they do not have. Never ask them to choose between options only an engineer could weigh — recommend one, say why, and let them ratify it.
