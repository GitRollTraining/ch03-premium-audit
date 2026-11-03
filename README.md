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

Keep Entire enabled. Verify actual capture with `entire session current`, `entire session list` and `entire session info <id> --json`, not only installed hooks. `pending_turns` counts turns not yet condensed into a checkpoint; it is not proof of a published checkpoint. Inspect diagnostics with `entire doctor` without repair flags. Do not manufacture capture logs or treat source provenance as session capture. The active session is recognized during this improvement work; inspect current diagnostics and pending records before any later submission. No commit, push, session attachment or resubmission is authorized by this workflow.

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

Tests cover boundary rules, integer cents/rounding, full-period insurance, fresh evidence checks, unseen employers, provisional cases, invalid packet timestamps, incorrect class allocations and missing employer outputs. Regressions also cover missing/empty/incomplete catering receipts, unknown employee IDs versus documented visitors, and deliberately corrupted report amounts. Receipt evidence must cover every month of its reviewed reporting window; without a reviewed window it must cover audit-period months. An unknown threshold leaves affected catering payroll unallocated, generates named employer questions and stops publication before modifying any existing outputs. The CLI prints these questions rather than assuming a class.

The output verifier refetches sources, checks provenance hashes, exact schema, positive amounts, guide references, independent payroll conservation, and employee/payment/source confirmation coverage. Within each employer section it also checks summary amounts, reported/proposed/difference class amounts, employee/payment allocations, financial adjustment rationales and reconciliation totals; call-priority amounts are checked too. This targets the generated report format, so deliberate format changes require parser tests. It expects every employer in the source manifest by default. For a separate employer manifest pass its path as the verifier's second argument after the output folder. To verify an intentional single-employer output, supply its slug as the third argument: `verify.mjs .work/harbor-check skills/class-code-assistant/references/sources.json harbor-point-legal`.

The six original employers also have an independent baseline in [expected-audits.mjs](skills/class-code-assistant/scripts/expected-audits.mjs): explicit employee codes and wages, allowance additions, invoice payments/coverage decisions, class totals, acceptance decisions and call-priority exposure. Separate BigInt arithmetic sums employee amounts and calculates 60% subcontractor additions with per-payment half-up rounding. Expected results are not produced by the classifier or copied automatically from generated outputs. Offline tests exercise the real classifier against frozen, hash-validated source evidence in `scripts/fixtures/six-employer-sources.json`, including independent attendance counts and receipt sums; the live verifier checks the same reviewed baseline against freshly downloaded sources. Frozen evidence is regression data, never a fallback for live audit runs. Source/guide changes require rereading evidence and manually reviewing expectations; never regenerate a baseline to make a failing test pass.

This is an independent regression baseline for six cases, not a complete independent policy engine. The verifier still uses the production classifier to check generated report consistency and uses it for employers without a baseline. New employers need separately reviewed expectations. Passing tests do not establish missing evidence, approve provisional allocations, prove that questions have been answered, or independently validate all narrative wording.

Distinguish evidence-backed proposals from unknown decisions. Annapolis's whole-pay T-610 treatment for Lena Ortiz and Paul Haskins is an existing proposal, including Paul's two ride dates; it is not an approved rule. Weekly pay, route dates and the application's time estimate cannot establish duty hours. Harbor Point's Tomas Reyes remains C-110 provisionally pending reconciliation of six sign-ins with office duties. Larkspur's supplied receipt window supports only a provisional threshold result, not audit-period approval. Patuxent's Kyle Brandt allowance remains included pending dated travel/expense evidence. Missing or unusable catering receipts leave affected payroll unclassified and block publication. Failed runs preserve older outputs; those outputs are not refreshed evidence.

Questions name employees/IDs, list short attendance-date sets (or count and date range for long logs), identify invoices/payment dates and certificate coverage gaps, request missing dated records, and link each employer's evidence with hashes. The register has no allowance payment dates: questions request them rather than inventing dates. Every provisional treatment still requires auditor/employer confirmation. General CG-07 time division and explicit register-owner exclusions remain implementation limitations; no new hours ratio, weekly allocation rule or owner election is inferred.

Original transcript SHA-256: `5C550C09CC68F56BF3890F604B824B774169C1CEFBC2A45AD54CC3EA7FCD9550`. It must continue to match the Downloads original. Do not rewrite or summarize the export. `.work/` holds ignored experiments and temporary transport files, not submission evidence.

Important open items: Harbor Point's site-log/office-duty conflict; whole-period subcontractor insurance and names at Severn; Patuxent's zero-day allowance; exact duty-time allocation for both courier dispatchers; and the bistro receipt window. The report explains proposed treatments without inventing missing data. The two-call triage is a payroll-exposure judgment, not a premium estimate.

Technical validation also detects named passengers missing IDs, rejects non-finite timesheet hours, and checks complete monetary tokens in report rationales. Catering receipts are required at the operations level, even without a catering-labeled employee. Unknown required receipts block publication while preserving any independently established restaurant allocation; reviewed negative/incidental catering mentions use the workflow's evidence-backed operations schema. These checks add no allocation policy and do not settle the open items above.

## Before you work

**Interview rule.** You conduct the stakeholder interview yourself, and the questions are yours. Do not connect a coding
agent or any other AI to the interview to run, script, or automate it. The interview transcript is assessed together
with the code; a project whose interview was run by an agent is not scored.

- This is a real-case Challenge, closer to client work. The course rule is to plan for at most 3 conversations with the stakeholder, so prepare before each conversation and ask completely.
- The employer files and company rules must be read from the locations Nadia supplied during each run.
- Runtime and dependencies are documented above; the company uses proprietary codes.
- Export your interview as the original Markdown, save one final complete file per session under `interviews/`, and
  commit it with your code. Do not rewrite the export.
