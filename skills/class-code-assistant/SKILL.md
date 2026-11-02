---
name: class-code-assistant
description: Support Linden Shore Mutual's premium audit team with class code suggestions, payroll allocation, and draft audit questions using supplied employer files and company classification rules.
---

# Class Code and Premium Audit Assistant

Use the completed stakeholder interview and live July 2025 company guide. Public classification manuals do not apply. Preserve original interview exports; never conduct, script or automate the stakeholder interview. Classify payroll only; do not set rates or quote premium.

## Inputs and authority

- Employer source folder(s), original interview Markdown and the live company classification guide.
- [references/sources.json](references/sources.json) records the actual interview-provided URLs, file inventory, guide hash and original interview hash. Download source documents from those locations during **every audit run**; no silent cached fallback.
- Read [references/workflow.md](references/workflow.md) for source schemas, reviewed facts, rule precedence, provisional treatments and new employers.
- `references/reviews/*.json` contains reviewed actual-duty assertions with source basis, not calculated payroll answers. Compare these with freshly read descriptions, notes, logs and registers. Changed evidence invalidates its review. Never update a hash without reviewing the changed content, or classify solely from a title.

## Invocation

From the repository root with Node.js 24.21 or later (24.21 tested), no external packages:

```powershell
node --use-env-proxy skills/class-code-assistant/scripts/audit.mjs --employer all --out deliverables
node --use-env-proxy skills/class-code-assistant/scripts/audit.mjs --employer harbor-point-legal --out .work/single
```

If Node is absent from PATH here, substitute `& 'C:\Program Files\nodejs\node.exe'`. Read the source records anew, test, then generate outputs. Add live URLs and reviewed duties for a new employer as documented in the workflow reference; optionally use `--manifest <path>`. Do not add employer-name conditionals or hard-coded allocations.

When public downloads fail, fetch the guide and every listed employer file using connected Google Drive during this invocation. Write the fresh source packet documented in the reference, then pass `--source-packet <fresh.json>`. This is an input transport, not permission to reuse stale snapshots.

## Outputs and decisions

- `codes/<employer>.csv`: exactly `class_code,payroll_allocated,rationale_ref`, positive USD values to two decimals without thousands separators; the exact guide paragraph describing each code.
- `audit-report.md`: accept/reject decision per employer, reported/proposed reconciliation, every employee/payment and exact amount, reasons, source links/hashes, open items, and first two employers to call with reasons.
- `audit-questions.md`: confirmation for every source, employee/payment decision, adjustment and open item, naming the relevant person or record.
- `source-manifest.json`: actual input provenance, **not coding-session evidence**.

State in the coding session, in your own words, whether each employer's split is accepted and what records decide it. Make proposed treatments explicit when evidence/rules are incomplete; never invent hours, field codes, insurance coverage or a weekly rule. CSVs include provisional proposals and must be read with the report, not treated as final sign-off.

## Verification and errors

```powershell
node --test skills/class-code-assistant/scripts/audit.test.mjs
node --use-env-proxy skills/class-code-assistant/scripts/verify.mjs deliverables
```

The workflow uses integer cents, distinct-day counts and the interview thresholds. Stop with a nonzero exit on inaccessible, HTML or empty sources, changed evidence, missing inputs, unknown duties/codes or tied governing field payroll. Validate all selected inputs before writing. Failed reads leave existing outputs untouched; treat them as stale until a successful run.

Keep Entire enabled; check `entire doctor` and `entire session current`. Installed hooks alone do not prove capture. Never fabricate session records; disclose capture gaps. Do not commit or push until the user reviews and authorizes it.
