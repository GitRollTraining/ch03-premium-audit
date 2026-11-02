# Class Code and Premium Audit Assistant

Reusable first-pass Agent Skill for Linden Shore Mutual's fictional Maryland workers' compensation audits. It suggests proprietary class codes, allocates payroll, reconciles employer applications and generates employer confirmation questions. It does not set rates or quote premiums.

## Setup

Read the full assignment supplied by the facilitator; it owns scope and acceptance. The completed original interview is in `interviews/ch03-premium-audit-20261102-1605.md`. Employer files and company rules remain at the [interview-provided Drive folder](https://drive.google.com/drive/folders/1pt8gzX8HDuaAq6g8ZFeQ66zbVIYdlN_n) and [July 2025 classification guide](https://drive.google.com/file/d/1L5MxLny7erhjSwCvl43DTSmAt3wgv22j/view).

Use **Node.js 24.21 or later** with network access to the source URLs. No npm install, API keys, Python, public manuals or third-party runtime packages are required. On this Windows machine, Node is installed at `C:\Program Files\nodejs\node.exe` but is absent from this shell's PATH. The commands below use that path. On another machine substitute `node` after checking `node --version`.

```powershell
& 'C:\Program Files\nodejs\node.exe' --version
entire doctor
entire session current
```

Keep Entire enabled. Verify actual capture with `entire session current` and `entire session list`, not only installed hooks. Do not manufacture capture logs. At implementation time hooks and approvals passed diagnostics, but this chat's session had no Entire state; other real sessions were listed. Therefore this revision's coding-session evidence is **not yet verified**. Resolve capture before submission. No commit or push is made until the user reviews the results. Attaching a real session later may rewrite or publish checkpoint metadata; review Entire's proposed action with the user before doing that.

## Execute

From the repository root, first run tests, then audit all six:

```powershell
& 'C:\Program Files\nodejs\node.exe' --test skills/class-code-assistant/scripts/audit.test.mjs
& 'C:\Program Files\nodejs\node.exe' --use-env-proxy skills/class-code-assistant/scripts/audit.mjs --employer all --out deliverables
```

Run one employer to an isolated folder (report files cover only the selected employer):

```powershell
& 'C:\Program Files\nodejs\node.exe' --use-env-proxy skills/class-code-assistant/scripts/audit.mjs --employer harbor-point-legal --out .work/harbor-check
```

Each audit invocation reads the guide and every selected employer document directly from the source URLs. It checks reviewed source hashes and refuses stale duty assertions. Proxy support is enabled by the Node flag; network-restricted agents may need approved read-only network access. Authentication/HTML pages and missing files stop the run without substituting old data. Connected Google Drive is a supported alternate live transport; see the [workflow reference](skills/class-code-assistant/references/workflow.md). Never refresh timestamps on cached source content.

For a **new employer**, fetch and read its records, add its actual file URLs to `references/sources.json`, and create source-grounded duty facts plus complete source hashes under `references/reviews/`. Follow the reference schema and preserve the original records. Invoke `--employer <new-slug>`; optionally use `--manifest <path>` for a separate manifest. The engine contains no employer-name branches or hard-coded payroll answers. It supports reviewed duty categories and source layouts; unknown duties/layouts stop for explicit, tested extension rather than guessing.

## Outputs

- `deliverables/codes/harbor-point-legal.csv`
- `deliverables/codes/bay-crest-exteriors.csv`
- `deliverables/codes/severn-homebuilders.csv`
- `deliverables/codes/patuxent-electric.csv`
- `deliverables/codes/annapolis-courier.csv`
- `deliverables/codes/larkspur-lane-bistro.csv`
- `deliverables/audit-report.md`: each employer's accept/reject decision, code totals, exact employee/payment decisions and adjustments, evidence, unresolved items and two-employer call priority.
- `deliverables/audit-questions.md`: source-specific, employee-specific and payment-specific confirmations, including every adjustment and open item.
- `deliverables/source-manifest.json`: source URLs and SHA-256 hashes for this generation. This is data provenance, not coding-session evidence.

CSVs use exactly `class_code,payroll_allocated,rationale_ref`, one positive-payroll row per class, USD to two decimals without thousands separators, and the guide's exact code paragraph identifier. Read CSVs together with the report: unresolved treatments are provisional and require auditor/employer approval. No output implies final sign-off.

## Verification

```powershell
& 'C:\Program Files\nodejs\node.exe' --test skills/class-code-assistant/scripts/audit.test.mjs
& 'C:\Program Files\nodejs\node.exe' --use-env-proxy skills/class-code-assistant/scripts/verify.mjs deliverables
Get-FileHash interviews/ch03-premium-audit-20261102-1605.md -Algorithm SHA256
```

Tests cover boundary rules, integer cents/rounding, full-period insurance, fresh evidence checks, unseen employers, provisional cases, invalid packet timestamps, incorrect class allocations and missing employer outputs. The output verifier refetches sources, checks provenance hashes, exact schema, positive amounts, guide references, independent payroll conservation, and employee/payment/source confirmation coverage. It also recomputes class allocations using the existing classifier and hash-validated duty reviews; that comparison checks output integrity, not an independent implementation of classification policy. It fails if live sources changed. Verification expects every employer in the source manifest by default. For a separate employer manifest pass its path as the verifier's second argument after the output folder. To verify an intentional single-employer output, supply its slug as the third argument: `verify.mjs .work/harbor-check skills/class-code-assistant/references/sources.json harbor-point-legal`.

Original transcript SHA-256: `5C550C09CC68F56BF3890F604B824B774169C1CEFBC2A45AD54CC3EA7FCD9550`. It must continue to match the Downloads original. Do not rewrite or summarize the export. `.work/` holds ignored experiments and temporary transport files, not submission evidence.

Important open items: Harbor Point's site-log/office-duty conflict; whole-period subcontractor insurance and names at Severn; Patuxent's zero-day allowance; exact duty-time allocation for both courier dispatchers; and the bistro receipt window. The report explains proposed treatments without inventing missing data. The two-call triage is a payroll-exposure judgment, not a premium estimate.

## Before you work

**Interview rule.** You conduct the stakeholder interview yourself, and the questions are yours. Do not connect a coding
agent or any other AI to the interview to run, script, or automate it. The interview transcript is assessed together
with the code; a project whose interview was run by an agent is not scored.

- This is a real-case Challenge, closer to client work. The course rule is to plan for at most 3 conversations with the stakeholder, so prepare before each conversation and ask completely.
- The employer files and company rules must be read from the locations Nadia supplied during each run.
- Runtime and dependencies are documented above; the company uses proprietary codes.
- Export your interview as the original Markdown, save one final complete file per session under `interviews/`, and
  commit it with your code. Do not rewrite the export.
