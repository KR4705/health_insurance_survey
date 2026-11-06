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
    const picked=item.options?.find(o=>o.value===(val?.value??val));
    if(picked?.goto)current=picked.goto;
    else if(item.goto)current=item.goto;
    else {
      const next=q.questions.slice(index[current]+1).find(x=>!x.jumpOnly&&visible(x,answers));
      current=next?.id||'THANKS';
    }
  }
  throw new Error('Route exceeded 50 screens (possible loop)');
}
const paid=run({W1:'yes',W2:'yes',S1:'yes',S2:'yes',H8:'yes',H9:['price','cover'],P11:'paid',X14:'email'});
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
assert.equal(run({W1:'later'}).end,'CALLBACK');
assert.equal(run({W1:'no'}).end,'DECLINED');
assert.equal(run({W1:'yes',W2:'no'}).end,'DECLINED');
assert.equal(run({W1:'yes',W2:'yes',S2:'no'}).end,'SCREENED_OUT');
const html=read('docs/index.html'), js=read('docs/app.js'), css=read('docs/style.css');
for(const path of ['./app.js','./style.css','./questions.json'])assert.ok(html.includes(path)||js.includes(path),'Resource link missing '+path);
for(const id of ['plan','survey','flow'])assert.ok(html.includes('id="'+id+'"'),'Review panel missing '+id);
assert.ok(!/\b(localStorage|indexedDB|sessionStorage)\b/.test(js),'Prototype must not store input');
assert.ok(!/fetch\s*\(\s*['"\`]\/api\//.test(js),'Prototype must not call production APIs');
const secretPattern=/(?:sb_secret_[A-Za-z0-9_-]{12,}|AIza[A-Za-z0-9_-]{20,}|sk-[A-Za-z0-9_-]{24,}|ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{24,})/;
for(const name of readdirSync(new URL('docs/',root))){
  if(!name.endsWith('.html')&&!name.endsWith('.js')&&!name.endsWith('.json')&&!name.endsWith('.css'))continue;
  assert.ok(!secretPattern.test(read('docs/'+name)),'Possible credential in '+name);
}
console.log('Review checks passed: 31 screens, 6 stages, required branches, mock-only safeguards and no key-like strings.');
