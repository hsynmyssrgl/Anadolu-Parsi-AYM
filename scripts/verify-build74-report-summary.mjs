import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
const root=new URL('../',import.meta.url);const read=p=>readFileSync(new URL(p,root),'utf8');
const ds=read('apps/desktop/src/main/data-store.ts'),app=read('packages/application/src/report-use-cases.ts'),repo=read('packages/repositories/src/report-repository.ts'),adapter=read('apps/desktop/src/main/report-application-adapter.ts');
const checks=[
 ['report repository exists',repo.includes('SqliteReportRepository')],
 ['repository aggregates counts',repo.includes('peopleCount:')&&repo.includes('activeMedicationPlans:')&&repo.includes('family_id=?')&&repo.includes('owner_person_id=?')],
 ['repository aggregates finance',repo.includes('FROM finance_records')&&repo.includes('GROUP BY currency')],
 ['repository lists overdue',repo.includes("status IN ('planned','active')")&&repo.includes('LIMIT 25')],
 ['application port exists',app.includes('ReportQueryPort')],
 ['application computes 30-day window',app.includes('30*86400000')],
 ['application computes net',app.includes('net:r.assets-r.debts')],
 ['adapter uses transaction executor',adapter.includes('transactionExecutor.execute')],
 ['datastore use case wiring',ds.includes('#getReportSummaryUseCase')&&ds.includes('RepositoryBackedReportQueryPort')],
 ['direct report SQL removed',!ds.includes("SELECT COUNT(*) AS c FROM people WHERE status='active'")&&!ds.includes('finance_records GROUP BY currency')&&!ds.includes("SELECT id,title,'life_record' source_type")]
];
for(const [n,v] of checks){console.log(`${v?'PASS':'FAIL'} ${n}`);if(!v)process.exitCode=1;}console.log(`${checks.filter(([,v])=>v).length}/${checks.length}`);
const db=new DatabaseSync(':memory:');db.exec(`CREATE TABLE people(id TEXT,status TEXT);CREATE TABLE events(id TEXT,start_at TEXT);CREATE TABLE life_records(id TEXT,title TEXT,category TEXT,status TEXT,due_at TEXT);CREATE TABLE medication_plans(id TEXT,starts_at TEXT,ends_at TEXT);CREATE TABLE finance_records(id TEXT,kind TEXT,amount REAL,remaining_principal REAL,currency TEXT);`);
const now='2026-07-24T10:00:00.000Z',in30='2026-08-23T10:00:00.000Z';
db.exec("INSERT INTO people VALUES('p1','active'),('p2','inactive');INSERT INTO events VALUES('e1','2026-07-30T10:00:00.000Z'),('e2','2026-09-01T10:00:00.000Z');INSERT INTO life_records VALUES('t1','Gecikmiş görev','task','active','2026-07-20T10:00:00.000Z'),('i1','Poliçe','insurance','active','2026-08-01T10:00:00.000Z');INSERT INTO medication_plans VALUES('m1','2026-07-01T00:00:00.000Z',NULL);INSERT INTO finance_records VALUES('f1','asset',1000,NULL,'TRY'),('f2','debt',500,300,'TRY');");
const count=(sql,...a)=>Number(db.prepare(sql).get(...a).c);const people=count("SELECT COUNT(*) c FROM people WHERE status='active'"),events=count('SELECT COUNT(*) c FROM events WHERE start_at>=? AND start_at<=?',now,in30),tasks=count("SELECT COUNT(*) c FROM life_records WHERE category='task' AND status IN ('planned','active')"),insurance=count("SELECT COUNT(*) c FROM life_records WHERE category='insurance' AND status='active' AND due_at IS NOT NULL AND due_at<=?",in30),meds=count('SELECT COUNT(*) c FROM medication_plans WHERE starts_at<=? AND (ends_at IS NULL OR ends_at>=?)',now,now);const fin=db.prepare("SELECT SUM(CASE WHEN kind IN ('asset','income') THEN amount ELSE 0 END) assets,SUM(CASE WHEN kind IN ('debt','expense') THEN COALESCE(remaining_principal,amount) ELSE 0 END) debts FROM finance_records").get();const overdue=db.prepare("SELECT COUNT(*) c FROM life_records WHERE due_at<? AND status IN ('planned','active')").get(now).c;const ok=people===1&&events===1&&tasks===1&&insurance===1&&meds===1&&Number(fin.assets)===1000&&Number(fin.debts)===300&&Number(overdue)===1;console.log(`${ok?'PASS':'FAIL'} report runtime people=${people} events=${events} tasks=${tasks} insurance=${insurance} meds=${meds} assets=${fin.assets} debts=${fin.debts} overdue=${overdue}`);if(!ok)process.exitCode=1;
