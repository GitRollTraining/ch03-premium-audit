// Independently reviewed baseline, not a second general-purpose classifier.
// Decisions transcribed from the guide/interview and source records on 2026-11-02.
// Never regenerate these expectations from classify(), CSV outputs or reports.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';

// Rows: employee ID, expected code, source wages, independently assessed allowance addition.
// Explicit amounts also detect accidental source/payroll changes in frozen evidence.
export const expectedAudits={
 'severn-homebuilders':{
  employees:[['SH-E01','H-420','66315.40'],['SH-E02','H-420','62780.15'],['SH-E03','H-420','58442.60'],['SH-E04','H-420','49905.85'],['SH-E05','H-420','47226.30'],['SH-E06','C-110','71250.45'],['SH-E07','H-420','59840.70'],['SH-E08','C-110','46118.25']],
  // Invoice, code, paid USD, full-period coverage. Kent remains assessable even before expiry.
  payments:[['SV-TRF-01','H-420','21480.00',true],['SV-KEN-01','R-310','14300.00',false],['SV-TID-01','H-420','18240.55',false],['SV-TRF-02','H-420','18925.50',true],['SV-TID-02','H-420','22915.10',false],['SV-KEN-02','R-310','19880.45',false],['SV-TRF-03','H-420','24610.25',true],['SV-KEN-03','R-310','11765.20',false]],
  totals:{'C-110':11736870,'H-420':36920439,'R-310':2756739},base:46187970,addition:5226078,total:51414048,accept:false,exposure:11210148,
  basis:'CG-15 own crew; Marissa 4 site dates retains C-110; Dana 11 transfers whole pay to H-420 (interview 11:00–11:01). CG-06/interview 10:56,10:59: uninsured payments ×60%, half-up per payment. Tenbury spans period; Kent does not; Tidewater has no certificate.'
 },
 'patuxent-electric':{
  employees:[['PE-E01','E-510','118000.00'],['PE-E02','E-510','72410.35','720.00'],['PE-E03','E-510','69855.90','720.00'],['PE-E04','E-510','64120.65','720.00'],['PE-E05','E-510','58377.20'],['PE-E06','E-510','41260.75','390.00'],['PE-E07','C-110','43905.60']],
  totals:{'C-110':4390560,'E-510':42657485},base:46793045,addition:255000,total:47048045,accept:false,exposure:12055000,
  basis:'CG-05/CG-21: included owner Raymond pulls wire, not clerical. Curtis/Hector/Aaron: $2600 −40×$47=$720 each. Tyrone: $1034 −22×$47=$0. Kyle: $390 with zero days is provisionally included, not a settled expense decision (interview 11:00). Linda stays office.'
 },
 'larkspur-lane-bistro':{
  employees:[['LL-E01','F-710','52310.45'],['LL-E02','F-710','41872.30'],['LL-E03','F-710','39640.15'],['LL-E04','F-710','33215.80'],['LL-E05','F-710','31904.65'],['LL-E06','F-710','27488.20'],['LL-E07','F-710','46725.55'],['LL-E08','F-710','38190.40'],['LL-E09','F-710','29377.85']],
  totals:{'F-710':34072535},base:34072535,addition:0,total:34072535,accept:false,exposure:11429380,
  basis:'CG-41/42 plus interview 10:58: $362410.85 catering / $1647026.05 total <40%. All F-710 provisionally; July 2025–June 2026 receipt window is not audit-period approval.'
 },
 'harbor-point-legal':{
  employees:[['HP-E01','C-110','128400.00'],['HP-E02','C-110','121750.00'],['HP-E03','C-110','64212.48'],['HP-E04','C-110','51880.16'],['HP-E05','C-110','58905.52']],
  totals:{'C-110':42514816},base:42514816,addition:0,total:42514816,accept:true,exposure:0,
  basis:'CG-04 office duties; field notes distinguish court/closings from jobsites. Tomas has 6 sign-in dates but no demonstrated field duties/governing field code: retained provisionally pending reconciliation.'
 },
 'bay-crest-exteriors':{
  employees:[['BC-E01','R-310','61240.55'],['BC-E02','R-310','58976.20'],['BC-E03','R-310','57310.85'],['BC-E04','R-310','54880.40'],['BC-E05','R-310','52115.75'],['BC-E06','R-310','49607.30'],['BC-E07','R-310','47918.65'],['BC-E08','R-320','46205.10'],['BC-E09','R-310','68430.90'],['BC-E10','C-110','44812.35']],
  totals:{'C-110':4481235,'R-310':45048060,'R-320':4620510},base:54149805,addition:0,total:54149805,accept:false,exposure:31915810,
  basis:'Interview 10:57 overrides generic time division: roof dates 188,176,201,164,152,97,15,9. Rafael at 15 is R-310; Jamal at 9 is R-320. Teresa 9 site dates moves to largest field payroll R-310; Nora stays C-110.'
 },
 'annapolis-courier':{
  employees:[['AC-E01','T-610','52956.80'],['AC-E02','T-610','51311.00'],['AC-E03','T-610','49618.40'],['AC-E04','T-610','47442.20'],['AC-E05','T-610','46675.20'],['AC-E06','C-110','36511.80']],
  totals:{'C-110':3651180,'T-610':24800360},base:28451540,addition:0,total:28451540,accept:false,exposure:9411740,
  basis:'CG-31 drivers/helpers. Lena 60 and Paul 2 ride dates: existing whole-pay T-610 proposals only, NOT approved policy. CG-07 needs duty time; neither weekly gross nor route dates justify fractions. Irene stays C-110.'
 }
};

// Separate exact arithmetic: no production cents(), travelIncluded(), fullCoverage(),
// roofCode(), classify() or generated results are used to construct expectations.
const money=s=>{assert.match(s,/^\d+\.\d{2}$/);return BigInt(s.replace('.',''));};
export function calculateExpected(slug) {
 const b=expectedAudits[slug];assert.ok(b,'Unknown baseline employer');
 const allocations=b.employees.map(([id,code,wages,extra='0.00'])=>({id,code,amount:Number(money(wages)+money(extra))}));
 for(const [id,code,paid,covered] of b.payments||[])allocations.push({id,code,amount:covered?0:Number((money(paid)*60n+50n)/100n)});
 const totals={};for(const a of allocations)if(a.amount)totals[a.code]=(totals[a.code]||0)+a.amount;
 assert.deepEqual(totals,b.totals,`${slug}: hand-reviewed class totals disagree with independent arithmetic`);
 assert.equal(b.employees.reduce((n,r)=>n+Number(money(r[2])),0),b.base);
 assert.equal(Object.values(totals).reduce((a,b)=>a+b,0),b.total);
 assert.equal(b.total-b.base,b.addition);
 return {...b,allocations,totals};
}
const hash=s=>createHash('sha256').update(s).digest('hex');
export async function checkIndependentAudit({slug,documents,guideText,result}) {
 if(!Object.hasOwn(expectedAudits,slug))return null; // New employers need their own reviewed baseline.
 const fixture=JSON.parse(await fs.readFile(new URL('./fixtures/six-employer-sources.json',import.meta.url),'utf8'));
 const source=fixture.employers.find(e=>e.slug===slug);
 assert.equal(hash(guideText),fixture.guideHash,'Independent baseline guide changed; review expectations');
 assert.deepEqual(Object.keys(documents).sort(),Object.keys(source.sourceHashes).sort(),'Independent baseline source inventory changed');
 for(const [name,digest] of Object.entries(source.sourceHashes))assert.equal(hash(documents[name]),digest,`${slug}/${name}: independent baseline evidence changed; review before updating`);
 const expected=calculateExpected(slug);
 assert.deepEqual(result.totals,expected.totals,`${slug}: independent class expectation failed`);
 const decisions=result.allocations.map(({id,code,amount})=>({id,code,amount})).sort((a,b)=>a.id.localeCompare(b.id));
 assert.deepEqual(decisions,[...expected.allocations].sort((a,b)=>a.id.localeCompare(b.id)),`${slug}: independent employee/payment expectation failed`);
 for(const key of ['base','addition','total','accept','exposure'])assert.equal(result[key],expected[key],`${slug}: independent ${key} expectation failed`);
 return expected;
}
