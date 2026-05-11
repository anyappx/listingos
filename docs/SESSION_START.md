# Claude Code Session Start Template
# Copy ONE of these blocks per session. Do not combine.

═══════════════════════════════════════════════════
## SESSION START (paste this FIRST every time):

Read CLAUDE.md completely. Acknowledge the locked stack and
DO NOT rules. Then read the ticket I paste next. Execute it
exactly. Do not suggest alternative approaches. Do not add
dependencies. Do not refactor code outside the ticket scope.
Follow the patterns in skills/all-skills.md exactly.
When done, run the test case and show me the output.
Do not say "done" until the test passes and npm run typecheck
returns 0 errors.

═══════════════════════════════════════════════════
## THEN paste the ticket from tickets/all-tickets.md
## ONE ticket per session.
## Close session after commit.
## Open fresh session for next ticket.
═══════════════════════════════════════════════════


# ─── QUICK REFERENCE: batch order ───

# Day 1: LOS-001 → LOS-002 → LOS-003 → LOS-004
# Day 2: LOS-010 → LOS-011 → LOS-012 → LOS-013
# Day 3: LOS-020 → LOS-021 → LOS-022 → LOS-023 → LOS-024
# Day 4: LOS-030 → LOS-031 → LOS-032 → LOS-033 → LOS-034 → LOS-035
# Day 5: LOS-036 → LOS-037 → LOS-038
# Day 6: LOS-040 → LOS-041 → LOS-042 → LOS-043 → LOS-044 → LOS-045 → LOS-046
# Day 7: LOS-050 → LOS-051 → LOS-052 → LOS-053 → LOS-054
# Day 8: LOS-055 → LOS-056 → LOS-057
# Day 9: LOS-060 → LOS-061 → LOS-062 → LOS-063 → LOS-064
# Day 10: LOS-065 → LOS-066 → LOS-067
# Day 11: LOS-070 → LOS-071 → LOS-072 → LOS-073
# Day 12: LOS-074 → LOS-075

# ─── BETWEEN BATCHES: run quality gate ───

# After each batch completes:
# npm run typecheck   → 0 errors
# npm run lint        → 0 errors
# npm run build       → succeeds
# git log --oneline   → verify all tickets committed
