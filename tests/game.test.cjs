const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
class Element {
  constructor(){this.style={setProperty(){}};this.value='';this.checked=false;this.children=[];this.dataset={};this.classList={toggle(){},add(){},remove(){},contains(){return false}};}
  append(...children){this.children.push(...children)}
  replaceChildren(...children){this.children=children}
  add(child){this.append(child)}
  setAttribute(){}
  getContext(){return new Proxy({}, {get:(target,key)=>target[key]||(()=>key.startsWith('create')?{addColorStop(){}}:undefined)})}
  getBoundingClientRect(){return {width:this.testWidth||1440,height:720}}
}
const elements=new Map();
const get=id=>{if(!elements.has(id))elements.set(id,new Element());return elements.get(id)};
get('mode').value='game';get('offset').value='0';get('speed').value='100';
const context={devicePixelRatio:1,console,structuredClone,URL,Number,Math,JSON,Date,Map,Set,Option:class{},performance:{now:()=>1000},localStorage:{getItem:()=>null,setItem(){}},navigator:{},requestAnimationFrame(){},window:{addEventListener(){}},document:{getElementById:get,createElement:()=>new Element(),querySelector:()=>get('kick-label'),body:new Element()},setTimeout,clearTimeout};
vm.createContext(context);
vm.runInContext(fs.readFileSync('dist/app.js','utf8'),context);
const run=code=>vm.runInContext(code,context);
assert.equal(run('position'),-3);
assert.equal(run('duration'),38.4);
assert.equal(run("kit.map(d=>d.id).join(',')"),'hat,snare,tom1,tom2,tom3,floor,crash1,crash2,ride,kick');

assert.equal(run("kit.find(d=>d.id==='tom1').shape"),'rectangle');
assert.equal(run("notes.filter(n=>n.id==='hat').length"),128);
assert.equal(run('notes.every((n,i)=>!i||n.t>=notes[i-1].t)'),true);
run("running=true;position=0;strike('hat')");assert.equal(run('hits'),1);assert.equal(run('score'),100);
run("position=.66;strike('snare')");assert.equal(run('hits'),2);assert.equal(run('score'),160);
run("position=1;strike('snare')");assert.equal(run('hits'),2);assert.equal(run('streak'),0);
run("reset();running=true;position=4.5;strike('hat')");assert.equal(run('hits'),0);
run("strike('hat','open')");assert.equal(run('hits'),1);
run("reset();running=true;position=0;strike('hat');$('mode').value='practice';position=.2;strike('snare')");assert.equal(run('streak'),1);
run("reset();songChart={notes:[{id:'hat',t:1},{id:'snare',t:2}],bars:[0],alignment:{offset:0,stretch:1}};chart();ytPlayer={getPlayerState:()=>1,getCurrentTime:()=>10,getPlaybackRate:()=>1};lastSongPosition=0;syncSongClock()");
assert.equal(run('position'),10);assert.equal(run("notes.every(n=>n.result==='skipped')"),true);
for(const file of ['new-orleans','billie-jean']){
  const chart=JSON.parse(fs.readFileSync(`dist/charts/${file}.json`));
  assert.ok(Number.isFinite(chart.duration)&&chart.duration>0);
  assert.ok(chart.notes.length>1000);
  assert.ok(chart.notes.every((n,i)=>Number.isFinite(n.t)&&n.t>=0&&n.t<chart.duration&&(!i||n.t>=chart.notes[i-1].t)));
}
run("reset();const mapping=JSON.stringify(kit.find(d=>d.id==='ride').midi);reorderInstrument('ride','hat');");
assert.equal(run('visualLanes()[0].id'),'ride');
assert.equal(run("JSON.stringify(kit.find(d=>d.id==='ride').midi)===mapping"),true);
run("shiftLane('ride',1)");assert.equal(run('visualLanes()[1].id'),'ride');
run("kit.find(d=>d.id==='kick').shape='circle';shiftLane('kick',-1)");assert.equal(run('visualLanes().length'),10);assert.equal(run('visualLanes()[8].id'),'kick');
run("$('layoutToggle').onclick()");assert.equal(run('layoutEditing'),true);assert.equal(run('running'),false);
assert.equal(run("kit.find(d=>d.id==='hat').pedalMidi[0]"),44);
run("songChart=null;reset();notes=[{id:'hat',t:0,articulation:'pedal',result:null}];running=true;position=0;strike('hat')");assert.equal(run('hits'),0);run("strike('hat','pedal')");assert.equal(run('hits'),1);
run("running=false;frame(1100);$('highway').testWidth=390;frame(1200)");
run("songChart=null;reset();running=true;for(let i=0;i<10;i++){position=i*.6;strike('hat')}");assert.equal(run('perfectHits'),10);assert.equal(get('multiplier').textContent,'2×');assert.equal(run('score'),1100);
console.log('PASS: canvas render at desktop/mobile widths, layout, groove, scoring, open hi-hat, practice, seeking, and bundled charts');
