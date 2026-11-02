import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {csv,cents,parseGuide,download,sha,skillDir,usd,classify} from './audit.mjs';

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
let count=0;
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
 const expectedByClass=classify({slug:e.slug,documents:docs,review,guide}).totals;
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
 console.log(`PASS ${e.slug}: schema, current source hashes, references, class allocations, conservation $${usd(actual)}, employee/payment confirmations`);count++;
}
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
