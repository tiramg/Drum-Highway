'use strict';
// Song selection, notation and transport share one recording-time event stream.
const Live={generation:0,song:null,track:null,map:null,chart:null,view:'highway',clock:null,filter:'discover',searchTimer:null,loopA:null,loopB:null,clickBeat:-1};
function stored(key,fallback){try{return JSON.parse(localStorage.getItem('dh-live-'+key))??fallback}catch{return fallback}}
function persist(key,value){try{localStorage.setItem('dh-live-'+key,JSON.stringify(value))}catch{}}
let favourites=stored('favourites',[]),history=stored('history',[]),runs=stored('runs',[]);
async function api(path,signal){const r=await fetch(path,{signal});const data=await r.json();if(!r.ok)throw Error(data.error||'Song data could not load.');return data}
const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n};
function button(text,fn,cls=''){const b=el('button',text,cls);b.type='button';b.onclick=fn;return b}
const liveStyle=el('style');liveStyle.textContent=`
 #songLibrary{width:min(780px,94vw);max-height:86dvh}#songLibrary h2{margin:0}.library-tabs{margin:16px 0;display:flex;gap:8px}.library-tabs .selected{border-color:#7cddff;background:#12384a}.live-search{width:100%;margin:12px 0;padding:12px}.live-result{display:flex;gap:12px;align-items:center;justify-content:space-between}.live-result small{display:block;color:#aac4d5;margin-top:6px}.live-result .bar{flex-wrap:nowrap}.live-empty{padding:24px 0;color:#a7bfd0}.live-meta{font-size:11px;color:#a7c9dc;margin:6px 0}.live-controls{display:flex;gap:6px;flex-wrap:wrap;margin-top:10px}.live-controls button,.live-controls select{font-size:11px;max-width:100%}.live-controls input[type=range]{padding:0;width:100%}.live-loading{opacity:.65}#notation{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:1}.scene.sheet-view #highway,.scene.sheet-view #pads{visibility:hidden}.scene.sheet-view{background:#03101a}.scene.sheet-view .stage-backdrop{opacity:.2}.scene.sheet-view .scene-shade{background:#03101acc}.song-info h2{max-width:220px}#playingSong{font-size:13px}#liveResults{max-height:52dvh;overflow:auto}#songPlayback{left:15px;right:auto;top:250px;width:320px;max-width:calc(100vw - 30px);max-height:calc(100dvh - 265px);overflow-y:auto}#youtubeHost iframe{display:block;width:100%;min-height:200px}.practice-status{color:#8bdcff}.live-select{width:100%}.live-run{padding:10px;border-bottom:1px solid #234153}.live-help{font-size:11px;color:#a9c2d0;line-height:1.5}.live-transport{display:flex;gap:6px;align-items:center;width:100%}#liveSeek{flex:1}.live-status{min-height:1.4em}.song-controls-tab{position:fixed;left:15px;top:210px;z-index:9;font-size:12px;padding:8px 12px;background:#071421f5}.song-controls-tab[hidden]{display:none}#songPlayback.collapsed{transform:translateX(calc(-100% - 30px));visibility:hidden;pointer-events:none}
`;document.head.append(liveStyle);
const library=$('songLibrary');library.replaceChildren();
const libraryHeader=el('div',undefined,'bar');libraryHeader.style.justifyContent='space-between';libraryHeader.append(el('h2','Find your next song'),button('✕',()=>library.close()));
const searchBox=el('input',undefined,'live-search');searchBox.id='chartSearch';searchBox.placeholder='Search any song or artist…';searchBox.setAttribute('aria-label','Search songs and artists');
const tabs=el('div',undefined,'library-tabs');for(const [key,label] of [['discover','Discover'],['favourites','Favorites'],['history','Recent plays'],['results','My results']]){const b=button(label,()=>{Live.filter=key;renderSongs()});b.dataset.tab=key;tabs.append(b)}
const status=el('p','Search the drum library, then choose a song.','live-status');status.id='catalogStatus';const results=el('div');results.id='liveResults';results.setAttribute('aria-live','polite');
const searchRow=el('div',undefined,'song-search-row');const clearSearch=button('CLEAR',()=>{clearTimeout(Live.searchTimer);searchAbort?.abort();searchBox.value='';searchBox.focus();renderSongs()});clearSearch.id='clearSongSearch';clearSearch.setAttribute('aria-label','Clear song search');searchRow.append(searchBox,clearSearch);
library.append(libraryHeader,searchRow,tabs,status,results);
const searchRowStyle=el('style');searchRowStyle.textContent='.song-search-row{display:flex;align-items:center;gap:8px;margin:12px 0}.song-search-row .live-search{flex:1;min-width:0;width:auto;margin:0}.song-search-row button{flex:none;min-height:44px;font-size:12px;font-weight:700}';document.head.append(searchRowStyle);
let searchAbort=null;
const songAvailability=new Map();
async function checkLibrarySongs(rows,signal){
 let next=0;const normalize=t=>t.toLowerCase().replace(/[^a-z0-9]/g,'');
 function alternatives(){for(const row of rows){if(row.state!=='unavailable'||row.alternative)continue;const other=rows.find(candidate=>candidate.state==='ready'&&candidate.song.id!==row.song.id&&candidate.song.artist===row.song.artist&&normalize(candidate.song.title).startsWith(normalize(row.song.title)));if(other){row.alternative=button('Play alternate version',()=>openLiveSong(other.song.id));row.alternative.title=other.song.title;row.text.append(el('small','Available: '+other.song.title));row.actions.append(row.alternative)}}}
 async function worker(){while(next<rows.length&&!signal.aborted){const row=rows[next++];try{let entry=songAvailability.get(row.song.id);if(!entry||entry.until<Date.now()){const info=await api('/api/songs/'+row.song.id,signal);entry={ready:!!info.tracks?.length&&!!info.versions?.length,until:Date.now()+300000};songAvailability.set(row.song.id,entry)}if(signal.aborted)return;row.state=entry.ready?'ready':'unavailable';row.play.disabled=!entry.ready;row.play.textContent=entry.ready?'Play':'Unavailable';row.text.append(el('small',entry.ready?'Ready to play':'No compatible chart and recording available.'));alternatives()}catch(e){if(signal.aborted)return;row.play.textContent='Retry check';row.play.disabled=false;row.play.onclick=()=>{row.play.disabled=true;row.play.textContent='Checking…';checkLibrarySongs([row],signal)};row.text.append(el('small','Could not check availability. Try again.'))}}}
 await Promise.all([worker(),worker(),worker()]);
}

renderSongs=async function(){
 for(const b of tabs.children)b.classList.toggle('selected',b.dataset.tab===Live.filter);
 searchAbort?.abort();searchAbort=new AbortController();const signal=searchAbort.signal;
 if(Live.filter==='results'){results.replaceChildren();status.textContent=runs.length+' saved sessions';for(const r of [...runs].reverse().slice(0,40)){const row=el('div',undefined,'live-run');row.append(el('strong',r.title),el('p',r.hits+' hits · '+r.accuracy+'% accuracy · best streak '+r.streak+' · '+new Date(r.date).toLocaleDateString()));results.append(row)}if(!runs.length)results.append(el('p','Your completed sessions will appear here.','live-empty'));return}
 status.textContent=results.children.length?'Searching…':'Loading songs…';
 try{
  const query=searchBox.value.trim();let songs=Live.filter==='favourites'?favourites:Live.filter==='history'?history:await api('/api/search?q='+encodeURIComponent(query),signal);
  if(signal.aborted)return;if(Live.filter!=='discover'&&query)songs=songs.filter(s=>(s.title+' '+s.artist).toLowerCase().includes(query.toLowerCase()));
  results.replaceChildren();status.textContent=songs.length+' songs · checking playable versions…';const availabilityRows=[];
  if(!songs.length)results.append(el('p',Live.filter==='favourites'?'Star songs to keep them here.':'No matching songs. Try a shorter title or artist name.','live-empty'));
  for(const s of songs){const card=el('div',undefined,'song-card live-result'),text=el('div');text.append(el('strong',s.title),el('small',s.artist));const actions=el('div',undefined,'bar');const star=button(favourites.some(f=>f.id===s.id)?'★':'☆',()=>{if(favourites.some(f=>f.id===s.id))favourites=favourites.filter(f=>f.id!==s.id);else favourites.push({id:s.id,title:s.title,artist:s.artist});persist('favourites',favourites);star.textContent=favourites.some(f=>f.id===s.id)?'★':'☆';if(Live.filter==='favourites')renderSongs()});star.setAttribute('aria-label','Toggle favorite '+s.title);const play=button('Checking…',()=>openLiveSong(s.id),'primary');play.disabled=true;actions.append(star,play);card.append(text,actions);results.append(card);availabilityRows.push({song:s,play,text,actions})}
  void checkLibrarySongs(availabilityRows,signal).then(()=>{if(!signal.aborted)status.textContent=songs.length+' songs · availability checked; choose a ready version.'});
 }catch(e){if(!signal.aborted)status.textContent=e.message}
};
searchBox.oninput=()=>{searchAbort?.abort();clearTimeout(Live.searchTimer);Live.searchTimer=setTimeout(renderSongs,500)};
$('libraryToggle').onclick=()=>{library.showModal();renderSongs();searchBox.focus()};
// Add controls without changing the approved concert scene.
const songPanel=$('songPlayback');
const sessionMenu=el('dialog');sessionMenu.id='sessionMenu';sessionMenu.setAttribute('aria-label','Main menu');
const menuHeader=el('div',undefined,'bar');menuHeader.append(el('h2','Main menu'),button('Return to play',()=>setSongPanel(false)));
const menuSongs=button('Choose a song',()=>{setSongPanel(false);library.showModal();renderSongs()});
const menuGroove=button('Practice groove',()=>{setSongPanel(false);returnToGroove()});
sessionMenu.append(menuHeader,menuSongs,menuGroove,songPanel);document.body.append(sessionMenu);
const mainMenu=button('Main menu',()=>{if(ytReady&&ytPlayer)ytPlayer.pauseVideo();running=false;$('play').textContent='▶ Play';setSongPanel(true)});mainMenu.id='mainMenu';document.querySelector('.session-buttons').append(mainMenu);
function setSongPanel(open){Live.panelOpen=false;songPanel.inert=true;if(sessionMenu.open)sessionMenu.close();}
sessionMenu.addEventListener('cancel',()=>{Live.panelOpen=false;songPanel.inert=true});
setSongPanel(false);
const controls=el('div',undefined,'live-controls'),trackSelect=el('select'),recordingSelect=el('select'),sectionSelect=el('select');
trackSelect.className=recordingSelect.className=sectionSelect.className='live-select';trackSelect.setAttribute('aria-label','Drum track');recordingSelect.setAttribute('aria-label','Recording');sectionSelect.setAttribute('aria-label','Jump to song section');
const viewButton=button('♪ Notation',()=>{Live.view=Live.view==='highway'?'notation':'highway';viewButton.textContent=Live.view==='highway'?'♪ Notation':'▥ Highway';document.querySelector('.scene').classList.toggle('sheet-view',Live.view==='notation')});
const loopLabel=el('span','Loop: off','live-meta');const setA=button('Set A',()=>{Live.loopA=Math.max(0,mediaTime());Live.loopB=null;loopLabel.textContent='A '+timeText(Live.loopA)+' · set B'}),setB=button('Set B',()=>{const t=mediaTime();if(Live.loopA===null||t<=Live.loopA+.5){loopLabel.textContent='Set A first, then B at least ½ second later.';return}Live.loopB=t;loopLabel.textContent=timeText(Live.loopA)+' → '+timeText(t)}),clearLoop=button('Clear loop',()=>{Live.loopA=Live.loopB=null;loopLabel.textContent='Loop: off'});
const clickToggle=el('input');clickToggle.type='checkbox';const clickLabel=el('label');clickLabel.append(clickToggle,document.createTextNode(' Click'));
const muteToggle=button('Mute backing',()=>{if(!ytReady)return;const muted=ytPlayer.isMuted();muted?ytPlayer.unMute():ytPlayer.mute();muteToggle.textContent=muted?'Mute backing':'Unmute backing'});
const seek=el('input');seek.type='range';seek.min=0;seek.max=100;seek.step=.1;seek.value=0;seek.id='liveSeek';seek.setAttribute('aria-label','Song position');const timeLabel=el('small','0:00 / 0:00');const transport=el('div',undefined,'live-transport');transport.append(seek,timeLabel);
const versionStatus=el('p','','live-help');versionStatus.id='liveVersionStatus';
controls.append(trackSelect,recordingSelect,sectionSelect,viewButton,muteToggle,clickLabel,transport,setA,setB,clearLoop,loopLabel,versionStatus);$('songPlayback').append(controls);
const notation=document.createElement('canvas');notation.id='notation';notation.setAttribute('aria-label','Drum notation synchronized to the selected recording');document.querySelector('.scene').append(notation);
const originalReturn=returnToGroove;
returnToGroove=function(){if(Live.song)saveRun();Live.generation++;Live.song=Live.chart=Live.clock=null;Live.loopA=Live.loopB=null;originalReturn();controls.hidden=true;videoDock.hidden=true;setSongPanel(false);document.querySelector('.song-info h2').textContent='Garage session';document.querySelector('.song-info small').textContent='16 bars · original drum groove · 100 BPM';refreshPracticeControls();};
controls.hidden=true;
async function openLiveSong(id){
 if(Live.song)saveRun();returnToGroove();Live.session=crypto.randomUUID();const generation=++Live.generation;status.textContent='Loading recordings and drum tracks…';
 try{
  const info=await api('/api/songs/'+id);if(generation!==Live.generation)return;
  if(!info.tracks.length||!info.versions.length)throw Error(info.unavailableReason==='A notation voice exceeds its measure.'?'This source chart has an overfilled measure and cannot be synchronized reliably. Try another version of this song.':info.unavailableReason||'This song has no drum track with an available recording map.');
  Live.song=info;Live.track=info.tracks.find(t=>t.preferred)?.index??info.tracks[0].index;
  history=[{id:info.id,title:info.title,artist:info.artist},...history.filter(s=>s.id!==info.id)].slice(0,50);persist('history',history);
  trackSelect.replaceChildren();for(const t of info.tracks)trackSelect.add(new Option(t.name,String(t.index)));trackSelect.value=String(Live.track);
  selectedSong={id:String(id),title:info.artist+' — '+info.title,live:true,chartKey:'live-'+id};currentSongVersion='original';
  $('playingSong').textContent=selectedSong.title;document.querySelector('.song-info h2').textContent=info.title;document.querySelector('.song-info small').textContent=info.artist;
  $('songPlayback').hidden=false;setSongPanel(false);$('play').textContent='Ⅱ Pause';$('play').disabled=true;document.body.classList.add('song-mode','charted-song');controls.hidden=false;$('songAlignment').hidden=true;$('localPlayback').hidden=true;
  library.close();await setRecordings(generation);
 }catch(e){if(generation===Live.generation){status.textContent=e.message;$('feedback').textContent=e.message}}
}
function records(){const info=Live.song;return [...info.versions.map((m,i)=>({...m,key:'original',title:(i===0?'Full recording':'Alternate full recording '+i)})),...info.backings.filter(m=>m.excludedTracks.includes(Live.track)).map((m,i)=>({...m,key:'drumless',title:'Drumless backing '+(i+1)}))]}
async function setRecordings(generation=Live.generation){
 const versions=records();recordingSelect.replaceChildren();for(const v of versions)recordingSelect.add(new Option(v.title+' · '+v.videoId,v.id));
 $('useOriginal').disabled=!versions.some(v=>v.key==='original');$('useDrumless').disabled=!versions.some(v=>v.key==='drumless');refreshPracticeControls();
 versionStatus.textContent=versions.some(v=>v.key==='drumless')?'Each recording loads its own matching timing map.':'No mapped drumless recording is available for this drum track. Full recording is available.';
 if(versions.length)await playMap(versions[0].id,generation);
}
trackSelect.onchange=()=>{Live.track=Number(trackSelect.value);Live.loopA=Live.loopB=null;setRecordings()};recordingSelect.onchange=()=>playMap(recordingSelect.value);
async function playMap(mapId,generation=Live.generation){
 const info=Live.song;if(!info)return;cancelCountIn();Live.readyToStart=false;if(ytReady)ytPlayer.pauseVideo();const selection=++selectionGeneration;running=false;position=0;notes=[];ytReady=false;Live.clock=null;Live.chart=null;songChart=null;$('play').disabled=$('reset').disabled=true;$('songChartStatus').textContent='Loading exact recording timeline…';
 try{
  const data=await api('/api/charts/'+info.id+'/'+Live.track+'/'+mapId);if(generation!==Live.generation||selection!==selectionGeneration)return;
  const v=records().find(v=>v.id===mapId);if(!v||data.binding.videoId!==v.videoId)throw Error('Recording identity changed. Reopen the song.');
  Live.chart=data;Live.map=v;Live.clock=null;Live.clickBeat=-1;Live.loopA=Live.loopB=null;loopLabel.textContent='Loop: off';songChart={...data,alignment:{offset:0,stretch:1}};duration=data.duration;chart();position=-NOTE_APPROACH_SECONDS;lastSongPosition=null;hits=misses=streak=bestStreak=score=perfectHits=goodHits=0;
  recordingSelect.value=mapId;sectionSelect.replaceChildren(new Option('Jump to a section…',''));for(const s of data.sections)sectionSelect.add(new Option(timeText(s.time)+' · '+s.title,String(s.time)));
  $('songChartStatus').textContent=data.notes.length.toLocaleString()+' notes · '+data.bars.length+' mapped measures · '+(data.bpm||'—')+' BPM';
  $('reset').disabled=false;$('loop').disabled=true;$('sound').disabled=true;$('useOriginal').textContent='With drums';
  $('useOriginal').classList.toggle('selected',v.key==='original');$('useDrumless').classList.toggle('selected',v.key==='drumless');
  await createPlayer(v.videoId,generation,selection);
 }catch(e){if(generation===Live.generation&&selection===selectionGeneration){$('songChartStatus').textContent='Cannot load this chart: '+e.message;$('feedback').textContent='Cannot load this song: '+e.message}}
}
const oldLoadVersion=loadSongVersion;
loadSongVersion=function(version){if(!selectedSong?.live)return oldLoadVersion(version);const map=records().find(v=>v.key===version);if(map)return playMap(map.id)};
$('useOriginal').onclick=()=>loadSongVersion('original');$('useDrumless').onclick=()=>loadSongVersion('drumless');
async function createPlayer(videoId,generation,selection){
 videoDock.hidden=true;
 Live.providerState=null;const pg=++playerGeneration;if(ytPlayer){ytPlayer.destroy();ytPlayer=null}$('youtubeHost').replaceChildren();
 const host=el('div');host.id='youtubePlayer';$('youtubeHost').append(host);$('watchYoutube').href='https://www.youtube.com/watch?v='+videoId;
 await youtubeAPI();if(generation!==Live.generation||selection!==selectionGeneration)return;
 ytPlayer=new YT.Player('youtubePlayer',{width:'100%',height:'200',videoId,playerVars:{autoplay:0,playsinline:1,origin:location.origin},events:{
  onReady:e=>{if(pg!==playerGeneration)return;ytReady=true;$('play').disabled=false;Live.clock=null;e.target.setPlaybackRate(1);$('speed').value=100;$('speedLabel').textContent='100%';refreshPracticeControls();prepareCountIn();warmRecording();},
  onStateChange:e=>{if(pg!==playerGeneration)return;videoDock.hidden=true;if(Live.warmup){if(e.data===1)finishWarmup();return}if(e.data===1&&(Live.countIn||Live.readyToStart)){ytPlayer.pauseVideo();running=false;Live.clock=null;return}Live.providerState=e.data;running=e.data===1;if(e.data===1){Live.startPending=false;Live.readyToStart=false;if(!Live.clock||Live.clock.state!==1){const t=mediaTime();Live.clock={raw:t,at:performance.now(),time:t,state:1,rate:ytPlayer.getPlaybackRate()||1}}setSongPanel(false)}else Live.clock=null;if(e.data===0){showSongResults();saveRun();$('feedback').textContent='Song finished · '+hits+' hits';}},
  onPlaybackRateChange:()=>{Live.clock=null;refreshPracticeControls()},
  onError:e=>{if(pg!==playerGeneration)return;running=false;ytReady=false;Live.clock=null;$('songChartStatus').textContent='This recording cannot play here ('+e.data+'). Choose another recording above.';},
  onAutoplayBlocked:()=>{videoDock.hidden=true;cancelCountIn();Live.readyToStart=false;running=false;$('play').textContent='▶ Play song';$('feedback').textContent='Playback was blocked. Press Play to start.'}
 }});
}
function mediaTime(){try{return ytReady?ytPlayer.getCurrentTime():0}catch{return 0}}
function timeText(t){return Math.floor(Math.max(0,t)/60)+':'+String(Math.floor(Math.max(0,t))%60).padStart(2,'0')}
function clearJudgment(at){hits=misses=streak=bestStreak=score=perfectHits=goodHits=0;notes.forEach(n=>{n.result=n.t<at-.12?'skipped':null;n.sounded=n.t<at});Live.clickBeat=-1;stats()}
function seekTo(at){if(!ytReady)return;cancelCountIn();Live.readyToStart=false;ytPlayer.seekTo(Math.max(0,at),true);Live.clock=null;lastSongPosition=null;clearJudgment(at)}
seek.oninput=()=>seekTo(Number(seek.value));sectionSelect.onchange=()=>{if(sectionSelect.value!=='')seekTo(Number(sectionSelect.value))};
const oldReset=reset;reset=function(){if(selectedSong?.live){seekTo(0);return}oldReset()};$('reset').onclick=reset;
const oldSync=syncSongClock;
syncSongClock=function(){
 if(!selectedSong?.live)return oldSync();if(!Live.chart||!ytReady)return;if(syncCountIn())return;
 const now=performance.now(),raw=ytPlayer.getCurrentTime(),state=Live.providerState??ytPlayer.getPlayerState(),rate=ytPlayer.getPlaybackRate()||1;if(!Number.isFinite(raw))return;
 if(Live.startPending&&state===1)Live.startPending=false;
 let clock=Live.clock;if(!clock||clock.state!==state||clock.rate!==rate)clock=Live.clock={raw,at:now,time:raw,state,rate};
 const elapsed=Math.max(0,(now-clock.at)/1000);let estimated=clock.time+(state===1?elapsed*rate:0);
 // Ease small timestamp corrections across frames instead of stepping the highway.
 if(raw!==clock.raw){const error=raw-estimated;if(Math.abs(error)>2){clearJudgment(raw);estimated=raw;clock.correction=0}else clock.correction=error;clock.raw=raw;}
 if(state===1&&clock.correction){const limit=elapsed*rate*.12,step=Math.max(-limit,Math.min(limit,clock.correction));estimated+=step;clock.correction-=step;}
 if(state!==1)estimated=Live.startPending?0:raw;
 clock.time=estimated;clock.at=now;
 // One audio/visual adjustment applies equally to rendering and hit judgment.
 position=estimated-Number($('offset').value)/1000*rate;speed=rate;running=state===1;lastSongPosition=position;
 if(running&&Live.loopA!==null&&Live.loopB!==null&&raw>=Live.loopB){seekTo(Live.loopA);return}
 if(!Live.lastTransportPaint||performance.now()-Live.lastTransportPaint>80){Live.lastTransportPaint=performance.now();const videoDuration=ytPlayer.getDuration()||duration;seek.max=videoDuration;seek.value=raw;timeLabel.textContent=timeText(raw)+' / '+timeText(videoDuration);$('play').textContent=(running||Live.countIn||Live.startPending||state===3)?'Ⅱ Pause':'▶ Play song';}
 if(running&&clickToggle.checked){let bar=0;while(bar+1<Live.chart.bars.length&&Live.chart.bars[bar+1]<=estimated)bar++;const start=Live.chart.bars[bar],end=Live.chart.bars[bar+1]??start+60/(Live.chart.bpm||120)*4;const beat=bar*4+Math.floor((estimated-start)/(end-start)*4);if(beat!==Live.clickBeat){Live.clickBeat=beat;playClick(beat%4===0)}}
 stats();
};
function playClick(accent){try{audio=audio||new(window.AudioContext||window.webkitAudioContext)();if(audio.state==='suspended')audio.resume();const osc=audio.createOscillator(),gain=audio.createGain();osc.frequency.value=accent?1400:950;gain.gain.setValueAtTime(.12,audio.currentTime);gain.gain.exponentialRampToValueAtTime(.001,audio.currentTime+.035);osc.connect(gain);gain.connect(audio.destination);osc.start();osc.stop(audio.currentTime+.04)}catch{}}
function saveRun(){if(!Live.song||hits+misses===0)return;const last=runs.at(-1);if(last?.session===Live.session)return;runs.push({session:Live.session,title:Live.song.artist+' — '+Live.song.title,date:Date.now(),hits,accuracy:Math.round(hits/Math.max(1,hits+misses)*100),streak:bestStreak,score});runs=runs.slice(-200);persist('runs',runs)}
function drawNotation(){
 if(Live.view==='notation'&&Live.chart){const rect=notation.getBoundingClientRect(),ratio=devicePixelRatio||1;if(notation.width!==Math.round(rect.width*ratio))notation.width=Math.round(rect.width*ratio);if(notation.height!==Math.round(rect.height*ratio))notation.height=Math.round(rect.height*ratio);const c=notation.getContext('2d');c.setTransform(ratio,0,0,ratio,0,0);const w=rect.width,h=rect.height,bars=Live.chart.bars;c.clearRect(0,0,w,h);let active=0;while(active+1<bars.length&&bars[active+1]<=position)active++;const first=Math.max(0,active-1),count=Math.min(3,bars.length-first),left=w*.24,right=w*.88,top=h*.48,staffGap=Math.max(12,h*.025),barWidth=(right-left)/count;
  c.fillStyle='#06121bdc';c.fillRect(left-24,top-75,right-left+48,staffGap*8+110);c.strokeStyle='#9bb3c6';c.lineWidth=1;for(let i=0;i<5;i++){c.beginPath();c.moveTo(left,top+i*staffGap);c.lineTo(right,top+i*staffGap);c.stroke()}c.font='13px Arial';
  for(let b=first;b<first+count;b++){const x=left+(b-first)*barWidth;c.strokeStyle='#637f91';c.beginPath();c.moveTo(x,top);c.lineTo(x,top+staffGap*4);c.stroke();c.fillStyle='#a7c5d9';c.fillText('Bar '+(b+1),x+8,top-30);const end=bars[b+1]??Live.chart.duration;
   for(const n of Live.chart.notes){if(n.bar!==b+1)continue;const px=x+12+n.fraction*(barWidth-24),lane={hat:-.5,crash1:-1,crash2:-1,ride:0,tom1:1,tom2:1.5,tom3:2,floor:3,snare:2.5,kick:4}[n.id]??2,py=top+(n.id==='hat'&&n.articulation==='pedal'?5:lane)*staffGap,d=kit.find(d=>d.id===n.id);c.fillStyle=d?.color||'#eefaff';c.strokeStyle=c.fillStyle;c.lineWidth=2;c.beginPath();if(n.id==='hat'&&n.articulation==='pedal'){c.moveTo(px,py-5);c.lineTo(px+5,py+4);c.lineTo(px-5,py+4);c.closePath();c.fill()}else if(['hat','ride','crash1','crash2'].includes(n.id)){c.moveTo(px-4,py-4);c.lineTo(px+4,py+4);c.moveTo(px+4,py-4);c.lineTo(px-4,py+4);c.stroke()}else{c.ellipse(px,py,5,3.8,-.3,0,Math.PI*2);c.fill()}c.beginPath();c.moveTo(px+4,py);c.lineTo(px+4,py-27);c.stroke();if(n.articulation==='open'){c.beginPath();c.arc(px,py-34,4,0,Math.PI*2);c.stroke()}}
   if(b===active){const fraction=Math.max(0,Math.min(1,(position-bars[b])/(end-bars[b]))),playX=x+12+fraction*(barWidth-24);c.strokeStyle='#fff';c.shadowColor='#4cd9ff';c.shadowBlur=12;c.lineWidth=2;c.beginPath();c.moveTo(playX,top-50);c.lineTo(playX,top+staffGap*5);c.stroke();c.shadowBlur=0}
  }c.fillStyle='#b6ccdb';c.font='12px Arial';c.fillText('× closed hat / cymbal    ● drum    ○ open hat    △ pedal chick',left,top+staffGap*6);
 }
 requestAnimationFrame(drawNotation);
}requestAnimationFrame(drawNotation);
// Initial discovery appears when Songs is opened, not over the locked stage.
$('songChartStatus').textContent='Choose a song from the live library.';

const menuStyle=el('style');menuStyle.textContent=`#sessionMenu{width:min(600px,94vw);max-height:88dvh;overflow:auto;background:#07101ef5;color:#edf6ff;border:1px solid #678ca6;border-radius:10px;padding:18px}#sessionMenu::backdrop{background:#000a}#sessionMenu h2{margin:0;flex:1}#sessionMenu>.bar{margin-bottom:16px}#sessionMenu>button{margin:0 8px 12px 0}#sessionMenu #songPlayback{position:static;transform:none;visibility:visible;pointer-events:auto;width:auto;max-width:none;max-height:none;margin-top:8px}#sessionMenu #songPlayback[hidden]{display:none}.scene>.song-info{max-width:270px}.session-buttons{gap:5px}.session-buttons button{font-size:11px;padding:7px 8px}.performance-meter{top:180px;left:25px;z-index:4}.meter-track{height:clamp(80px,22dvh,180px)}`;document.head.append(menuStyle);
// A dedicated starting page keeps navigation out of the playing surface.
const startPage=el('section');startPage.id='startPage';startPage.setAttribute('aria-label','Drum Highway main menu');
const kitNameLabel=el('small','Keyboard practice');
const homeCard=el('div',undefined,'home-card'),brandTitle=el('h1'),titleGraphic=el('img');titleGraphic.src='./drum-highway-title.png';titleGraphic.alt='Drum Highway';titleGraphic.className='menu-title-graphic';titleGraphic.width=1780;titleGraphic.height=866;brandTitle.append(titleGraphic);homeCard.append(kitNameLabel,brandTitle,el('p','Choose a song, set up your kit, or jump into practice.'));
const homeOptions=el('div',undefined,'home-options');for(const id of ['libraryToggle','setupToggle','guidesToggle'])homeOptions.append($(id));
const resumeSession=button('▶ Play / resume session',()=>showStartingPage(false),'primary');
resumeSession.id='resumeSession';homeCard.append(homeOptions,resumeSession);startPage.append(homeCard);document.body.append(startPage);
function showStartingPage(open){if(open){if(ytReady&&ytPlayer)ytPlayer.pauseVideo();running=false;setSongPanel(false);toggleSetup(false);if(layoutEditing){layoutEditing=false;$('layoutToggle').textContent='↔ Arrange drums';$('layoutToggle').setAttribute('aria-pressed','false');renderPads()}}startPage.hidden=!open;document.body.classList.toggle('home-screen',open)}
mainMenu.onclick=()=>showStartingPage(true);
const arrangeButton=$('layoutToggle'),arrangeAction=arrangeButton.onclick;
const saveArrangement=button('✓ Save arrangement',()=>{arrangeAction();toggleSetup(true)});saveArrangement.id='saveArrangement';document.querySelector('.session-buttons').append(saveArrangement,$('fullscreenToggle'));
const kitArrangement=el('div',undefined,'bar');kitArrangement.style.margin='16px 0';kitArrangement.append(arrangeButton);$('kit').before(kitArrangement);
arrangeButton.onclick=()=>{showStartingPage(false);toggleSetup(false);if(!layoutEditing)arrangeAction()};
$('setupToggle').onclick=()=>{showStartingPage(false);toggleSetup(true)};
const guidesDialog=el('dialog');guidesDialog.id='guidesDialog';guidesDialog.append(button('Close guides',()=>guidesDialog.close()),$('bottomGuides'));document.body.append(guidesDialog);
$('guidesToggle').onclick=()=>{$('bottomGuides').hidden=false;guidesDialog.showModal()};
const openFromMenu=openLiveSong;openLiveSong=async function(id){showStartingPage(false);await openFromMenu(id)};
const homeStyle=el('style');homeStyle.textContent=`
body>header{display:none}main{height:100dvh!important;min-height:480px}.scene{height:100%!important}#startPage{position:fixed;inset:0;z-index:15;display:grid;place-items:center;padding:24px;overflow:auto;background:linear-gradient(#020914bb,#020914ed),url('./neon-stage.png') center/cover}#startPage[hidden]{display:none}.home-card{width:min(600px,100%);padding:32px;border:1px solid #58758e;background:#04101bea;border-radius:14px;box-shadow:0 15px 70px #0009}.home-card>small{letter-spacing:3px;color:#a1d6ef;font-size:11px}.home-card h1{letter-spacing:4px;font-size:clamp(25px,4vw,40px);margin:12px 0}.home-card p{color:#a9c3d6;line-height:1.6}.home-options{display:grid;grid-template-columns:1fr;gap:12px;margin:24px 0}.home-options button{font-size:16px;padding:22px 12px}.home-card>button{margin:8px 8px 0 0}.home-screen main{visibility:hidden}#saveArrangement{display:none}.layout-editing #saveArrangement{display:block}#guidesDialog{width:min(1100px,94vw);max-height:90dvh;overflow:auto;background:#06111d;border:1px solid #678ca6}#guidesDialog .reference-guides{display:block!important}#guidesDialog img{max-width:100%;height:auto}.session-buttons #fullscreenToggle{font-size:10px;padding:7px 8px}body>footer{display:none}
`;document.head.append(homeStyle);showStartingPage(true);

const videoDock=el('div');videoDock.id='videoStart';videoDock.hidden=true;videoDock.append(el('small','Press Play to start'),$('youtubeHost'));document.querySelector('.scene').append(videoDock);const videoStyle=el('style');videoStyle.textContent='#sessionMenu{display:none!important}#videoStart,#videoStart[hidden]{display:block!important;opacity:0;pointer-events:none;clip-path:inset(100%);position:absolute;top:12px;left:50%;transform:translateX(-50%);width:280px;max-width:35vw;z-index:5;background:#06101df5;border:1px solid #678ca6;border-radius:8px;padding:6px}#videoStart small{display:block;font-size:11px;margin-bottom:5px}#videoStart iframe{width:100%;height:160px;min-height:160px}';document.head.append(videoStyle);

$('bottomGuides').append(el('p','HI-HAT: filled oval = closed stick hit · hollow ring = open stick hit · triangle = pedal chick (foot only).'));
const quickSongs=button('♫ Songs',()=>{if(ytReady&&ytPlayer)ytPlayer.pauseVideo();running=false;$('play').textContent='▶ Play';library.showModal();renderSongs();searchBox.focus()});quickSongs.id='quickSongs';document.querySelector('.session-buttons').append(quickSongs);

$('bottomGuides').append(el('p','Pedal chick triangles travel on the separate HH FOOT rail. Symbols at the same height are simultaneous; symbols at different heights occur at different times.'));
const practiceControls=el('div',undefined,'practice-controls'),speedButtons=new Map();
const speedRow=el('div',undefined,'bar');speedRow.setAttribute('aria-label','Playback speed');
for(const [rate,label] of [[1,'Full speed'],[.75,'¾ speed'],[.5,'½ speed']]){const b=button(label,()=>{if(songChart&&!ytReady)return;$('speed').value=rate*100;$('speed').oninput();Live.clock=null;refreshPracticeControls()});b.setAttribute('aria-pressed',String(rate===1));speedButtons.set(rate,b);speedRow.append(b)}
const backingRow=el('div',undefined,'bar');backingRow.append($('useOriginal'),$('useDrumless'));const backingHint=el('small');backingHint.id='backingHint';practiceControls.append(speedRow,backingRow,backingHint);document.querySelector('.song-info').append(practiceControls);
function refreshPracticeControls(){
 const rates=songChart&&ytReady?ytPlayer.getAvailablePlaybackRates():[.5,.75,1];const current=songChart&&ytReady?ytPlayer.getPlaybackRate():Number($('speed').value)/100;
 for(const [rate,b] of speedButtons){b.disabled=!!songChart&&!ytReady||!rates.includes(rate);b.setAttribute('aria-pressed',String(Math.abs(current-rate)<.01));b.classList.toggle('selected',Math.abs(current-rate)<.01)}
 $('useOriginal').textContent='With drums';$('useDrumless').textContent='No drums';backingRow.hidden=!Live.song;
 const hasBacking=!!Live.song&&records().some(m=>m.key==='drumless');backingHint.textContent=Live.song&&!hasBacking?'No mapped drumless recording for this song.':'';
 $('useDrumless').title=hasBacking?'Play the matching drumless backing':'No matching drumless recording is available';
}
const practiceStyle=el('style');practiceStyle.textContent='.practice-controls{width:100%;display:grid;gap:7px;margin-top:7px}.practice-controls button{font-size:11px;padding:7px 9px}.practice-controls .selected{background:#164363;border-color:#a9e4ff}.practice-controls small{font-size:10px;color:#b2c8da}.practice-controls [hidden]{display:none}.performance-meter{top:270px}';document.head.append(practiceStyle);refreshPracticeControls();
function renderPlayGuide(){
 const root=$('bottomGuides');root.className='play-guide';root.hidden=false;root.replaceChildren(el('h2','How to read the highway'),el('p','Play each note when its center reaches the strike line. Notes at the same height happen together.'));
 const grid=el('div',undefined,'guide-grid');
 for(const [id,articulation,title,description] of [
 ['hat',null,'Closed hi-hat','Filled oval: stick hit with the hi-hat pedal held closed.'],
 ['hat','open','Open hi-hat','Hollow ring: stick hit with the hi-hat pedal open.'],
 ['hat','pedal','Hi-hat pedal chick','Triangle on HH FOOT: close the pedal with your foot. No stick hit.'],
 ['snare',null,'Snare and toms','Metal-rimmed rectangle: hit the drum with the matching color.'],
 ['crash1',null,'Crash and ride','Filled cymbal note: orange for either crash, yellow for ride.'],
 ['kick',null,'Kick drum','Blue bar across the highway: press the bass-drum pedal.']]){
 const card=el('article',undefined,'guide-card'),sample=el('canvas');sample.width=200;sample.height=90;sample.setAttribute('aria-label',title+' symbol');
 const mainContext=ctx;try{ctx=sample.getContext('2d');if(id==='kick'){ctx.fillStyle=kit.find(d=>d.id==='kick')?.color||'#278cff';ctx.fillRect(12,39,176,8);ctx.fillStyle='#eafaff';ctx.fillRect(12,39,176,1)}else{const d=kit.find(d=>d.id===id)||defaults.find(d=>d.id===id);paintGem(100,42,40,d,articulation)}}finally{ctx=mainContext}
 card.append(sample,el('h3',title),el('p',description));grid.append(card)
 }
 root.append(grid,el('p','Same height = play together. The HH FOOT track is for your foot; the hi-hat lane is for your stick. Change colors in Kit setup.'));
}
$('guidesToggle').onclick=()=>{renderPlayGuide();guidesDialog.showModal()};
const guideStyle=el('style');guideStyle.textContent='#guidesDialog{width:min(960px,94vw);max-height:90dvh;padding:22px;color:#edf6ff;overflow-y:auto}#guidesDialog>button{position:sticky;top:0;z-index:1;background:#0b2134;margin-bottom:16px}.play-guide{height:auto!important;max-height:none!important;overflow:visible!important;position:static!important;padding:0!important}.play-guide h2{font-size:25px;margin:4px 0 12px}.play-guide p{font-size:16px;line-height:1.55;color:#c2d5e3}.guide-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}.guide-card{padding:16px;background:#091c2c;border:1px solid #34556d;border-radius:10px}.guide-card canvas{position:static;width:200px;max-width:100%;height:90px;display:block;background:transparent}.guide-card h3{font-size:19px;margin:8px 0}.guide-card p{margin:0}@media(max-width:620px){.guide-grid{grid-template-columns:1fr}}';document.head.append(guideStyle);

const searchStyle=el('style');searchStyle.textContent='#songLibrary{height:min(700px,86dvh);overflow:hidden}#liveResults{max-height:none;overflow:auto;height:calc(100% - 205px);min-height:80px}#songLibrary .live-status{min-height:24px;margin:8px 0}';document.head.append(searchStyle);

const brandStyle=el('style');brandStyle.textContent='.home-card{text-align:center;width:min(680px,100%)}.home-card h1{margin:20px 0 16px;line-height:0}.menu-title-graphic{display:block;width:100%;max-width:540px;height:auto;margin:0 auto;filter:drop-shadow(0 6px 16px #00b7ff22)}@media(max-height:750px){.home-card{padding:20px 28px}.menu-title-graphic{max-width:400px}.home-options{gap:9px;margin:16px 0}.home-options button{padding:16px 12px}}';document.head.append(brandStyle);

const kitAliases=stored('kit-names',{}),kitNameSettings=el('div',undefined,'kit-name-settings'),kitNameInput=el('input'),detectedKitLabel=el('small');kitNameInput.type='text';kitNameInput.maxLength=60;kitNameInput.id='kitNameInput';kitNameInput.placeholder='Use connected device name';const kitNameCaption=el('label','Kit display name');kitNameCaption.htmlFor='kitNameInput';
function connectedKit(){const port=midiAccess?.inputs.get($('device').value);return port?.state==='connected'?port:null}
function kitAliasKey(){return connectedKit()?.id||'keyboard-practice'}
function refreshKitName(updateField=true){const port=connectedKit(),alias=kitAliases[kitAliasKey()]||'',name=alias||port?.name||'Keyboard practice';kitNameLabel.textContent=name+(alias&&!port?' · not connected':'');detectedKitLabel.textContent=port?'Detected MIDI device: '+(port.name||'Unnamed MIDI input'):'No MIDI kit connected. Connect MIDI to detect your device.';if(updateField)kitNameInput.value=alias;kitNameInput.placeholder=port?.name||'Use connected device name'}
kitNameInput.oninput=()=>{const alias=kitNameInput.value.trim().slice(0,60);if(alias)kitAliases[kitAliasKey()]=alias;else delete kitAliases[kitAliasKey()];persist('kit-names',kitAliases);refreshKitName(false)};
const automaticKitName=button('Use device name',()=>{delete kitAliases[kitAliasKey()];persist('kit-names',kitAliases);refreshKitName()});kitNameSettings.append(kitNameCaption,kitNameInput,automaticKitName,detectedKitLabel);$('kit').before(kitNameSettings);
const originalDeviceRefresh=devices;devices=function(){originalDeviceRefresh();refreshKitName()};$('device').onchange=()=>refreshKitName();refreshKitName();
const kitNameStyle=el('style');kitNameStyle.textContent='.kit-name-settings{display:grid;gap:8px;margin:16px 0;padding:12px;background:#071725;border:1px solid #34536b;border-radius:8px}.kit-name-settings input{width:100%}.kit-name-settings small{font-size:11px;color:#a9c7da;line-height:1.5}';document.head.append(kitNameStyle);
const compactGuideStyle=el('style');compactGuideStyle.textContent=`
#guidesDialog{width:min(1060px,96vw);max-height:94dvh;padding:20px;overflow:hidden}#guidesDialog>button{position:absolute;right:20px;top:16px;margin:0;font-size:13px;padding:7px 10px}.play-guide h2{font-size:23px;padding-right:130px;margin:0 0 12px}.play-guide>p{font-size:14px;line-height:1.4;margin:10px 0}.guide-grid{grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.guide-card{padding:12px}.guide-card canvas{width:140px;height:63px;margin:0 auto}.guide-card h3{font-size:17px;margin:6px 0}.guide-card p{font-size:14px;line-height:1.4}.play-guide>p:last-child{margin-bottom:0}
@media(max-height:700px){#guidesDialog{padding:16px}.play-guide h2{font-size:21px;margin-bottom:8px}.play-guide>p{font-size:13px;margin:8px 0}.guide-grid{gap:9px}.guide-card{padding:10px}.guide-card canvas{width:110px;height:49.5px}.guide-card h3{font-size:16px;margin:4px 0}.guide-card p{font-size:13px}}
@media(max-width:700px){.guide-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.guide-card{padding:8px}.guide-card canvas{width:80px;height:36px}.guide-card h3{font-size:14px;margin:3px 0}.guide-card p{font-size:12px;line-height:1.3}.play-guide h2{font-size:19px}.play-guide>p{font-size:12px}}
`;document.head.append(compactGuideStyle);
const countInOverlay=el('div');countInOverlay.id='countInOverlay';countInOverlay.hidden=true;countInOverlay.setAttribute('aria-live','polite');document.querySelector('.scene').append(countInOverlay);
function cancelCountIn(){if(Live.warmup){clearTimeout(Live.warmup.timer);Live.warmup=null;if(ytReady)ytPlayer.pauseVideo()}if(Live.restoreAudio&&ytPlayer){ytPlayer.unMute();Live.restoreAudio=false}Live.countIn=null;Live.startPending=false;countInOverlay.hidden=true}
function prepareCountIn(){cancelCountIn();Live.readyToStart=true;Live.clock=null;running=false;position=-NOTE_APPROACH_SECONDS;if(ytReady){ytPlayer.seekTo(0,true);ytPlayer.pauseVideo()}clearJudgment(0);$('play').textContent='▶ Play';$('feedback').textContent='Ready · press Play for a count-in.'}
function warmRecording(){
 if(!ytPlayer.mute||!ytPlayer.unMute){beginCountIn();return}
 Live.restoreAudio=!ytPlayer.isMuted();ytPlayer.mute();Live.warmup={timer:setTimeout(finishWarmup,4000)};running=false;position=-NOTE_APPROACH_SECONDS;$('play').textContent='Ⅱ Pause';$('feedback').textContent='Preparing recording…';ytPlayer.playVideo();
}
function finishWarmup(){if(!Live.warmup)return;clearTimeout(Live.warmup.timer);Live.warmup=null;ytPlayer.seekTo(0,true);ytPlayer.pauseVideo();Live.providerState=2;Live.clock=null;beginCountIn()}
function beginCountIn(){if(!ytReady||!Live.chart)return;Live.readyToStart=true;const rate=ytPlayer.getPlaybackRate()||1;Live.countIn={start:performance.now(),rate,duration:Math.max(3,NOTE_APPROACH_SECONDS/rate)};ytPlayer.pauseVideo();position=-NOTE_APPROACH_SECONDS;running=false;countInOverlay.hidden=false;countInOverlay.textContent='3';$('play').textContent='Ⅱ Pause';$('feedback').textContent='Get ready';}
function syncCountIn(){if(!selectedSong?.live)return false;if(!Live.countIn){if(Live.readyToStart&&Live.providerState!==1){position=-NOTE_APPROACH_SECONDS;running=false;return true}return false}
 const remaining=Live.countIn.duration-(performance.now()-Live.countIn.start)/1000;
 if(remaining<=0){cancelCountIn();Live.readyToStart=false;Live.clock=null;Live.startPending=true;position=0-Number($('offset').value)/1000*(ytPlayer.getPlaybackRate()||1);ytPlayer.playVideo();$('feedback').textContent='';return true}
 position=-Math.min(NOTE_APPROACH_SECONDS,remaining*Live.countIn.rate)-Number($('offset').value)/1000*Live.countIn.rate;running=false;countInOverlay.textContent=String(Math.ceil(remaining/Live.countIn.duration*3));return true;
}
const playWithoutCountIn=$('play').onclick;$('play').onclick=async()=>{if(selectedSong?.live){if(Live.warmup){cancelCountIn();Live.readyToStart=true;$('play').textContent='▶ Play';return}if(Live.startPending){cancelCountIn();ytPlayer.pauseVideo();Live.readyToStart=true;$('play').textContent='▶ Play';return}if(Live.countIn){cancelCountIn();$('play').textContent='▶ Play';$('feedback').textContent='Count-in paused';return}if(Live.readyToStart){beginCountIn();return}}return playWithoutCountIn()};
const resetWithoutCountIn=reset;reset=function(){if(selectedSong?.live){const wasPlaying=running||!!Live.countIn;prepareCountIn();if(wasPlaying)beginCountIn();return}resetWithoutCountIn()};$('reset').onclick=reset;
const returnWithoutCountIn=returnToGroove;returnToGroove=function(){cancelCountIn();Live.readyToStart=false;returnWithoutCountIn()};
const homeWithoutCountIn=showStartingPage;showStartingPage=function(open){if(open)cancelCountIn();return homeWithoutCountIn(open)};
const songsWithoutCountIn=quickSongs.onclick;quickSongs.onclick=()=>{cancelCountIn();return songsWithoutCountIn()};
const countInStyle=el('style');countInStyle.textContent='#countInOverlay{position:absolute;z-index:6;left:50%;top:40%;transform:translate(-50%,-50%);font-size:clamp(80px,12dvh,150px);font-weight:800;color:#effbff;text-shadow:0 0 25px #26bfff,0 4px 12px #000;pointer-events:none}#countInOverlay[hidden]{display:none}';document.head.append(countInStyle);

// Compact floating controls leave the stage visible between groups.
const floatingControlsStyle=el('style');floatingControlsStyle.textContent=`
.scene>.song-info{display:flex;align-items:start;justify-content:start!important;gap:8px;left:16px;top:16px;width:270px;max-width:calc(50vw - 55px);padding:0;background:transparent;border:0;box-shadow:none;backdrop-filter:none}
.scene>.song-info>div:first-child{width:100%;padding:3px 2px;text-shadow:0 2px 5px #000,0 0 9px #000}
.scene>.song-info h2{font-size:15px;margin-bottom:4px}.scene>.song-info small{font-size:11px}
.scene>.song-info #mode{font-size:10px;padding:5px 8px;border-color:#7892a666;background:#04101bbd;border-radius:14px}
.scene>.song-info .session-buttons{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;margin:0}
.scene>.song-info button{border-radius:10px;background:linear-gradient(180deg,#132638d9,#06101cbd);border-color:#8eb2ce88;box-shadow:0 2px 7px #0005;font-size:11px;padding:8px 5px;min-height:34px}
.scene>.song-info #play{background:linear-gradient(#228bc9e8,#0b4369e8);border-color:#9be7ff}.scene>.song-info #fullscreenToggle{grid-column:span 2;font-size:10px}
.scene>.song-info .practice-controls{margin:3px 0 0;gap:6px}.scene>.song-info .practice-controls .bar{display:flex;flex-wrap:nowrap;gap:5px}.scene>.song-info .practice-controls button{flex:1;min-width:0;font-size:10px;padding:7px 4px;min-height:30px}.scene>.song-info .practice-controls .selected{background:linear-gradient(#206087dd,#10334cdd);border-color:#a9e4ff}.scene>.song-info #backingHint{font-size:9px;text-shadow:0 1px 4px #000}
@media(max-width:850px){.scene>.song-info{left:10px;top:10px;width:230px;gap:5px}.scene>.song-info button{font-size:10px;padding:6px 3px;min-height:30px}.scene>.song-info h2{font-size:13px}.scene>.song-info #mode{font-size:9px}.scene>.song-info .practice-controls button{font-size:9px}}
`;document.head.append(floatingControlsStyle);

const songIdentityStyle=el('style');songIdentityStyle.textContent='.scene>.song-info>div:first-child{padding:9px 12px;border-left:3px solid #6bdcff;background:linear-gradient(90deg,#03111ce0,#03111c22);border-radius:3px 10px 10px 3px}.scene>.song-info h2{font-size:clamp(19px,1.5vw,25px);line-height:1.15;max-width:none;font-weight:800;margin:0 0 6px;color:#fff}.scene>.song-info>div:first-child small{display:block;font-size:14px;line-height:1.3;color:#c7ebff;font-weight:600}.performance-meter{top:300px}@media(max-height:650px){.scene>.song-info h2{font-size:18px}.scene>.song-info>div:first-child small{font-size:12px}.performance-meter{top:285px}}';document.head.append(songIdentityStyle);

// Nonmodal results keep the left-side session controls usable.
const songResults=el('section');songResults.id='songResults';songResults.hidden=true;songResults.setAttribute('role','dialog');songResults.setAttribute('aria-modal','false');songResults.setAttribute('aria-labelledby','songResultsHeading');
const resultsHeading=el('h2','Song complete');resultsHeading.id='songResultsHeading';const resultsSong=el('p',undefined,'results-song'),resultsMode=el('p',undefined,'results-mode'),resultsGrid=el('div',undefined,'results-grid'),resultsActions=el('div',undefined,'results-actions');
const dismissResults=button('✕',()=>hideSongResults());dismissResults.className='results-close';dismissResults.setAttribute('aria-label','Close song results');
const resultsHome=button('Main menu',()=>{hideSongResults();showStartingPage(true)}),resultsNew=button('New song',()=>{hideSongResults();quickSongs.onclick()}),resultsRestart=button('Restart song',()=>{hideSongResults();reset();if(selectedSong?.live)beginCountIn()});resultsRestart.className='primary';resultsActions.append(resultsHome,resultsNew,resultsRestart);songResults.append(dismissResults,resultsHeading,resultsSong,resultsMode,resultsGrid,resultsActions);document.body.append(songResults);
let resultFocus=null,resultsShown=false;
function hideSongResults(){songResults.hidden=true;if(resultFocus?.isConnected)resultFocus.focus()}
function showSongResults(){if(!selectedSong?.live||resultsShown)return;resultsShown=true;running=false;$('play').textContent='▶ Play song';const total=notes.filter(n=>n.result!=='skipped').length,notHit=Math.max(0,total-hits),accuracy=total?Math.round(hits/total*100)+'%':'—';resultsSong.textContent=Live.song.artist+' — '+Live.song.title;resultsMode.textContent=($('mode').value==='practice'?'Practice mode':'Game mode')+' · '+Math.round((ytPlayer.getPlaybackRate()||1)*100)+'% speed';resultsGrid.replaceChildren();for(const [label,value] of [['Score',score.toLocaleString()],['Accuracy',accuracy],['Perfect',perfectHits],['Good',goodHits],[$('mode').value==='practice'?'Not hit':'Missed',notHit],['Best streak',bestStreak]]){const item=el('div');item.append(el('strong',String(value)),el('span',label));resultsGrid.append(item)}resultFocus=document.activeElement;songResults.hidden=false;resultsRestart.focus()}
const clearBeforeResults=clearJudgment;clearJudgment=function(at){hideSongResults();resultsShown=false;clearBeforeResults(at)};
const resetBeforeResults=reset;reset=function(){hideSongResults();resultsShown=false;Live.session=crypto.randomUUID();resetBeforeResults()};$('reset').onclick=reset;
const homeBeforeResults=showStartingPage;showStartingPage=function(open){if(open)hideSongResults();return homeBeforeResults(open)};
const songsBeforeResults=quickSongs.onclick;quickSongs.onclick=()=>{hideSongResults();return songsBeforeResults()};
const openBeforeResults=openLiveSong;openLiveSong=async function(id){hideSongResults();resultsShown=false;return openBeforeResults(id)};
const resultsStyle=el('style');resultsStyle.textContent=`#songResults{position:fixed;z-index:14;left:50%;top:50%;transform:translate(-50%,-50%);width:min(520px,calc(100vw - 32px));max-height:90dvh;overflow:auto;padding:28px;border:1px solid #80c6e8;border-radius:16px;background:linear-gradient(145deg,#11283bf5,#040d19fa);box-shadow:0 18px 75px #000b,0 0 30px #3ac5ff22;color:#f3faff;text-align:center}#songResults[hidden]{display:none}#songResults h2{font-size:28px;margin:0 20px 10px}.results-close{position:absolute;right:12px;top:12px;border:0;background:transparent}.results-song{font-size:17px;line-height:1.4;margin:0 0 6px;color:#c5edff}.results-mode{font-size:12px;color:#9fbfd3;margin:0 0 20px}.results-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:22px}.results-grid>div{padding:14px 5px;background:#03111e99;border:1px solid #3e687e;border-radius:10px}.results-grid strong{display:block;font-size:26px;color:#a6ebff;font-variant-numeric:tabular-nums}.results-grid span{display:block;margin-top:5px;font-size:12px;color:#c0d5e4}.results-actions{display:flex;flex-wrap:wrap;justify-content:center;gap:8px}.results-actions button{min-height:42px}@media(max-width:900px){#songResults{width:min(440px,calc(100vw - 32px));padding:22px}.results-grid{gap:7px}.results-grid strong{font-size:22px}}`;document.head.append(resultsStyle);
const playBeforeResults=$('play').onclick;$('play').onclick=async()=>{if(selectedSong?.live&&resultsShown&&ytPlayer.getPlayerState()===0){hideSongResults();reset();beginCountIn();return}return playBeforeResults()};
