import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {csv,cents,parseGuide,download,sha,skillDir,usd,classify} from './audit.mjs';
import {checkIndependentAudit} from './expected-audits.mjs';

const escapeRegex = text=>text.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const moneyPattern='-?\\d+\\.\\d{2}';
const signedCents=value=>value.startsWith('-')?-cents(value.slice(1)):cents(value);
const currencyAmounts=text=>[...text.matchAll(/\$([^\s/;:()]+)/g)].map(m=>{
 // Consume the entire token before validating. Permit one sentence/comma terminator,
 // but never discard extra precision, exponents, grouping digits or trailing text.
 const token=m[1].replace(/[.,]$/,'');
 if(!/^-?\d+(?:\.\d{2})?$/.test(token))throw Error(`Report invalid monetary amount: $${m[1]}`);
 return signedCents(token);
});
function checkAmounts(label,actual,expected) {
 if(actual.length!==expected.length || actual.some((v,i)=>v!==expected[i]))throw Error(`Report amounts do not match ${label}`);
}

// Check associations inside each employer section, not global name/number matches.
function verifyReportAmounts(report,result,guide) {
 const r=result,text=report.replaceAll('\r\n','\n');
 if(r.receiptEvidenceUnknown||r.allocations.some(a=>a.unresolved))throw Error(`Report has unresolved payroll or required catering evidence for ${r.slug}; no class allocation can be verified`);
 const headings=[...text.matchAll(/^## (.+)$/gm)],matches=headings.filter(m=>m[1]===r.title);
 if(matches.length!==1)throw Error(`Report employer section missing or duplicated: ${r.title}`);
 const start=matches[0].index+matches[0][0].length,end=headings.find(m=>m.index>matches[0].index)?.index??text.length;
 const section=text.slice(start,end);
 const summary=[...section.matchAll(new RegExp(`Recorded employee wages \\$(${moneyPattern}); added assessable remuneration \\$(${moneyPattern}); proposed allocated payroll \\$(${moneyPattern})\\.`,'g'))];
 if(summary.length!==1)throw Error(`Report payroll summary missing or duplicated for ${r.slug}`);
 checkAmounts(`${r.slug} summary`,summary[0].slice(1).map(signedCents),[r.base,r.addition,r.total]);
 const table=[...section.matchAll(new RegExp(`^\\|\\s*([A-Z]-\\d{3})\\s*\\|\\s*(${moneyPattern})\\s*\\|\\s*(${moneyPattern})\\s*\\|\\s*(${moneyPattern})\\s*\\|\\s*(CG-\\d+)\\s*\\|$`,'gm'))];
 if(table.length!==Object.keys(r.delta).length || new Set(table.map(m=>m[1])).size!==table.length)throw Error(`Report code table missing or duplicated for ${r.slug}`);
 for(const row of table) {
  const code=row[1];
  if(!(code in r.delta) || row[5]!==guide[code]?.ref)throw Error(`Report unexpected code/reference for ${r.slug}/${code}`);
  checkAmounts(`${r.slug}/${code}`,row.slice(2,5).map(signedCents),[r.reported[code]||0,r.totals[code]||0,r.delta[code]]);
 }
 const bullets=section.split('\n').filter(line=>line.startsWith('- **'));
 if(bullets.length!==r.allocations.length)throw Error(`Report employee/payment count differs for ${r.slug}`);
 for(const a of r.allocations) {
  const pattern=new RegExp(`^- \\*\\*${escapeRegex(a.name)} \\(${escapeRegex(a.id)}\\)\\*\\*: \\$(${moneyPattern}) → ([A-Z]-\\d{3}) \\((CG-\\d+)\\)\\. (.*)$`,'gm');
  const rows=[...section.matchAll(pattern)];
  if(rows.length!==1)throw Error(`Report decision missing or duplicated for ${r.slug}/${a.id}`);
  if(rows[0][2]!==a.code || rows[0][3]!==guide[a.code].ref)throw Error(`Report decision code differs for ${r.slug}/${a.id}`);
  checkAmounts(`${r.slug}/${a.id} allocation`,[signedCents(rows[0][1])],[a.amount]);
  // Includes invoice payment amounts, allowance paid/excluded/included and governing payroll.
  checkAmounts(`${r.slug}/${a.id} adjustment rationale`,currencyAmounts(rows[0][4]),currencyAmounts(a.reason));
 }
 const reconciliation=[...section.matchAll(new RegExp(`Payroll conservation: employee wages \\$(${moneyPattern}) \\+ additions \\$(${moneyPattern}) = CSV total \\$(${moneyPattern})\\.`,'g'))];
 if(reconciliation.length!==1)throw Error(`Report conservation statement missing or duplicated for ${r.slug}`);
 checkAmounts(`${r.slug} reconciliation`,reconciliation[0].slice(1).map(signedCents),[r.base,r.addition,r.total]);
 for(const value of [...Object.values(r.metrics),...r.issues])if(value.includes('$')) {
  const prefix='- '+value.slice(0,value.indexOf('$'));
  const lines=section.split('\n').filter(line=>line.startsWith(prefix));
  if(lines.length!==1)throw Error(`Report financial evidence missing or duplicated for ${r.slug}`);
  checkAmounts(`${r.slug} financial evidence`,currencyAmounts(lines[0]),currencyAmounts(value));
 }
}

function verifyPriorityAmounts(report,results) {
 const expected=[...results].sort((a,b)=>b.exposure-a.exposure).slice(0,2);
 const rows=[...report.matchAll(new RegExp(`^(\\d+)\\. \\*\\*(.+?)\\*\\*: \\$(${moneyPattern}) of payroll`,'gm'))];
 if(rows.length!==expected.length)throw Error('Report call-priority amounts missing or duplicated');
 for(let i=0;i<rows.length;i++)if(rows[i][1]!==String(i+1)||rows[i][2]!==expected[i].title||signedCents(rows[i][3])!==expected[i].exposure)throw Error('Report call-priority employer/amount differs');
}

function verifyEmployerQuestions(questions,result,sourceInfo) {
 const text=questions.replaceAll('\r\n','\n'),headings=[...text.matchAll(/^## (.+)$/gm)];
 const matches=headings.filter(m=>m[1]===result.title);
 if(matches.length!==1)throw Error(`Question employer section missing or duplicated: ${result.slug}`);
 const start=matches[0].index+matches[0][0].length,end=headings.find(m=>m.index>matches[0].index)?.index??text.length;
 const section=text.slice(start,end),rows=[...section.matchAll(/^(\d+)\. (.*)$/gm)];
 if(rows.length!==result.questions.length||rows.some((m,i)=>m[1]!==String(i+1)||m[2]!==result.questions[i]))throw Error(`Question evidence/decision differs for ${result.slug}`);
 for(const [name,info] of Object.entries(sourceInfo))if(!section.includes(`[${name}](${info.url}) — SHA-256 ${info.sha256}.`))throw Error(`Question source reference missing for ${result.slug}/${name}`);
}

// Selection is supplied by the caller, never inferred from output provenance.
export async function verify({out='deliverables',manifestPath=path.join(skillDir,'references/sources.json'),employer='all',loadSource=download}={}) {
const manifest=JSON.parse(await fs.readFile(manifestPath,'utf8'));
const provenance=JSON.parse(await fs.readFile(path.join(out,'source-manifest.json'),'utf8'));
const expectedEmployers=manifest.employers.filter(e=>employer==='all'||e.slug===employer).map(e=>e.slug);
const actualEmployers=provenance.employers?.map(e=>e.slug);
if(!expectedEmployers.length || new Set(expectedEmployers).size!==expectedEmployers.length)throw Error('Expected employer selection is empty or duplicated');
if(!actualEmployers || actualEmployers.length!==expectedEmployers.length || new Set(actualEmployers).size!==actualEmployers.length || expectedEmployers.some(slug=>!actualEmployers.includes(slug)))throw Error('Employer outputs do not match expected employer selection');
const guideText=await loadSource(manifest.guide),guide=parseGuide(guideText);
if(sha(guideText)!==provenance.guide.sha256)throw Error('Guide differs from generated output provenance');
if(sha(guideText)!==manifest.guide.sha256)throw Error('Guide differs from reviewed manifest');
const report=await fs.readFile(path.join(out,'audit-report.md'),'utf8'),questions=await fs.readFile(path.join(out,'audit-questions.md'),'utf8');
let count=0;const results=[];
for(const e of provenance.employers){
 const source=manifest.employers.find(m=>m.slug===e.slug);if(!source)throw Error('Unknown manifest employer');
 const docs=Object.fromEntries(await Promise.all(source.files.map(async f=>{const t=await loadSource(f);if(sha(t)!==e.files[f.name].sha256)throw Error(`Source changed: ${e.slug}/${f.name}`);return [f.name,t];})));
 const payroll=csv(docs['payroll-register.csv']);
 // Independent conservation check: this does not call the classifier.
 let expected=payroll.reduce((n,p)=>n+cents(p.wages_paid),0);
 for(const p of payroll)if(p.travel_allowance_paid)expected+=Math.max(0,cents(p.travel_allowance_paid)-4700*Number(p.travel_days));
 const [start,end]=docs['business-description.md'].match(/Audit period (.+?) to (.+?)\./).slice(1).map(t=>new Date(t+' UTC').toISOString().slice(0,10));
 const review=JSON.parse(await fs.readFile(path.resolve(path.dirname(manifestPath),source.review),'utf8'));
 // Recompute class allocations from current records and hash-validated duty reviews.
 // Keep the separate conservation check below as an additional invariant.
 const result=classify({slug:e.slug,documents:docs,review,guide});
 const independent=await checkIndependentAudit({slug:e.slug,documents:docs,guideText,result});
 const expectedByClass=independent?.totals||result.totals;
 verifyEmployerQuestions(questions,result,e.files);
 verifyReportAmounts(report,result,guide);results.push(result);
 for(const p of docs['subcontractor-payments.csv']?csv(docs['subcontractor-payments.csv']):[]){
   const certs=csv(docs['insurance-certificates.csv']);
   const entity=review.subcontractorAliases?.[p.subcontractor]||p.subcontractor;
   if(!certs.some(c=>c.subcontractor===entity&&c.coverage_from<=start&&c.coverage_to>=end))expected+=Math.round(cents(p.amount_paid)*.6);
   if(!questions.includes(p.invoice)||!report.includes(p.invoice))throw Error('Missing payment evidence/question');
 }
 const text=await fs.readFile(path.join(out,'codes',e.slug+'.csv'),'utf8');
 if(text.split(/\r?\n/)[0]!=='class_code,payroll_allocated,rationale_ref')throw Error('Incorrect CSV header');
 const codes=csv(text),seen=new Set();let actual=0;
 for(const c of codes){if(seen.has(c.class_code)||!guide[c.class_code]||guide[c.class_code].ref!==c.rationale_ref||!/^\d+\.\d{2}$/.test(c.payroll_allocated)||cents(c.payroll_allocated)<=0)throw Error('Invalid output code/amount/reference');seen.add(c.class_code);actual+=cents(c.payroll_allocated);}
 if(actual!==expected)throw Error(`Payroll conservation failed for ${e.slug}: ${actual} != ${expected}`);
 const actualByClass=Object.fromEntries(codes.map(c=>[c.class_code,cents(c.payroll_allocated)]));
 for(const code of new Set([...Object.keys(expectedByClass),...Object.keys(actualByClass)]))if(actualByClass[code]!==expectedByClass[code])throw Error(`Payroll allocation failed for ${e.slug}/${code}: ${actualByClass[code]??0} != ${expectedByClass[code]??0}`);
 for(const p of payroll)if(!report.includes(p.name)||!questions.includes(p.name))throw Error('Employee decision/confirmation missing');
 for(const name of Object.keys(docs))if(!report.includes(e.files[name].url)||!questions.includes(name))throw Error('Source evidence/confirmation missing');
 console.log(`PASS ${e.slug}: schema, current source hashes, references, class allocations${independent?', independent employee/payment baseline':''}, conservation $${usd(actual)}, employer-scoped questions`);count++;
}
verifyPriorityAmounts(report,results);
if(sha(await fs.readFile(manifest.interview.path))!==manifest.interview.sha256)throw Error('Original interview hash changed');
console.log(`Verified ${count} employer output(s); original interview hash preserved.`);
return count;
}
if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
 try {
  if(process.argv.length>5)throw Error('Usage: verify.mjs [output folder] [manifest path] [all|employer-slug]');
  await verify({out:process.argv[2],manifestPath:process.argv[3],employer:process.argv[4]});
 } catch(e) {console.error('VERIFICATION FAILED:',e.message);process.exitCode=1;}
}
