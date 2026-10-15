'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),{loadDropperSource}=require('./load-source.cjs');const source=loadDropperSource();
test('timeline is bounded, deduplicated and does not retain page text or credentials',()=>{const store=new Map(),c={Date,Number,Array,Object,cleanText:v=>String(v||''),readSession:(key,fallback)=>store.get(key)||fallback,writeSession:(key,value)=>store.set(key,value)};
 for(const name of ['recordProgressTimeline','progressTimelineSnapshot']){const m=new RegExp('  function '+name+'\\([^]*?\\n  \\}').exec(source);assert.ok(m,name);vm.runInNewContext(m[0],c);}for(let i=0;i<40;i++)c.recordProgressTimeline('progress',{currentMinutes:i,reason:'credited',token:'private',pageText:'private'});c.recordProgressTimeline('progress',{currentMinutes:39,reason:'credited'});const rows=c.progressTimelineSnapshot();assert.equal(rows.length,30);assert.equal(rows.at(-1).minutes,39);assert.ok(rows.every(r=>!('token'in r)&&!('pageText'in r)));});

function timelineContext(now){const store=new Map(),c={Date:{now:()=>now.value},Number,Array,Object,cleanText:v=>String(v||'').trim(),readSession:(key,fallback)=>store.get(key)||fallback,writeSession:(key,value)=>store.set(key,value)};
 const table=/  const NAVIGATION_REASON_TEXT = [^]*?\n  \}\);/.exec(source);assert.ok(table,'navigation reason table');vm.runInNewContext(table[0].replace('const ','var '),c);
 for(const name of ['navigationReasonText','recordProgressTimeline','progressTimelineSnapshot']){const m=new RegExp('  function '+name+'\\([^]*?\\n  \\}').exec(source);assert.ok(m,name);vm.runInNewContext(m[0],c);}return c;}

test('alternating status checks from the diagnostics report collapse to one row each',()=>{
 const now={value:1000},c=timelineContext(now);
 for(let i=0;i<6;i++){now.value+=30000;c.recordProgressTimeline('progress',{reason:'One More · progress pending'});now.value+=1000;c.recordProgressTimeline('stream-verification-evidence',{message:'Twitch GQL confirmed target campaign support'});}
 assert.deepEqual([...c.progressTimelineSnapshot().map(r=>r.type)],['progress','stream-verification-evidence']);
 now.value+=11*60*1000;c.recordProgressTimeline('progress',{reason:'One More · progress pending'});
 assert.equal(c.progressTimelineSnapshot().length,3,'the same status is recorded again after ten minutes');
 c.recordProgressTimeline('progress',{reason:'Twitch credited progress',currentMinutes:1});c.recordProgressTimeline('progress',{reason:'Twitch credited progress',currentMinutes:2});
 assert.deepEqual([...c.progressTimelineSnapshot().slice(-2).map(r=>r.minutes)],[1,2],'new credited minutes are always recorded');
});

test('unknown progress stays unknown while an actual zero remains zero',()=>{
 const now={value:1000},c=timelineContext(now);
 c.recordProgressTimeline('progress',{reason:'Pending',currentMinutes:null});
 now.value+=1000;c.recordProgressTimeline('progress',{reason:'Observed zero',currentMinutes:0});
 assert.deepEqual([...c.progressTimelineSnapshot().map(row=>row.minutes)],[null,0]);
});

test('navigation rows use plain language instead of routing codes',()=>{
 const now={value:1000},c=timelineContext(now);
 c.recordProgressTimeline('navigation',{reason:'routing-find-category',message:'Automatic Twitch navigation'});
 now.value+=1000;c.recordProgressTimeline('navigation',{reason:'routing-open-drops-verification-stream'});
 now.value+=1000;c.recordProgressTimeline('navigation',{reason:'routing-something-new'});
 assert.deepEqual([...c.progressTimelineSnapshot().map(r=>r.reason)],['Looking for a stream in the game category','Opening a Drops stream to check eligibility','Something new']);
 assert.ok(c.progressTimelineSnapshot().every(r=>!/routing-/.test(r.reason)));
});

test('System activity does not repeat navigation already in the timeline, and diagnostics avoid duplicate stream lists',()=>{
 const start=source.indexOf('  function mountProductTools()'),body=source.slice(start,source.indexOf('\n  function bindDropperControls',start));
 assert.match(body,/filter\(e=>e\.type==='playback'\)/);assert.doesNotMatch(body,/e\.type==='navigation'/);
 assert.match(source,/matchingActiveCampaign: diagnosticStandbyMatches\.filter\(\(item\) => !diagnosticVisibleLogins\.has/);
 assert.match(source,/campaignKey: cleanText\(item\.campaignKey \|\| item\.campaignId\)\.slice\(0, 8\) \|\| null/);
});

test('actual stream outcome activity reaches the bounded progress timeline without credentials',()=>{
 const now={value:1000},c=timelineContext(now);Object.assign(c,{activityLog:[],ACTIVITY_LOG_LIMIT:100,ACTIVITY_LOG_KEY:'activity',renderRoutingHistory:()=>{}});
 for(const name of ['sanitizeDiagnosticMeta','logActivity']){const m=new RegExp('  function '+name+'\\([^]*?\\n  \\}').exec(source);assert.ok(m,name);vm.runInNewContext(m[0],c);}
 c.logActivity('stream-verified','Compatible Drops stream verified',{channel:'example',token:'private'});
 now.value+=1000;c.logActivity('stream-rejected','Stream did not verify for active campaign',{reason:'wrong-campaign',authorization:'private'});
 const rows=c.progressTimelineSnapshot();assert.deepEqual(Array.from(rows,r=>r.type),['stream-verified','stream-rejected']);
 assert.equal(rows[1].reason,'wrong-campaign');assert.ok(!JSON.stringify(rows).includes('private'));
});
