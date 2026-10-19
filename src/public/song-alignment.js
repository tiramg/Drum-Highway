/* Pure, testable audio/chart alignment and Standard MIDI drum import. */
(function(root){
'use strict';
function validateChart(data){
 const ids=new Set(['hat','snare','kick','tom1','tom2','tom3','floor','crash1','crash2','ride']);
 if(!data||!Array.isArray(data.notes)||data.notes.length<8||data.notes.length>100000)throw Error('Chart must contain 8–100,000 drum notes.');
 const notes=data.notes.map(n=>{if(!ids.has(n.id)||!Number.isFinite(n.t)||n.t<0||n.t>7200)throw Error('Chart has an invalid drum or timestamp.');return {id:n.id,t:n.t,articulation:['open','pedal'].includes(n.articulation)?n.articulation:null}}).sort((a,b)=>a.t-b.t);
 const duration=Math.max(Number(data.duration)||0,notes.at(-1).t+.5);if(!Number.isFinite(duration)||duration>7200)throw Error('Chart duration must be under two hours.');
 return {notes,bars:Array.isArray(data.bars)?data.bars.filter(t=>Number.isFinite(t)&&t>=0&&t<=duration):[],duration};
}
function midiChart(buffer){
 const v=new DataView(buffer);let p=0;
 const text=(n)=>{let s='';while(n--)s+=String.fromCharCode(v.getUint8(p++));return s};
 const u16=()=>{const n=v.getUint16(p);p+=2;return n},u32=()=>{const n=v.getUint32(p);p+=4;return n};
 const variable=()=>{let n=0;for(let i=0;i<4;i++){const b=v.getUint8(p++);n=(n<<7)|(b&127);if(!(b&128))return n}throw Error('Invalid MIDI delta time')};
 if(text(4)!=='MThd')throw Error('Not a Standard MIDI file.');const len=u32(),format=u16(),tracks=u16(),division=u16();if(format>1||division&32768||!division||tracks>128)throw Error('Use a MIDI format 0 or 1 file with beat-based timing.');p+=len-6;
 const tempos=[{tick:0,us:500000}],events=[];
 for(let tr=0;tr<tracks;tr++){if(text(4)!=='MTrk')throw Error('Invalid MIDI track.');const length=u32(),end=p+length;let tick=0,status=0;
  while(p<end){tick+=variable();let b=v.getUint8(p++);if(b<128){if(!status)throw Error('Invalid MIDI running status');p--;b=status}else if(b<240)status=b;
   if(b===255){const kind=v.getUint8(p++),n=variable();if(kind===81&&n===3)tempos.push({tick,us:(v.getUint8(p)<<16)|(v.getUint8(p+1)<<8)|v.getUint8(p+2)});p+=n;status=0}
   else if(b===240||b===247){const n=variable();p+=n;status=0}
   else {const type=b&240,a=v.getUint8(p++),vel=type===192||type===208?0:v.getUint8(p++);if(type===144&&(b&15)===9&&vel>0)events.push({tick,note:a})}
  }p=end;
 }
 tempos.sort((a,b)=>a.tick-b.tick);const segments=[];let tick=0,time=0,us=500000;for(const t of tempos){time+=(t.tick-tick)*us/division/1e6;tick=t.tick;us=t.us;segments.push({tick,time,us})}
 const seconds=t=>{let i=segments.length-1;while(i>0&&segments[i].tick>t)i--;const s=segments[i];return s.time+(t-s.tick)*s.us/division/1e6};
 const map={35:'kick',36:'kick',38:'snare',40:'snare',37:'snare',42:'hat',44:'hat',46:'hat',41:'floor',43:'floor',45:'tom3',47:'tom3',48:'tom2',50:'tom1',49:'crash1',52:'crash1',55:'crash2',57:'crash2',51:'ride',53:'ride',59:'ride'};
 const notes=events.filter(e=>map[e.note]).map(e=>({id:map[e.note],t:seconds(e.tick),articulation:e.note===46?'open':e.note===44?'pedal':null}));
 if(!notes.length)throw Error('No General MIDI drums on channel 10 were found.');const bars=[];const lastTick=events.reduce((max,e)=>Math.max(max,e.tick),0);for(let t=0;t<=lastTick;t+=division*4)bars.push(seconds(t));return validateChart({notes,bars});
}
function onsetEnvelope(samples,sampleRate){
 const rate=100,hop=Math.max(1,Math.round(sampleRate/rate)),n=Math.ceil(samples.length/hop),energy=new Float32Array(n),out=new Float32Array(n);let prev=0;
 for(let i=0;i<n;i++){let sum=0;for(let j=i*hop;j<Math.min(samples.length,(i+1)*hop);j++)sum+=samples[j]*samples[j];energy[i]=Math.sqrt(sum/hop);const delta=Math.max(0,energy[i]-prev);out[i]=delta;prev=energy[i]*.7+prev*.3}
 // Local normalization makes quiet passages comparable without amplifying silence.
 const prefix=new Float64Array(n+1);for(let i=0;i<n;i++)prefix[i+1]=prefix[i]+out[i];for(let i=0;i<n;i++){const a=Math.max(0,i-100),b=Math.min(n,i+101),mean=(prefix[b]-prefix[a])/(b-a);out[i]=energy[i]<.0001?0:Math.min(1,out[i]/Math.max(.00015,mean*4))}
 return {values:out,rate};
}
function align(values,rate,chart,progress=()=>{}){
 const all=[...new Set(chart.notes.map(n=>Math.round(n.t*1000)/1000))].sort((a,b)=>a-b);if(all.length<12||all.at(-1)-all[0]<8)throw Error('Use at least 12 distinct hits spanning eight seconds for automatic alignment.');
 const len=values.length/rate;if(len<8)throw Error('Recording is too short.');let signal=0;for(const x of values)signal+=x;if(signal/values.length<.002)throw Error('No usable rhythmic signal was detected.');
 const sample=all.filter((_,i)=>i%Math.max(1,Math.ceil(all.length/240))===0);
 const at=t=>{const i=Math.round(t*rate);return i<0||i>=values.length?0:values[i]};
 const strength=t=>Math.max(at(t-.02),at(t-.01),at(t),at(t+.01),at(t+.02));
 const broad=new Float32Array(values.length);for(let i=0;i<values.length;i++){let max=0;for(let j=Math.max(0,i-8);j<=Math.min(values.length-1,i+8);j++)max=Math.max(max,values[j]);broad[i]=max}const coarse=t=>{const i=Math.round(t*rate);return i<0||i>=broad.length?0:broad[i]};
 const score=(times,offset,stretch,wide=false)=>{let sum=0;for(const t of times){const x=t*stretch+offset;if(x<0||x>=len)sum-=.6;else sum+=wide?coarse(x):strength(x)-.25*(strength(x-.13)+strength(x+.13))}return sum/times.length};
 let candidates=[];for(let k=0;k<=200;k++){const stretch=.8+k*.002;let best={score:-Infinity};for(let offset=-15;offset<=30;offset+=.06){const s=score(sample,offset,stretch,true);if(s>best.score)best={offset,stretch,score:s}}candidates.push(best);if(k%20===0)progress(Math.round(k*.325))}
 candidates.sort((a,b)=>b.score-a.score);let best=candidates[0];
 best={score:-Infinity};for(const seed of candidates.slice(0,8))for(let st=seed.stretch-.002;st<=seed.stretch+.002;st+=.0004)for(let off=seed.offset-.1;off<=seed.offset+.1;off+=.01){const s=score(sample,off,st);if(s>best.score)best={offset:off,stretch:st,score:s}}
 // Competing beat phases at the winning tempo identify ambiguous repetitive charts.
 let competitor=-Infinity;for(let off=-15;off<=30;off+=.08){if(Math.abs(off-best.offset)<.25)continue;competitor=Math.max(competitor,score(sample,off,best.stretch))}
 const separation=Math.max(0,best.score-competitor);const points=[];let goodWindows=0,totalWindows=0;
 for(let start=all[0];start<=all.at(-1);start+=20){const window=all.filter(t=>t>=start&&t<start+20);if(window.length<6)continue;totalWindows++;let local={offset:best.offset,score:score(window,best.offset,best.stretch)};for(let off=best.offset-.18;off<=best.offset+.18;off+=.01){const s=score(window,off,best.stretch);if(s>local.score)local={offset:off,score:s}}
  const t=window[Math.floor(window.length/2)];if(local.score>.18)goodWindows++;points.push({chart:t,audio:t*best.stretch+local.offset});
 }
 const coverage=sample.filter(t=>strength(t*best.stretch+best.offset)>.45).length/sample.length;
 const confidence=Math.round(100*Math.min(coverage,Math.min(1,separation/.12),totalWindows?goodWindows/totalWindows:0));
 if(points.length<2)points.push({chart:all.at(-1),audio:all.at(-1)*best.stretch+best.offset});
 // Prevent local estimates from reversing time or producing implausible speed jumps.
 const anchors=[];for(const p of points){const prev=anchors.at(-1);if(!prev||(p.audio>prev.audio&&(p.audio-prev.audio)/(p.chart-prev.chart)>.6&&(p.audio-prev.audio)/(p.chart-prev.chart)<1.5))anchors.push(p)}
 progress(100);return {...best,anchors,confidence,coverage,separation,accepted:confidence>=60,method:'onset correlation with local timing anchors',version:1};
}
function mapTime(t,a){const points=a.anchors||[];if(points.length<2)return t*a.stretch+a.offset;let i=0;while(i<points.length-2&&t>points[i+1].chart)i++;const x=points[i],y=points[i+1];return x.audio+(t-x.chart)*(y.audio-x.audio)/(y.chart-x.chart)}
const api={validateChart,midiChart,onsetEnvelope,align,mapTime};if(typeof module!=='undefined')module.exports=api;root.SongAlignment=api;
})(typeof self!=='undefined'?self:globalThis);
