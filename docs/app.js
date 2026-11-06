/* Quote Journey review-only prototype: no network writes, external APIs, credentials or respondent persistence. */
(() => {
  'use strict';
  const tabs = ['plan', 'survey', 'flow'];
  const state = { questions: [], steps: [], current: 'INTRO', history: [], answers: {}, picks: {}, fields: {}, other: {}, voiceText: {}, voiceMode: {}, versions: {}, previewReadback: null, demoSignedIn: false, demoEmail: 'demo@example.com', demoName: 'Demo respondent', signinAlternative: false, error: '', navLock: false };
  const byId = id => document.getElementById(id);
  const esc = value => String(value == null ? '' : value).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const currentQuestion = () => state.questions.find(q => q.id === state.current);
  const isVisible = q => {
    for (const field of ['showIf','hideIf']) {
      if (!q[field]) continue;
      const allMatch = Object.entries(q[field]).every(([id, expected]) => {
        const got = state.answers[id];
        const raw = got && typeof got === 'object' && !Array.isArray(got) && 'value' in got ? got.value : got;
        return Array.isArray(expected) ? expected.includes(raw) : raw === expected;
      });
      if (field === 'showIf' && !allMatch) return false;
      if (field === 'hideIf' && allMatch) return false;
    }
    return true;
  };
  function nextId(q, answer) {
    const picked = (q.options || []).find(o => o.value === (answer && typeof answer === 'object' && !Array.isArray(answer) ? answer.value : answer));
    if (picked && picked.goto) return picked.goto;
    if (q.goto) return q.goto;
    const i = state.questions.indexOf(q);
    for (let j = i + 1; j < state.questions.length; j++) {
      const candidate = state.questions[j];
      if (!candidate.jumpOnly && isVisible(candidate)) return candidate.id;
    }
    return 'THANKS';
  }
  function clearLater(q) {
    const index = state.questions.indexOf(q);
    state.questions.slice(index+1).forEach(x => {
      delete state.answers[x.id]; delete state.picks[x.id]; delete state.fields[x.id]; delete state.other[x.id];
      delete state.voiceText[x.id]; delete state.versions[x.id]; delete state.voiceMode[x.id];
    });
  }
  function navigate(id) {
    if (state.navLock) return;
    state.current = id;
    state.error = '';
    state.previewReadback = null;
    render(true);
  }
  function advance(answer, selectedOption) {
    if (state.navLock) return;
    const q = currentQuestion();
    if (!q) return;
    const prior = JSON.stringify(state.answers[q.id]);
    const next = JSON.stringify(answer);
    if (prior !== next) clearLater(q);
    state.answers[q.id] = answer;
    state.history.push(q.id);
    navigate((selectedOption && selectedOption.goto) || nextId(q, answer));
  }
  function back() {
    if (state.navLock || !state.history.length) return;
    state.current = state.history.pop();
    state.previewReadback = null;
    state.error = '';
    render(true);
  }
  function resetDemo() {
    Object.assign(state, {current:'INTRO',history:[],answers:{},picks:{},fields:{},other:{},voiceText:{},voiceMode:{},versions:{},previewReadback:null,demoSignedIn:false,demoEmail:'demo@example.com',demoName:'Demo respondent',signinAlternative:false,error:'',navLock:false});
    render(true);
  }
  function buttons(primary, secondary) {
    let html = '<div class="q-actions'+(secondary?' two':'')+'">';
    html += '<button type="button" class="button button-primary" data-action="'+esc(primary.action || 'primary')+'">'+esc(primary.label)+'</button>';
    if (secondary) html += '<button type="button" class="button button-secondary" data-action="'+esc(secondary.action || 'secondary')+'">'+esc(secondary.label)+'</button>';
    return html + '</div>';
  }
  function render(focus) {
    const host = byId('surveyStage');
    if (!host) return;
    const q = currentQuestion();
    if (!q) { host.innerHTML='<div class="survey-inner"><p>Could not load this screen. Restart the demo.</p></div>';return; }
    const prog = q.step == null ? 100 : Math.round(((q.step+1)/state.steps.length)*100);
    const heading = q.title.replace(/\{first\}/g, state.demoSignedIn ? state.demoName.split(' ')[0] : '').replace(/\s+,/g,',').replace(/,\s*\./g,'.').replace(/\s+\./g,'.');
    let html='<div class="survey-inner">';
    html += '<div class="survey-nav"><button type="button" class="back-btn" data-action="back" '+(!state.history.length || q.terminal?'disabled':'')+'>← Back</button><span class="question-step">'+(q.step == null?'Final screen':esc(state.steps[q.step]+' · '+(q.step+1)+'/6'))+'</span></div>';
    html += '<div class="progress-track" aria-hidden="true"><div class="progress-fill" style="width:'+prog+'%"></div></div>';
    html += '<h2 id="demoQuestionTitle" class="q-title" tabindex="-1">'+esc(heading)+'</h2>';
    if(q.lead) html+='<p class="q-helper">'+esc(q.lead)+'</p>';
    if(q.helper) html+='<p class="q-helper">'+esc(q.helper)+'</p>';
    if(q.body && q.id!=='Q21') html+=q.body.map(text=>'<p class="q-body">'+esc(text)+'</p>').join('');
    if (q.id === 'INTRO') {
      html += '<div class="hero-intro"><h3>'+esc(q.whyTitle || 'Why it matters')+'</h3><p>'+esc((q.why || []).join(' '))+'</p></div>';
      html += '<p class="q-helper">'+esc((q.facts || []).join(' · '))+'</p><p class="micro">'+esc(q.smallPrint || '')+'</p>';
      html += buttons({label:'Get started',action:'intro'});
    } else if(q.id === 'C00'){
      if (!state.demoSignedIn) {
        html += '<div class="inline-note"><strong>Simulation only.</strong> No real Google account is accessed. Use made-up details if trying the alternative.</div>';
        html += buttons({label:'Continue with demo Google identity',action:'mock-google'});
        html += '<button class="back-btn" type="button" data-action="toggle-contact">'+esc(q.contactToggle || 'Use email or mobile instead')+'</button>';
        if (state.signinAlternative){
          html += '<label class="form-field">Email or mobile (test details only)<input id="testContact" type="text" inputmode="email" autocomplete="off" placeholder="e.g. demo@example.com" value="'+esc(state.fields.signinContact || '')+'"></label>';
          html += '<label class="form-field">First name (optional)<input id="testName" type="text" autocomplete="off" placeholder="e.g. Demo" value="'+esc(state.fields.signinName || '')+'"></label>';
          html += buttons({label:'Continue with sample contact',action:'mock-contact'});
        }
      } else {
        html += '<div class="inline-note">Simulated identity: '+esc(state.demoEmail)+' — no sign-in or save occurs.</div>';
        html += buttons({label:"Yes, let's start",action:'signin-yes'},{label:'No thanks',action:'signin-no'});
        html += '<button class="back-btn" type="button" data-action="not-you">Not you? Restart identity</button>';
      }
      html += '<p class="micro">The real app will prioritize the official Google button and offer an email/mobile alternative.</p>';
    } else if (q.type === 'single' || q.type === 'multi') {
      const saved = state.picks[q.id] !== undefined ? state.picks[q.id] : state.answers[q.id];
      const selected = q.type === 'multi' ? (Array.isArray(saved) ? saved : []) : (saved && typeof saved === 'object' ? saved.value : saved);
      html += '<div class="q-options" role="'+(q.type==='single'?'radiogroup':'group')+'" aria-label="'+esc(q.title)+'">';
      (q.options || []).forEach((o,i) => {
        const on = q.type === 'multi' ? selected.includes(o.value) : selected === o.value;
        html += '<button type="button" class="q-option '+(on?'selected':'')+'" role="'+(q.type==='single'?'radio':'checkbox')+'" aria-checked="'+on+'" tabindex="'+(q.type==='single' && i>0 && !on ? '-1':'0')+'" data-choice="'+esc(o.value)+'">';
        html += '<span class="emoji" aria-hidden="true">'+esc(o.emoji||'○')+'</span><span>'+esc(o.label)+'</span><span class="selection-mark" aria-hidden="true">'+(on?'✓':'')+'</span></button>';
      });
      html += '</div>';
      if (q.type === 'single' && selected === 'other' && (q.options || []).some(o => o.value==='other' && o.other)){
        html += '<label class="form-field">Tell us more<input type="text" maxlength="500" id="otherText" value="'+esc(state.other[q.id] || (state.answers[q.id] && state.answers[q.id].text) || '')+'" placeholder="Your answer"></label>';
      }
      html += buttons({label:'Continue',action:'choice-continue'});
    } else if (q.type === 'scale') {
      const saved = state.picks[q.id] !== undefined ? state.picks[q.id] : state.answers[q.id];
      html+='<div class="scale-options" role="radiogroup" aria-label="'+esc(q.title)+'">';
      for(let i=q.min;i<=q.max;i++) html+='<button type="button" class="q-option '+(saved===i?'selected':'')+'" role="radio" aria-checked="'+(saved===i)+'" data-scale="'+i+'">'+i+'</button>';
      html+='</div><div class="scale-labels"><span>'+esc(q.minLabel)+'</span><span>'+esc(q.maxLabel)+'</span></div>';
      html+=buttons({label:'Continue',action:'scale-continue'});
    } else if (q.type === 'text'){
      const data = state.fields[q.id] || state.answers[q.id] || {};
      (q.fields || []).forEach(field => {
        html+='<label class="form-field">'+esc(field.label)+'<input maxlength="500" type="text" data-field="'+esc(field.name)+'" value="'+esc(data[field.name] || '')+'" placeholder="'+esc(field.placeholder || '')+'"></label>';
      });
      html+=buttons({label:'Continue',action:'text-continue'});
    } else if(q.type === 'voice'){
      const answer = state.voiceText[q.id] != null ? state.voiceText[q.id] : ((state.answers[q.id] || {}).answer_final || '');
      const mode = state.voiceMode[q.id] || 'prompt';
      const savedAnswer = state.answers[q.id] && state.answers[q.id].answer_final;
      if (mode === 'prompt' && !savedAnswer) {
        html += '<p class="q-helper">Speak or type, whichever is easier. You can speak for up to 2 minutes in the real survey.</p>';
        html += '<div class="voice-start"><button type="button" data-action="voice-sample"><span aria-hidden="true">🎙</span>Try a sample voice answer</button><button type="button" data-action="voice-type"><span aria-hidden="true">✍️</span>Type instead</button></div>';
        html += '<p class="micro">Microphone and Sarvam transcription are not connected in this preview.</p>';
      } else {
        html += '<label class="form-field">Your answer<textarea id="voiceAnswer" rows="5" placeholder="Describe what happened in your own words.">'+esc(answer)+'</textarea></label>';
        html += '<div class="voice-start"><button type="button" data-action="voice-sample"><span aria-hidden="true">🎙</span>Insert sample transcript</button><button type="button" data-action="voice-type"><span aria-hidden="true">✍️</span>Edit by typing</button></div>';
        if(state.previewReadback && state.previewReadback.id===q.id){
          html+='<div class="readback" role="dialog" aria-modal="false" aria-labelledby="readbackTitle"><h3 id="readbackTitle">Here’s what you said</h3><p>'+esc(state.previewReadback.text)+'</p><span class="micro">Simulated read-back only. Production will use Sarvam to summarize without adding facts.</span>';
          html+=buttons({label:"Yes, that's right",action:'voice-yes'},{label:'Not quite',action:'voice-no'});
          html+='</div>';
        } else html+=buttons({label:'Confirm my answer',action:'voice-confirm'});
      }
      if (q.optional) html+='<button class="back-btn" type="button" data-action="voice-skip">Skip this optional question</button>';
    } else if(q.type==='finish'){
      html+='<div class="inline-note">Review demo only: finishing here will not save a response or delete any audio, because there is no backend in this preview.</div>';
      html+=buttons({label:'Finish demo',action:'finish'});
    } else if(q.terminal){
      html+='<div class="inline-note">End of this simulated branch. Nothing has been sent or saved.</div>';
      html+=buttons({label:'Restart the demo',action:'restart'});
    } else if(q.type==='message' || q.type==='welcome'){
      html+=buttons({label:(q.primary||{}).label||'Continue',action:'message-primary'},q.secondary?{label:q.secondary.label,action:'message-secondary'}:null);
    }
    if(state.error) html+='<div class="inline-note" role="alert">'+esc(state.error)+'</div>';
    html+='<div class="demo-status">🔒 Prototype mode · no real autosave, microphone, Google sign-in or AI requests</div></div>';
    host.innerHTML=html;
    if (focus) { const title=byId('demoQuestionTitle'); if (title) title.focus({preventScroll:true}); }
  }
  const sample = {
    S1bv: "I would want someone to help explain the waiting periods.",
    Q5: "I thought the quote was a little higher than I expected and I wasn't sure what it included.",
    H9v: "The waiting period and the room rent limit made me pause.",
    P12a: "I went ahead after I understood what was covered.",
    P12b: "I needed a clearer explanation of the limits and the total cost.",
    X13: "I'd make the exclusions easier to find and explain."
  };
  function getPick(q) { return state.picks[q.id] === undefined ? state.answers[q.id] : state.picks[q.id]; }
  function choiceContinue(){
    const q=currentQuestion();
    let v=getPick(q);
    if(q.type==='multi'){
      if(!Array.isArray(v) || !v.length){state.error='Please pick at least one option.';render(false);return;}
      if(v.length>q.max){state.error='Please pick no more than '+q.max+' options.';render(false);return;}
    } else {
      if(!v){state.error='Choose one option to continue.';render(false);return;}
      if(v==='other' && (q.options||[]).some(o=>o.value==='other'&&o.other)){
        const extra=state.other[q.id] || (state.answers[q.id] && state.answers[q.id].text)||'';
        if(!extra.trim()){state.error='Please enter your answer for “Something else”.';render(false);return;}
        v={value:'other',text:extra.trim().slice(0,500)};
      }
    }
    advance(v);
  }
  function action(name){
    const q=currentQuestion();
    if(!q || state.navLock) return;
    if(name==='back')return back();
    if(name==='restart')return resetDemo();
    if(name==='intro')return advance('yes');
    if(name==='mock-google'){
      state.demoSignedIn=true;state.demoEmail='demo@example.com';state.demoName='Demo respondent';state.error='';render(false);return;
    }
    if(name==='toggle-contact'){state.signinAlternative=!state.signinAlternative;state.error='';render(false);return;}
    if(name==='mock-contact'){
      const raw=(state.fields.signinContact||'').trim();const clean=raw.replace(/[\s-]+/g,'');
      if(!(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw)||/^\+?[0-9]{10,15}$/.test(clean))){
        state.error='Please enter a sample email or valid-looking mobile number. This preview does not verify real contacts.';render(false);return;
      }
      state.demoSignedIn=true;state.demoEmail=raw.replace(/^(.{2}).+(@.+)$/,'$1•••$2');state.demoName=(state.fields.signinName||'Demo').trim()||'Demo';state.error='';render(false);return;
    }
    if(name==='not-you'){state.demoSignedIn=false;state.demoEmail='demo@example.com';state.demoName='Demo respondent';state.error='';render(false);return;}
    if(name==='signin-yes'){if(!state.demoSignedIn){state.error='Choose a demo sign-in route first.';render(false);return;}return advance('yes');}
    if(name==='signin-no')return advance('no',{goto:'DECLINED'});
    if(name==='message-primary')return advance(q.primary.value,q.primary);
    if(name==='message-secondary')return advance(q.secondary.value,q.secondary);
    if(name==='choice-continue')return choiceContinue();
    if(name==='scale-continue'){const v=getPick(q);if(typeof v!=='number'){state.error='Select a number from the scale.';render(false);return;}return advance(v);}
    if(name==='text-continue'){
      const fields=state.fields[q.id] || {};const output={};
      for(const f of q.fields||[]){const s=(fields[f.name]||'').trim();if(!s){state.error='Please complete '+f.label.toLowerCase()+'.';render(false);return;}output[f.name]=s.slice(0,500);}
      return advance(output);
    }
    if(name==='voice-sample'){state.voiceMode[q.id]='text';state.voiceText[q.id]=sample[q.id]||'I was not sure what the quote meant.';state.previewReadback=null;state.error='';render(false);return;}
    if(name==='voice-type'){state.voiceMode[q.id]='text';state.error='';render(false);const el=byId('voiceAnswer');if(el)el.focus();return;}
    if(name==='voice-confirm'){
      const answer=(state.voiceText[q.id]||'').trim();
      if(!answer){state.error='Please type an answer, or insert a sample transcript.';render(false);return;}
      state.previewReadback={id:q.id,text:answer};state.error='';render(false);
      const heading=byId('readbackTitle');if(heading){heading.tabIndex=-1;heading.focus();}return;
    }
    if(name==='voice-no'){
      const versions=state.versions[q.id]||[];versions.push({version:versions.length+1,verdict:'not_quite',answer:state.previewReadback.text});
      state.versions[q.id]=versions;state.previewReadback=null;state.error='Edit your answer, then confirm it again.';render(false);
      const el=byId('voiceAnswer');if(el)el.focus();return;
    }
    if(name==='voice-yes'){
      const answer=(state.previewReadback||{}).text;
      if(!answer)return;
      const versions=state.versions[q.id]||[];versions.push({version:versions.length+1,verdict:'yes',answer,bullets:[answer],quote:'',unclear:'',fallback:true});
      state.versions[q.id]=versions;
      return advance({answer_final:answer,edited:versions.length>1,notes:[],interpretations:versions});
    }
    if(name==='voice-skip')return advance({skipped:true});
    if(name==='finish')return advance({skipped:true});
  }
  const host=byId('surveyStage');
  host.addEventListener('input',e=>{
    const q=currentQuestion();
    if(!q)return;
    if(e.target.id==='testContact')state.fields.signinContact=e.target.value;
    if(e.target.id==='testName')state.fields.signinName=e.target.value;
    if(e.target.id==='otherText')state.other[q.id]=e.target.value;
    if(e.target.id==='voiceAnswer'){state.voiceText[q.id]=e.target.value;state.previewReadback=null;}
    if(e.target.hasAttribute('data-field')){
      if(!state.fields[q.id])state.fields[q.id]={};
      state.fields[q.id][e.target.dataset.field]=e.target.value;
    }
  });
  host.addEventListener('click',e=>{
    const btn=e.target.closest('button');if(!btn)return;
    const q=currentQuestion();if(!q)return;
    if(btn.hasAttribute('data-action'))return action(btn.dataset.action);
    if(btn.hasAttribute('data-choice')){
      const value=btn.dataset.choice;
      state.error='';
      if(q.type==='multi'){
        const chosen=[...(getPick(q)||[])];
        const idx=chosen.indexOf(value);
        if(idx>=0)chosen.splice(idx,1);
        else if(chosen.length >= (q.max||999)){state.error='You can pick up to '+q.max+'. Untick one to choose another.';render(false);return;}
        else chosen.push(value);
        state.picks[q.id]=chosen;render(false);return;
      }
      state.picks[q.id]=value;render(false);
      const option=(q.options||[]).find(o=>o.value===value);
      if (option && option.other) {const el=byId('otherText');if(el)el.focus();return;}
      if(e.detail>0) {
        state.navLock=true;
        setTimeout(()=>{state.navLock=false;choiceContinue();},260);
      }
      return;
    }
    if(btn.hasAttribute('data-scale')){
      state.picks[q.id]=Number(btn.dataset.scale);state.error='';render(false);return;
    }
  });
  host.addEventListener('keydown',e=>{
    const button=e.target.closest('button[data-choice]');
    if(!button || !['ArrowDown','ArrowRight','ArrowUp','ArrowLeft'].includes(e.key))return;
    const q=currentQuestion();if(!q||q.type!=='single')return;
    e.preventDefault();
    const opts=[...host.querySelectorAll('button[data-choice]')];
    let i=opts.indexOf(button);i=(i+(e.key==='ArrowDown'||e.key==='ArrowRight'?1:-1)+opts.length)%opts.length;
    state.picks[q.id]=opts[i].dataset.choice;render(false);
    const next=[...host.querySelectorAll('button[data-choice]')][i];if(next)next.focus();
  });
  function showTab(tab){
    if(!tabs.includes(tab))tab='plan';
    tabs.forEach(id=>{
      byId(id).classList.toggle('hidden',id!==tab);
      const link=document.querySelector('[data-tab="'+id+'"]');
      if(link){link.classList.toggle('active',id===tab);if(id===tab)link.setAttribute('aria-current','page');else link.removeAttribute('aria-current');}
    });
  }
  window.addEventListener('hashchange',()=>showTab(location.hash.slice(1)));
  document.querySelectorAll('a[data-tab]').forEach(a=>a.addEventListener('click',()=>showTab(a.dataset.tab)));
  document.querySelectorAll('a[href="#survey"],a[href="#flow"]').forEach(a=>a.addEventListener('click',()=>{if(a.hash)showTab(a.hash.slice(1));}));
  byId('restartDemo').addEventListener('click',resetDemo);
  function reviewText(approve){
    const lines=[
      'QUOTE JOURNEY · FLOW '+(approve?'APPROVAL':'CHANGE REQUEST'),
      'Source: health_insurance_survey review template',
      'Review status: '+(approve?'Approved for build, subject to decisions below':'Changes requested before build'),
      'Guide (X14): '+byId('guideDecision').value,
      'Callback (CB): '+byId('callbackDecision').value,
      'W1 timing: '+byId('w1Decision').value,
      'Referral / thank-you: '+byId('thanksDecision').value,
      'Additional changes: '+(byId('notes').value.trim()||'None'),
      'Note: Approval of the mock does not authorize live collection until security, privacy, delivery and phone tests pass.'
    ];return lines.join('\n');
  }
  async function copyReview(approve){
    const value=reviewText(approve);
    try {
      if(navigator.clipboard&&navigator.clipboard.writeText) await navigator.clipboard.writeText(value);
      else {
        const t=document.createElement('textarea');t.value=value;document.body.appendChild(t);t.select();
        if(!document.execCommand('copy'))throw new Error('Copy failed');
        t.remove();
      }
      byId('copyStatus').textContent='Review copied. Paste it into your ChatGPT conversation for the next phase.';
    }catch(e){byId('copyStatus').textContent='Copy blocked by your browser. Select and copy these values manually: '+value;}
  }
  byId('approveBtn').addEventListener('click',()=>copyReview(true));
  byId('changesBtn').addEventListener('click',()=>copyReview(false));
  showTab(location.hash.slice(1));
  fetch('./questions.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error('questions.json not found');return r.json();}).then(data=>{
    state.questions=data.questions;state.steps=data.steps;render(false);
  }).catch(err=>{host.innerHTML='<div class="survey-inner"><h2>Could not load the survey</h2><p>'+esc(err.message)+'</p><p>Refresh the page or check that questions.json was published with the review site.</p></div>';});
})();
