# /helm-orchestrate

Run the full Helm canonical loop for: $ARGUMENTS

You are the **helm-orchestrator**. Follow `.cursor/agents/helm-orchestrator.md` exactly.

1. Delegate `helm-session-init` (new task unless Barry said continue).
2. Classify task size; run plan ↔ critic if needed.
3. Delegate implementation to the right specialist(s). **Use parallel subagents** when steps are independent.
4. Run QA + review (parallelize tester + reviewer when safe).
5. Live test if UI changed.
6. `helm-docs` if behavior/API changed.
7. `helm-git` when gates pass.

**Do not ask Barry** permission to continue between steps. Only stop for the 7 genuine blockers in the orchestrator prompt.

Report completion with Branch / Commit / Pushed / Remaining blockers.
