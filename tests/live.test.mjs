import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {compile} from '../src/catalog.mjs';
const bar=(pitch)=>({voices:[{beats:[{duration:[1,4],notes:[{fret:pitch}]},{duration:[1,4],notes:[{fret:38}]},{duration:[1,2],rest:true}]}]});
const part={songId:7,revisionId:9,measures:[{...bar(36),signature:[4,4]},bar(92),bar(49)]};
const meta={songId:7,revisionId:9,title:'Fixture'};
const map={id:11,songId:7,revisionId:9,status:'done',videoId:'abcdefghijk',points:[.5,3.5,5.5]};
const data=compile(part,map,meta,0);
assert.deepEqual(data.notes.slice(0,4).map(n=>n.t),[.5,1.25,3.5,4]);
assert.equal(data.notes[2].articulation,'open');
assert.throws(()=>compile(part,{...map,revisionId:8},meta,0),/revisions/);
assert.throws(()=>compile(part,{...map,points:[3,2,4]},meta,0),/invalid timing map/);
assert.throws(()=>compile(part,{...map,points:[1,2]},meta,0),/complete/);
const trailingRest={voices:[{beats:[{duration:[1,1],rest:true,notes:[{rest:true}]}]}]};
assert.equal(compile({...part,measures:[...part.measures,trailingRest]},map,meta,0).notes.length,data.notes.length,'unmapped trailing rest does not prevent playback');
assert.throws(()=>compile({...part,measures:[...part.measures,bar(36)]},map,meta,0),/complete/,'unmapped played notes remain rejected');
class Element{
 constructor(tag='div'){this.tagName=tag.toUpperCase();this.style={setProperty(){}};this.children=[];this.value='';this.checked=false;this.dataset={};this.hidden=false;this.classList={add(){},remove(){},toggle(){},contains(){return false}};}
 before(){}
 prepend(...nodes){this.children.unshift(...nodes)}
 append(...nodes){this.children.push(...nodes)}
 replaceChildren(...nodes){this.children=[...nodes]}
 add(node){this.children.push(node)}
 setAttribute(){}
 addEventListener(){}
 focus(){}
 showModal(){this.open=true}
 close(){this.open=false}
 getContext(){return new Proxy({}, {get:(t,k)=>t[k]||(()=>String(k).startsWith('create')?{addColorStop(){}}:undefined)})}
 getBoundingClientRect(){return {width:1440,height:900}}
}
const elements=new Map();const get=id=>{if(!elements.has(id))elements.set(id,new Element());return elements.get(id)};
get('mode').value='game';get('speed').value='100';get('offset').value='0';let now=0;const store=new Map();
const scene=new Element(),infoTitle=new Element(),infoSmall=new Element();let playerOptions;
const player={time:0,state:2,rate:1,getCurrentTime(){return this.time},getPlayerState(){return this.state},getPlaybackRate(){return this.rate},getDuration(){return 9},getAvailablePlaybackRates(){return [.5,.75,1]},setPlaybackRate(v){this.rate=v},playVideo(){this.state=1},pauseVideo(){this.state=2},seekTo(t){this.time=t},destroy(){},isMuted(){return false}};
const info={id:7,title:'Fixture',artist:'Test artist',revisionId:9,tracks:[{index:0,name:'Drums',preferred:true}],versions:[{id:'11',videoId:map.videoId,kind:'original'}],backings:[]};
const ctx={console,structuredClone,URL,Map,Set,Math,JSON,Number,Date,Promise,AbortController,crypto:{randomUUID:()=>String(Math.random())},location:{origin:'https://fixture.example'},devicePixelRatio:1,Option:class extends Element{constructor(text,value){super('option');this.textContent=text;this.value=value}},performance:{now:()=>now},localStorage:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v)},navigator:{},setTimeout,clearTimeout,requestAnimationFrame(){},window:{addEventListener(){}},document:{head:new Element(),body:new Element(),getElementById:get,createElement:t=>new Element(t),createTextNode:t=>({textContent:t}),querySelector:s=>s==='.scene'?scene:s.includes('h2')?infoTitle:infoSmall},fetch:async path=>({ok:true,json:async()=>path.startsWith('/api/charts/')?data:path.startsWith('/api/songs/')?info:[{id:7,title:'Fixture',artist:'Test artist'}]})};
ctx.YT={Player:class{constructor(id,options){playerOptions=options;queueMicrotask(()=>options.events.onReady({target:player}));return player}}};ctx.window.YT=ctx.YT;
vm.createContext(ctx);const run=code=>vm.runInContext(code,ctx);
run(fs.readFileSync('src/public/visual-player.js','utf8'));
run('function unloadImportedSong(){importedMedia=null}');
run(fs.readFileSync('src/public/live-library.js','utf8'));
await run('openLiveSong(7)');await Promise.resolve();
assert.equal(run('Live.song.id'),7);assert.equal(run('songChart.binding.videoId'),map.videoId);assert.equal(run('songChart.notes.length'),6);assert.equal(run('ytReady'),true);
assert(run('!!Live.countIn'),'song selection starts countdown');assert.equal(player.state,2,'song selection holds audio during countdown');player.state=1;player.time=1;playerOptions.events.onStateChange({data:1});assert.equal(player.state,2,'early provider playback is paused');assert.equal(player.time,1,'early playback is paused without another seek loop');assert(run('!!Live.countIn'),'early playback preserves countdown');run('cancelCountIn();Live.readyToStart=false');now=0;player.state=1;player.time=0;run('syncSongClock()');now=100;run('syncSongClock()');assert(Math.abs(run('position')-.1)<1e-6,'clock extrapolates between provider updates');
player.state=2;player.time=.1;now=200;run('syncSongClock()');now=500;run('syncSongClock()');assert.equal(run('position'),.1,'pause freezes timeline');
run('seekTo(4)');assert.equal(player.time,4);assert(run("notes.filter(n=>n.t<3.88).every(n=>n.result==='skipped')"));
player.state=1;player.time=4;get('offset').value='100';run('Live.clock=null;syncSongClock()');assert(Math.abs(run('position')-3.9)<1e-6,'visual adjustment uses the same scoring timeline');
get('offset').value=0;run('Live.loopA=1;Live.loopB=3;Live.clock=null;syncSongClock()');assert.equal(player.time,1,'A–B loop seeks within the same mapped recording');
run('returnToGroove()');assert.equal(run('Live.song'),null);assert.equal(run('songChart'),null);
console.log('PASS: map interpolation/revision validation, live selection, player clock, pause, seek, unified offset, A–B loop and return to groove');

run(`let rectangleCalls=0,oldIconCalls=0;ctx.roundRect=()=>rectangleCalls++;ctx.ellipse=()=>oldIconCalls++;ctx.drawImage=()=>oldIconCalls++;for(const id of ['snare','tom1','tom2','tom3','floor'])for(const pad of [false,true])paintGem(100,100,30,{id,shape:'circle',color:'#ff4b62'},null,false,pad);`);
assert(run('rectangleCalls')>0,'both drum paths render metallic rectangles');assert.equal(run('oldIconCalls'),0,'no circular or cropped drum icons underneath rectangles');
console.log('PASS: rectangular drums replace old icons on highway and strike line');

run('setSongPanel(true)');assert.equal(run('Live.panelOpen'),false);assert.equal(run('songPanel.inert'),true);run('setSongPanel(false)');assert.equal(run('songPanel.inert'),true);assert.equal(run('Live.panelOpen'),false);console.log('PASS: song controls open and collapse without replacing the player');

run('mainMenu.onclick()');assert.equal(run('startPage.hidden'),false);assert.equal(run('running'),false);run('showStartingPage(false)');assert.equal(run('startPage.hidden'),true);console.log('PASS: Main menu pauses playback and returns to starting page');

run('arrangeButton.onclick()');assert.equal(run('startPage.hidden'),true);assert.equal(run('layoutEditing'),true);run('saveArrangement.onclick()');assert.equal(run('layoutEditing'),false);assert.equal(run('startPage.hidden'),true);console.log('PASS: arrangement saves and returns to kit setup');

assert.equal(run('sessionMenu.open||false'),false,'recording-options dialog never opens');console.log('PASS: internal recording-options screen stays hidden');

run(`let hatFill=0,hatOval=0,hatTriangle=0;ctx.fill=()=>hatFill++;ctx.ellipse=()=>hatOval++;ctx.closePath=()=>hatTriangle++;paintGem(0,0,30,{id:'hat',color:'#278cff',shape:'circle'},'open');`);assert.equal(run('hatFill'),0,'open hi-hat is hollow');assert(run('hatOval')>0);run(`hatFill=hatOval=hatTriangle=0;paintGem(0,0,30,{id:'hat',color:'#278cff',shape:'circle'},'pedal')`);assert.equal(run('hatOval'),0,'pedal has no closed-hat oval underneath');assert.equal(run('hatTriangle'),1);console.log('PASS: open hi-hat hollow ring and pedal triangle render exclusively');

run(`gemSprites.clear();let spriteBlits=0;ctx.drawImage=()=>spriteBlits++;for(let j=0;j<200;j++)drawGem(j,100,20+j%10,{id:'snare',color:'#ff4b62',shape:'rectangle'});`);assert.equal(run('gemSprites.size'),1,'dense repeated notes reuse one rasterized icon');assert.equal(run('spriteBlits'),200);assert.equal(run('noteBound([{t:1},{t:3},{t:5}],3)'),1);console.log('PASS: 200 moving notes share one sprite and visibility lookup uses sorted event bounds');

assert.equal(run('pedalX(300)'),270,'pedal rail is outside the hand-hit highway');run("strike('hat','pedal')");assert.equal(run("flashes['hat-pedal']"),now,'foot input flashes its own target');console.log('PASS: pedal cues use a separate rail and independent target feedback');
await run('openLiveSong(7)');await Promise.resolve();
const originalEventTime=run('songChart.notes[2].t');run('speedButtons.get(.75).onclick()');assert.equal(player.rate,.75);run('speedButtons.get(.5).onclick()');assert.equal(player.rate,.5);assert.equal(run('songChart.notes[2].t'),originalEventTime,'speed changes use recording clock without stretching event timestamps');run('speedButtons.get(1).onclick()');assert.equal(player.rate,1);assert.equal(get('useDrumless').disabled,true,'missing drumless map stays disabled');console.log('PASS: full, three-quarter and half playback rates; unavailable backing disabled');

assert.equal(run('noteDepth(12,12)'),1,'all cues reach the strike line at their recorded time');assert(Math.abs(run('noteDepth(12+NOTE_APPROACH_SECONDS,12)'))<1e-10,'fixed approach');assert(Math.abs(run('noteDepth(12.5,12)-noteDepth(13,12)')-(.5/(2.5/1.2)))<1e-10,'spacing increases without modifying event times');console.log('PASS: fixed spacing with shared, unchanged strike timing');
await run("Live.filter='discover';renderSongs()");const previousCount=run('results.children.length');let finishSearch;ctx.fetch=()=>new Promise(resolve=>{finishSearch=resolve});const pendingSearch=run('renderSongs()');assert.equal(run('results.children.length'),previousCount,'keep existing cards during a pending search');finishSearch({ok:true,json:async()=>[]});await pendingSearch;assert.equal(run('status.textContent'),'0 songs · checking playable versions…');console.log('PASS: searching retains old results until replacement data arrives');

assert.equal(run('noteIsVisible(10,9.999)'),true);assert.equal(run('noteIsVisible(10,10)'),false,'moving cue disappears at its strike time');assert.equal(run('noteIsVisible(10,10.001)'),false,'no travel below strike line');console.log('PASS: notes stop rendering exactly at the strike line');

const silentLead={voices:[{beats:[{duration:[1,1],rest:true,notes:[{rest:true}]}]}],signature:[4,4]};assert.equal(compile({...part,measures:[silentLead,...part.measures]},{...map,points:[.5,...map.points]},meta,0).notes.length,data.notes.length,'zero-time silent lead does not prevent loading');assert.throws(()=>compile({...part,measures:[bar(36),...part.measures]},{...map,points:[.5,...map.points]},meta,0),/invalid timing/,'never collapse a played measure');console.log('PASS: zero-length silent lead is accepted; zero-length played bar rejected');

run(`midiAccess={inputs:new Map([['roland',{id:'roland',name:'Roland TD-27',state:'connected'}]])};`);get('device').value='roland';run('devices()');assert.equal(run('kitNameLabel.textContent'),'Roland TD-27');run("kitNameInput.value='My Roland kit';kitNameInput.oninput()");assert.equal(run('kitNameLabel.textContent'),'My Roland kit');run('refreshKitName()');assert.equal(run('kitNameInput.value'),'My Roland kit');run('automaticKitName.onclick()');assert.equal(run('kitNameLabel.textContent'),'Roland TD-27');run("midiAccess.inputs.get('roland').state='disconnected';devices()");assert.equal(run('kitNameLabel.textContent'),'Keyboard practice');console.log('PASS: MIDI device label, saved custom name, automatic reset and disconnect');

now=10000;run('prepareCountIn();beginCountIn();syncSongClock()');assert.equal(player.state,2,'audio paused during countdown');assert.equal(run('position'),-run('NOTE_APPROACH_SECONDS'));now=11050;run('syncSongClock()');assert.equal(run('countInOverlay.textContent'),'2');assert(run('position')<0);now=13001;run('syncSongClock()');assert.equal(player.state,1,'audio starts after countdown');assert.equal(run('Live.countIn'),null);assert.equal(run('position'),0);console.log('PASS: staged opening notes, 3-2-1 countdown and audio start after count-in');
run("running=true;position=1;notes=[{id:'snare',t:1,result:null}];strike('snare')");assert.equal(run('hitEffects.at(-1).kind'),'perfect');
run("notes=[{id:'snare',t:1.08,result:null}];strike('snare')");assert.equal(run('hitEffects.at(-1).kind'),'early');
run("notes=[{id:'snare',t:.92,result:null}];strike('snare')");assert.equal(run('hitEffects.at(-1).kind'),'late');
run("notes=[{id:'snare',t:1.3,result:null}];strike('snare')");assert.equal(run('hitEffects.at(-1).kind'),'early');assert.equal(run('notes[0].result'),null,'out-of-window effect does not award hit');
run("paintHitEffects(performance.now(),{left:100,width:900},700,visualLanes());paintHitEffects(performance.now()+700,{left:100,width:900},700,visualLanes())");assert.equal(run('hitEffects.length'),0);console.log('PASS: perfect, early and late effects follow hit judgment and expire');

now=20000;run('prepareCountIn();beginCountIn();syncSongClock()');now=23001;run('syncSongClock()');player.state=3;player.time=.4;now=23100;run('syncSongClock()');assert.equal(run('position'),0,'buffering holds notes');player.state=1;run('syncSongClock()');assert.equal(run('running'),true,'playback starts even when first provider timestamp exceeds 250ms');assert(Math.abs(run('position')-.4)<1e-6);now=23200;run('syncSongClock()');assert(Math.abs(run('position')-.5)<1e-6);console.log('PASS: delayed first timestamp cannot lock highway startup');

assert.equal(get('play').textContent,'Ⅱ Pause','playing song shows Pause');player.state=3;now+=100;run('syncSongClock()');assert.equal(get('play').textContent,'Ⅱ Pause','buffering keeps Pause label');run('prepareCountIn();beginCountIn()');assert.equal(get('play').textContent,'Ⅱ Pause','countdown shows Pause');

run('cancelCountIn();Live.readyToStart=false;Live.startPending=true;Live.clock=null');player.time=.6;player.state=2;playerOptions.events.onStateChange({data:1});now+=100;run('syncSongClock()');assert.equal(run('running'),true,'playing event wins over stale polled state');assert(run('position')>=.6);const before=run('position');now+=100;run('syncSongClock()');assert(run('position')>before,'highway advances between delayed media updates');console.log('PASS: player events drive highway despite stale state polling');
const repeated=compile({...part,measures:[{...bar(36),signature:[4,4],repeatStart:true},{...bar(49),repeat:2}]},{...map,points:[0,2,4,6]},meta,0);assert.equal(repeated.bars.length,4);assert.deepEqual(repeated.notes.filter(n=>n.fraction===0).map(n=>n.id),['kick','crash1','kick','crash1']);assert.deepEqual(repeated.notes.filter(n=>n.fraction===0).map(n=>n.t),[0,2,4,6]);console.log('PASS: repeat sections expand against exact recording timestamps');

let startupSeeks=0;const originalSeek=player.seekTo;player.seekTo=function(t){startupSeeks++;originalSeek.call(this,t)};now=40000;run('prepareCountIn();beginCountIn()');const seeksBefore=startupSeeks;now=43001;run('syncSongClock()');assert.equal(startupSeeks,seeksBefore,'countdown completion must not trigger a new seek or rebuffer');player.seekTo=originalSeek;console.log('PASS: countdown completion plays without re-seeking');

run('cancelCountIn();Live.readyToStart=false;Live.providerState=null;Live.clock=null;Live.loopA=Live.loopB=null');player.state=1;player.time=0;now=50000;run('syncSongClock()');let previous=run('position');for(let i=1;i<=120;i++){now=50000+i*1000/60;if(i%15===0)player.time=i/60-.08;run('syncSongClock()');const current=run('position'),step=current-previous;assert(step>=0&&step<.022,'delayed provider update cannot reverse or jump moving notes');previous=current}console.log('PASS: delayed provider samples are eased without backward motion or correction jumps');

ctx.fetch=async path=>({ok:true,json:async()=>path.endsWith('/100')?{tracks:[{}],versions:[]}:{tracks:[{}],versions:[{}]}});run("globalThis.availabilityFixture=[{song:{id:100,title:'Example',artist:'Band'},play:button('Checking',()=>{}),text:el('div'),actions:el('div')},{song:{id:101,title:'Example (Live)',artist:'Band'},play:button('Checking',()=>{}),text:el('div'),actions:el('div')}]");await run('checkLibrarySongs(availabilityFixture,new AbortController().signal)');assert.equal(run('availabilityFixture[0].play.disabled'),true);assert.equal(run('availabilityFixture[0].play.textContent'),'Unavailable');assert.equal(run('availabilityFixture[1].play.disabled'),false);assert.equal(run('availabilityFixture[0].alternative.textContent'),'Play alternate version');console.log('PASS: unavailable songs cannot play; verified matching alternative is offered');

player.mute=()=>{player.muted=true};player.unMute=()=>{player.muted=false};player.isMuted=()=>!!player.muted;run('prepareCountIn();warmRecording()');assert.equal(player.muted,true);assert.equal(run('Live.countIn'),null,'countdown waits for warmup');playerOptions.events.onStateChange({data:1});assert(run('!!Live.countIn'));assert.equal(player.state,2);assert.equal(player.time,0);assert.equal(player.muted,true,'warmup stays silent through countdown');now+=3100;run('syncSongClock()');assert.equal(player.muted,false);assert.equal(player.state,1);console.log('PASS: silent warmup completes before countdown and restores audio at start');
run("cancelCountIn();Live.readyToStart=false;resultsShown=false;hits=3;perfectHits=2;goodHits=1;score=300;streak=0;bestStreak=3;notes=[{result:'hit'},{result:'hit'},{result:'hit'},{result:'miss'}]");playerOptions.events.onStateChange({data:0});assert.equal(run('songResults.hidden'),false);assert.equal(run('resultsGrid.children[1].children[0].textContent'),'75%');assert.equal(run('resultsGrid.children[5].children[0].textContent'),'3');run('hideSongResults()');playerOptions.events.onStateChange({data:0});assert.equal(run('songResults.hidden'),true,'duplicate ended event does not reopen dismissed results');run('resultsRestart.onclick()');assert.equal(run('songResults.hidden'),true);assert(run('!!Live.countIn'),'results restart starts count-in');assert.equal(run('bestStreak'),0);run('cancelCountIn();resultsHome.onclick()');assert.equal(run('startPage.hidden'),false);assert.equal(run('songResults.hidden'),true);assert.equal(get('reset').onclick,run('reset'),'left restart remains wired');console.log('PASS: end results, accuracy, best streak, duplicate completion, restart and main menu');
