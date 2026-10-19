const assert=require('node:assert/strict');const A=require('../dist/song-alignment.js');
let seed=481;const rnd=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/2**32};
const times=[];let t=1;while(t<85){times.push(t);t+=.22+rnd()*.7}
const chart=A.validateChart({notes:times.map((t,i)=>({t,id:i%2?'snare':'kick'})),duration:90});
function recording(offset,stretch,drift=0){const samples=new Float32Array(100*8000);for(const t of times){const hit=t*stretch+offset+drift*Math.sin(t/30);const start=Math.round(hit*8000);for(let i=0;i<160;i++)samples[start+i]=(i%2?1:-1)*Math.exp(-i/35)}return A.onsetEnvelope(samples,8000)}
for(const [offset,stretch,drift] of [[2.37,1.018,0],[-.63,.94,0],[1.7,1.006,.06]]){const e=recording(offset,stretch,drift),a=A.align(e.values,e.rate,chart);const errors=times.map(t=>Math.abs(A.mapTime(t,a)-(t*stretch+offset+drift*Math.sin(t/30))));const mean=errors.reduce((x,y)=>x+y,0)/errors.length;assert.ok(mean<.05,JSON.stringify({offset,stretch,mean,a}));assert.ok(a.accepted,JSON.stringify(a));console.log('PASS alignment',offset,stretch,'mean error',Math.round(mean*1000)+' ms','confidence',a.confidence)}
assert.throws(()=>A.align(new Float32Array(2000),100,chart),/rhythmic signal/);
assert.throws(()=>A.validateChart({notes:[{t:Infinity,id:'kick'}]}));
const periodic=A.validateChart({notes:Array.from({length:100},(_,i)=>({t:1+i*.5,id:'kick'}))});const periodicValues=new Float32Array(7000);for(let i=100;i<6900;i+=50)periodicValues[i]=1;const ambiguous=A.align(periodicValues,100,periodic);assert.equal(ambiguous.accepted,false,'Repetitive beat phases must not be called confidently aligned');
// Minimal MIDI with a tempo change and channel-10 notes.
const bytes=[...Buffer.from('MThd'),0,0,0,6,0,0,0,1,1,224,...Buffer.from('MTrk')];const track=[0,255,81,3,7,161,32,0,153,36,100];for(let i=0;i<15;i++)track.push(131,96,153,i%2?38:42,100);track.push(0,255,47,0);bytes.push(0,0,0,track.length,...track);const buffer=Uint8Array.from(bytes);const parsed=A.midiChart(buffer.buffer);assert.equal(parsed.notes.length,16);assert.equal(parsed.notes[1].t,.5);assert.equal(parsed.notes[0].id,'kick');
console.log('PASS silence rejection, ambiguous matches, chart validation, and MIDI parsing');
