/* Quote Journey review-only prototype: no network writes, external APIs, credentials or respondent persistence. */
(() => {
  'use strict';
  const tabs = ['plan', 'survey', 'flow'];
  const standalone = Boolean(window.QUOTE_JOURNEY_STANDALONE) || /\/survey(?:\.html)?\/?$/.test(location.pathname);
  let recordingTick=null;
  let recordingStarted=0;
  const stopRecordingTick=()=>{if(recordingTick!==null){clearInterval(recordingTick);recordingTick=null;}};
  let voiceAutoTimer = null;
  const stopVoiceAuto = () => { if(voiceAutoTimer !== null){clearTimeout(voiceAutoTimer);voiceAutoTimer=null;} };
  const state = { questions: [], steps: [], current: standalone?'W1':'INTRO', history: [], answers: standalone?{INTRO:'yes'}:{}, picks: {}, fields: {}, other: {}, voiceText: {}, voiceMode: {}, versions: {}, voiceOrigin: {}, previewReadback: null, demoSignedIn: false, demoEmail: 'demo@example.com', demoName: 'Demo respondent', signinAlternative: false, error: '', navLock: false };
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
    stopVoiceAuto();stopRecordingTick();
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
    if (state.navLock || !state.history.length){if(standalone)location.href='./index.html';return;}
    stopVoiceAuto();stopRecordingTick();
    state.current = state.history.pop();
    state.previewReadback = null;
    state.error = '';
    render(true);
  }
  function resetDemo() {
    stopVoiceAuto();stopRecordingTick();
    Object.assign(state, {current:standalone?'W1':'INTRO',history:[],answers:standalone?{INTRO:'yes'}:{},picks:{},fields:{},other:{},voiceText:{},voiceMode:{},versions:{},voiceOrigin:{},previewReadback:null,demoSignedIn:false,demoEmail:'demo@example.com',demoName:'Demo respondent',signinAlternative:false,error:'',navLock:false});
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
    html += '<div class="survey-nav"><button type="button" class="back-btn" data-action="back" '+(q.terminal?'disabled':'')+'>← Back</button><span class="question-step">'+(q.step == null?'Final screen':esc(state.steps[q.step]+' · '+(q.step+1)+'/6'))+'</span></div>';
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
      const optionHtml = (o,i) => {
        const on = q.type === 'multi' ? selected.includes(o.value) : selected === o.value;
        const baseClass = q.layout === 'tiles' ? 'q-option q-tile' : 'q-option';
        return '<button type="button" class="'+baseClass+' '+(on?'selected':'')+'" role="'+(q.type==='single'?'radio':'checkbox')+'" aria-checked="'+on+'" tabindex="'+(q.type==='single'&&i>0&&!on?'-1':'0')+'" data-choice="'+esc(o.value)+'">'+
          '<span class="emoji" aria-hidden="true">'+esc(o.emoji||'○')+'</span><span>'+esc(o.label)+'</span><span class="selection-mark" aria-hidden="true">'+(on?'✓':'')+'</span></button>';
      };
      if(q.layout === 'tiles'){
        const groups=[...new Set((q.options||[]).map(o=>o.group||'Other'))];
        groups.forEach(group=>{
          html+='<section class="tile-section"><h3 class="tile-heading">'+esc(group)+'</h3><div class="tile-grid" role="group" aria-label="'+esc(group)+'">';
          (q.options||[]).filter(o=>(o.group||'Other')===group).forEach(o=>{
            html+=optionHtml(o,q.options.indexOf(o));
          });
          html+='</div></section>';
        });
      }else{
        html+='<div class="q-options" role="'+(q.type==='single'?'radiogroup':'group')+'" aria-label="'+esc(q.title)+'">';
        (q.options||[]).forEach((o,i)=>{html+=optionHtml(o,i);});
        html+='</div>';
      }
      if (q.type === 'single' && selected === 'other' && (q.options || []).some(o => o.value==='other' && o.other)){
        html += '<label class="form-field">Tell us more<input type="text" maxlength="500" id="otherText" value="'+esc(state.other[q.id] || (state.answers[q.id] && state.answers[q.id].text) || '')+'" placeholder="Your answer"></label>';
      }
      html += buttons({label:'Continue',action:'choice-continue'});
    } else if (q.type === 'scale') {
      const saved = state.picks[q.id] !== undefined ? state.picks[q.id] : state.answers[q.id];
      html+='<div class="scale-options" role="radiogroup" aria-label="'+esc(q.title)+'">';
      for(let i=q.min;i<=q.max;i++) html+='<button type="button" class="q-option '+(saved===i?'selected':'')+'" role="radio" aria-checked="'+(saved===i)+'" data-scale="'+i+'">'+i+'</button>';
      html+='</div><div class="scale-labels"><span>'+esc(q.minLabel)+'</span><span>'+esc(q.maxLabel)+'</span></div>';
      if(q.scaleLabels && saved)html+='<p class="scale-feedback">You chose: <strong>'+esc(q.scaleLabels[saved-q.min])+'</strong></p>';
      html+=buttons({label:'Continue',action:'scale-continue'});
    } else if (q.type === 'text'){
      const data = state.fields[q.id] || state.answers[q.id] || {};
      (q.fields || []).forEach(field => {
        const type = ['date','time','email'].includes(field.type)?field.type:'text';
        const fallback = field.name === 'timezone' ? (Intl.DateTimeFormat().resolvedOptions().timeZone||'Asia/Kolkata') : (
          field.prefill ? ((state.fields.signinContact||'').includes('@')?state.fields.signinContact:(state.demoSignedIn && !state.demoEmail.includes('•')?state.demoEmail:'')) : ''
        );
        html+='<label class="form-field">'+esc(field.label)+'<input maxlength="500" type="'+type+'" data-field="'+esc(field.name)+'" value="'+esc(data[field.name] || fallback)+'" placeholder="'+esc(field.placeholder || '')+'"></label>';
      });
      if(q.reminderOnly)html+='<p class="inline-note">Only one email reminder is requested. This review site does not actually schedule or send emails.</p>';
      html+=buttons({label:q.reminderOnly?'Request one reminder':'Continue',action:'text-continue'});
    } else if(q.type === 'voice'){
      const answer = state.voiceText[q.id] != null ? state.voiceText[q.id] : ((state.answers[q.id] || {}).answer_final || '');
      const mode = state.voiceMode[q.id] || (answer?'text':'prompt');
      if(mode === 'ack'){
        const info=state.voiceOrigin[q.id]==='typed'
          ? 'You shared your experience in your own words.'
          : (demoInterpretations[q.id]||'You shared what stood out to you about this quote.');
        html+='<section class="readback" role="status" aria-live="polite"><img src="./assets/complete.svg" alt="" class="voice-status-icon"><h3>I understood</h3><p>'+esc(info)+'</p><span class="micro">Simulated interpretation, not a confirmed summary. Moving to the next question automatically.</span></section>';
        html+=buttons({label:'Continue now',action:'voice-next'},{label:'Replace answer',action:'voice-edit'});
      } else if(mode === 'record'){
        const seconds=Math.min(120,Math.floor((Date.now()-recordingStarted)/1000));
        html+='<section class="voice-panel"><div class="record-heading"><span class="record-dot" aria-hidden="true"></span>Simulated recording</div><img class="record-wave" src="./assets/recording-wave.svg" alt="Animated recording level bars"><p class="record-time"><span id="recordClock">'+Math.floor(seconds/60)+':'+String(seconds%60).padStart(2,'0')+'</span> / 2:00</p><p class="record-prompt" id="recordPrompt">Take your time.</p>';
        html+='<button type="button" class="button button-primary" data-action="voice-stop"><img src="./assets/stop.svg" alt="" class="invert-icon"> Stop preview</button>';
        html+='<p class="micro">The microphone is off. This only previews how recording will feel.</p></section>';
      } else if(mode === 'prompt'){
        html+='<section class="voice-panel"><img class="voice-hero-icon" src="./assets/microphone.svg" alt=""><h3>Your first reaction, in your words</h3><p class="q-helper">Speak or type, whichever is easier. Up to two minutes when recording is enabled.</p><div class="voice-start"><button type="button" data-action="voice-sample"><img src="./assets/microphone.svg" alt="">Preview recording</button><button type="button" data-action="voice-type"><img src="./assets/type.svg" alt="">Type instead</button></div><p class="micro">Preview only: no microphone or Sarvam requests.</p></section>';
      } else {
        html+='<label class="form-field">Write your answer<textarea id="voiceAnswer" rows="5" placeholder="Describe what happened in your own words.">'+esc(answer)+'</textarea></label>';
        html+='<div class="voice-start"><button type="button" data-action="voice-sample"><img src="./assets/microphone.svg" alt="">Preview recording</button><button type="button" data-action="voice-type"><img src="./assets/type.svg" alt="">Keep typing</button></div>';
        html+=buttons({label:'Continue with my answer',action:'voice-continue'});
      }
      if(q.optional && mode!=='ack' && mode!=='record')html+='<button class="quiet-skip" type="button" data-action="voice-skip">Skip this optional question</button>';
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
    if (focus && standalone && typeof window.scrollTo === 'function') window.scrollTo({top:0,left:0,behavior:'auto'});
  }
  const sample = {
    S1bv: "I would want someone to help explain the waiting periods.",
    Q5: "I thought the quote was a little higher than I expected and I wasn't sure what it included.",
    H9v: "The waiting period and the room rent limit made me pause.",
    P12a: "I went ahead after I understood what was covered.",
    P12b: "I needed a clearer explanation of the limits and the total cost.",
    X13: "I wanted short explanations of insurance words and a clearer list of exclusions."
  };
  const demoInterpretations = {
    S1bv: 'You would find it helpful if someone explained waiting periods.',
    Q5: 'The price was higher than you expected, and the cover was not clear.',
    H9v: 'Waiting periods and room rent limits gave you doubts.',
    P12a: 'You decided to buy after the cover became clearer.',
    P12b: 'You wanted clearer limits and total costs before deciding.',
    X13: 'You wanted simpler terms and a clearer explanation of exclusions.'
  };
  function showVoiceAcknowledgement(id){
    stopVoiceAuto();
    if(state.current!==id)return;
    state.voiceMode[id]='ack';
    state.error='';
    render(false);
    voiceAutoTimer=setTimeout(()=>{
      voiceAutoTimer=null;
      if(state.current===id && state.voiceMode[id]==='ack')action('voice-next');
    },2300);
  }
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
      const fields=state.fields[q.id] || {};
      const output={};
      for(const f of q.fields||[]){
        const fallback=f.name==='timezone'?(Intl.DateTimeFormat().resolvedOptions().timeZone||'Asia/Kolkata'):(f.prefill ? ((state.fields.signinContact||'').includes('@')?state.fields.signinContact:(state.demoSignedIn&&!state.demoEmail.includes('•')?state.demoEmail:'')):'');
        const val=(fields[f.name]||fallback||'').trim();
        if(!val){state.error='Please complete '+f.label.toLowerCase()+'.';render(false);return;}
        if(f.type==='email'&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)){state.error='Please enter an email address.';render(false);return;}
        output[f.name]=val.slice(0,500);
      }
      return advance(output);
    }
    if(name==='voice-sample'){
      stopRecordingTick();
      state.voiceOrigin[q.id]='spoken';
      state.voiceMode[q.id]='record';
      recordingStarted=Date.now();
      state.error='';
      render(false);
      recordingTick=setInterval(()=>{
        if(state.current!==q.id||state.voiceMode[q.id]!=='record'){stopRecordingTick();return;}
        const elapsed=Math.floor((Date.now()-recordingStarted)/1000);
        const clock=byId('recordClock');
        if(clock)clock.textContent=Math.floor(elapsed/60)+':'+String(elapsed%60).padStart(2,'0');
        const prompt=byId('recordPrompt');
        if(prompt)prompt.textContent=elapsed>=36?'That is enough whenever you are ready.':elapsed>=13?'Anything else that stood out?':'Take your time.';
        if(elapsed>=120){stopRecordingTick();action('voice-stop');}
      },400);
      return;
    }
    if(name==='voice-stop'){
      stopRecordingTick();
      state.voiceText[q.id]=sample[q.id]||'I was not sure what the quote meant.';
      return showVoiceAcknowledgement(q.id);
    }
    if(name==='voice-type'||name==='voice-edit'){
      stopVoiceAuto();stopRecordingTick();
      if(name==='voice-edit' && state.voiceOrigin[q.id]==='spoken')state.voiceText[q.id]='';
      state.voiceOrigin[q.id]='typed';
      state.voiceMode[q.id]='text';state.error='';
      render(false);const el=byId('voiceAnswer');if(el)el.focus();
      return;
    }
    if(name==='voice-continue'){
      const answer=(state.voiceText[q.id]||'').trim();
      if(!answer){state.error='Please write an answer before continuing.';render(false);return;}
      return showVoiceAcknowledgement(q.id);
    }
    if(name==='voice-next'){
      stopVoiceAuto();
      const answer=(state.voiceText[q.id]||'').trim();
      if(!answer)return;
      const info=state.voiceOrigin[q.id]==='typed' ? 'Your written answer was captured. The live AI will summarize it without adding facts.' : (demoInterpretations[q.id]||'You shared what stood out to you about this quote.');
      state.versions[q.id]=[{version:1,bullets:[info],quote:'',unclear:'',fallback:false,verdict:null,answer}];
      return advance({answer_final:answer,edited:false,notes:[],interpretations:state.versions[q.id]});
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
    if(e.target.id==='voiceAnswer'){state.voiceText[q.id]=e.target.value;}
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
  showTab(standalone?'survey':location.hash.slice(1));
  fetch('./questions.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error('questions.json not found');return r.json();}).then(data=>{
    state.questions=data.questions;state.steps=data.steps;render(false);
  }).catch(err=>{host.innerHTML='<div class="survey-inner"><h2>Could not load the survey</h2><p>'+esc(err.message)+'</p><p>Refresh the page or check that questions.json was published with the review site.</p></div>';});
})();
