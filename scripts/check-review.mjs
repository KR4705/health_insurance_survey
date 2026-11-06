import assert from 'node:assert/strict';
import {readFileSync, readdirSync} from 'node:fs';
import {join} from 'node:path';
const root = new URL('../', import.meta.url);
const read = name => readFileSync(new URL(name, root), 'utf8');
const q = JSON.parse(read('docs/questions.json'));
const ids = q.questions.map(x => x.id);
assert.equal(new Set(ids).size, ids.length, 'All question ids must be unique');
assert.equal(q.steps.length, 6, 'Six main research stages expected');
assert.equal(q.questions.length, 31, 'Canonical quote journey currently includes 31 screens');
const index = Object.fromEntries(ids.map((id,i)=>[id,i]));
for (const item of q.questions) {
  for(const dest of [item.goto,item.primary?.goto,item.secondary?.goto,...(item.options||[]).map(o=>o.goto)].filter(Boolean))
    assert.ok(ids.includes(dest),item.id+' has unknown goto '+dest);
  for(const condition of [item.showIf,item.hideIf].filter(Boolean))
    for(const ref of Object.keys(condition))assert.ok(index[ref] < index[item.id],item.id+' conditions must refer to earlier questions: '+ref);
}
function visible(item,answers) {
  for (const type of ['showIf','hideIf']) {
    const rule = item[type];
    if(!rule)continue;
    const matches = Object.entries(rule).every(([id,expected])=>{
      const raw = answers[id]?.value ?? answers[id];
      return Array.isArray(expected) ? expected.includes(raw):raw===expected;
    });
    if(type==='showIf'&&!matches)return false;
    if(type==='hideIf'&&matches)return false;
  }
  return true;
}
function run(choices={}) {
  const answers={};const path=[]; let current='INTRO';
  for (let tick=0;tick<50;tick++) {
    const item=q.questions[index[current]]; assert.ok(item,'Missing screen: '+current);path.push(current);
    if(item.terminal)return {path,answers,end:current};
    let val = choices[current] ?? (item.type==='multi' ? ['price'] : item.type==='single' ? item.options[0].value : item.type==='message'||item.type==='welcome'?'yes' : item.type==='scale'?3 : item.type==='text'?Object.fromEntries(item.fields.map(x=>[x.name,'sample'])):item.type==='voice'?{answer_final:'sample',notes:[],interpretations:[],edited:false}:{skipped:true});
    answers[current]=val;
    const picked=item.options?.find(o=>o.value===(val?.value??val)) || [item.primary,item.secondary].find(o=>o?.value===(val?.value??val));
    if(picked?.goto)current=picked.goto;
    else if(item.goto)current=item.goto;
    else {
      const next=q.questions.slice(index[current]+1).find(x=>!x.jumpOnly&&visible(x,answers));
      current=next?.id||'THANKS';
    }
  }
  throw new Error('Route exceeded 50 screens (possible loop)');
}
const paid=run({W1:'yes',W2:'yes',S1:'yes',S2:'yes',H8:'yes',H9:['price','cover'],P11:'paid',X14:'guide'});
assert.equal(paid.end,'THANKS');
assert.ok(paid.path.includes('H9v')&&paid.path.includes('H10'),'Hesitation branch visible');
assert.ok(paid.path.includes('P12a')&&paid.path.includes('P12c'),'Paid branch visible');
assert.ok(!paid.path.includes('P12b'),'Paid branch excludes non-buyer question');
assert.ok(paid.path.includes('X14c'),'Guide email reveals delivery field');
const dropped=run({W1:'yes',W2:'yes',S1:'maybe',S2:'yes',H8:'no',P11:'dropped',X14:'no'});
assert.equal(dropped.end,'THANKS');
assert.ok(dropped.path.includes('S1b')&&dropped.path.includes('S1bv'),'Maybe branch visible');
assert.ok(!dropped.path.includes('H9')&&!dropped.path.includes('H10'),'No hesitation bypasses blockers');
assert.ok(dropped.path.includes('P12b')&&!dropped.path.includes('P12a'),'Dropped branch visible');
assert.ok(!dropped.path.includes('X14c'),'Declining guide skips collection');
const later=run({W1:'later'});
assert.equal(later.end,'CALLBACK');
assert.ok(!later.path.includes('C00'),'Reminder branch must not require sign-in');
assert.ok(index.W1<index.C00,'Five-minute question must precede sign-in');
assert.ok(index.CB<index.C00,'One-time reminder form must be before sign-in');
const noThanks=run({W1:'no'});
assert.equal(noThanks.end,'DECLINED');
assert.ok(!noThanks.path.includes('C00'),'No thanks should not require sign-in');
assert.equal(run({W1:'yes',W2:'no'}).end,'DECLINED');
assert.equal(run({W1:'yes',W2:'yes',S2:'no'}).end,'SCREENED_OUT');
const get = id => q.questions[index[id]];
assert.deepEqual(get('X14').options.map(o=>o.value),['guide','findings','both','no'],'Email delivery choices must include both research materials');
assert.equal(get('X14').delivery,'email_only');
assert.equal(get('X14c').fields[0].name,'email');
assert.ok(get('CB').fields.some(f=>f.name==='timezone'),'Automated reminder requires time zone');
assert.ok(get('CB').fields.some(f=>f.name==='email'),'Automated reminder uses email only');
assert.equal(get('H9').layout,'tiles');
assert.equal(new Set(get('H9').options.map(x=>x.group)).size,4,'Blocker reasons need logical tile groups');
assert.deepEqual(get('Q7').scaleLabels,['Very unsure','A little unsure','Not sure','Fairly sure','Very sure']);
assert.match(get('P12c').title,/understood what the plan would cover/i,'Payment confidence must have an explicit object');
assert.match(get('X13').title,/what else/i,'Improvement question should invite additional needs');
assert.equal(q.voiceExperience.requiresConfirmation,false);
assert.equal(q.voiceExperience.rawTranscriptVisible,false);
assert.equal(q.voiceExperience.autoContinueAfterReadback,true);
assert.equal(q.voiceExperience.readbackTitle,'I understood');
const html=read('docs/index.html'), js=read('docs/app.js'), css=read('docs/style.css');
assert.ok(!js.includes('Here’s what you said')&&!js.includes('Confirm my answer'),'New voice experience should not expose old mandatory confirmation UI');
assert.ok(js.includes('tile-grid')&&css.includes('.tile-grid'),'Tile layout must be styled and rendered');
for(const path of ['./app.js','./style.css','./questions.json'])assert.ok(html.includes(path)||js.includes(path),'Resource link missing '+path);
for(const id of ['plan','survey','flow'])assert.ok(html.includes('id="'+id+'"'),'Review panel missing '+id);
assert.ok(!/\b(localStorage|indexedDB|sessionStorage)\b/.test(js),'Prototype must not store input');
assert.ok(!/fetch\s*\(\s*['"\`]\/api\//.test(js),'Prototype must not call production APIs');
const secretPattern=/(?:sb_secret_[A-Za-z0-9_-]{12,}|AIza[A-Za-z0-9_-]{20,}|sk-[A-Za-z0-9_-]{24,}|ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{24,})/;
for(const name of readdirSync(new URL('docs/',root))){
  if(!name.endsWith('.html')&&!name.endsWith('.js')&&!name.endsWith('.json')&&!name.endsWith('.css'))continue;
  assert.ok(!secretPattern.test(read('docs/'+name)),'Possible credential in '+name);
}
console.log('Review v2 checks passed: revised flow order, email-only follow-ups, grouped tiles, new voice behavior, exit branches and no exposed credentials.');
