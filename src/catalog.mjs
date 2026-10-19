// Independent adapter for public structured notation and exact recording maps.
const GM={35:'kick',36:'kick',37:'snare',38:'snare',40:'snare',42:'hat',44:'hat',46:'hat',92:'hat',49:'crash1',57:'crash2',51:'ride',53:'ride',59:'ride',50:'tom1',48:'tom2',47:'tom3',41:'floor',43:'floor',45:'floor'};
export function compile(part,map,meta,trackIndex){
 if(part.songId!==meta.songId||part.revisionId!==meta.revisionId||map.revisionId!==meta.revisionId||map.songId!==meta.songId)throw Error('The recording and notation revisions do not match.');
 // Expand explicit simple repeats before matching recording measure timestamps.
 if((part.measures||[]).some(m=>m.repeatStart||m.repeat)){
  const expanded=[];let start=0,meter=[4,4];const source=part.measures.map(m=>{meter=m.signature||meter;return {...m,signature:meter}});
  source.forEach((m,i)=>{if(m.repeatStart)start=i;if(Object.keys(m).some(k=>/repeat/i.test(k)&&!['repeatStart','repeat'].includes(k)&&m[k]))throw Error('This chart uses unsupported repeat endings.');const clean=x=>{const {repeatStart,repeat,...rest}=x;return rest};expanded.push(clean(m));if(m.repeat){if(!Number.isInteger(m.repeat)||m.repeat<2||m.repeat>16)throw Error('Invalid repeat count.');for(let pass=1;pass<m.repeat;pass++)expanded.push(...source.slice(start,i+1).map(clean));start=i+1}});part={...part,measures:expanded};
 }
 const measures=part.measures||[];
 const silent=m=>(m.voices||[]).every(v=>(v.beats||[]).every(b=>b.rest||(b.notes||[]).every(n=>n.rest||n.tie)));
 const mappedCount=map.points?.length;
 if(mappedCount<measures.length&&measures.slice(mappedCount).every(silent))part={...part,measures:measures.slice(0,mappedCount)};
 if(map.problematic||map.status!=='done'||!Array.isArray(map.points)||map.points.length!==part.measures?.length)throw Error('This recording does not have a complete compatible timing map.');
 // Providers can collapse a silent introductory measure to zero recording time.
 // Remove only zero-length silent bars, preserving inherited meter and every played note.
 let points=map.points;const zeroBars=new Set(part.measures.flatMap((m,i)=>i+1<points.length&&points[i]===points[i+1]&&silent(m)?[i]:[]));
 if(zeroBars.size){let meter=[4,4];part={...part,measures:part.measures.map(m=>{meter=m.signature||meter;return {...m,signature:meter}}).filter((m,i)=>!zeroBars.has(i))};points=points.filter((t,i)=>!zeroBars.has(i));}
 if(!points.every(Number.isFinite)||points.some((t,i)=>i&&t<=points[i-1]))throw Error('This recording has an invalid timing map.');
 const spans=points.slice(1).map((t,i)=>t-points[i]),tail=[...spans.slice(-8)].sort((a,b)=>a-b),lastSpan=tail[Math.floor(tail.length/2)];
 let signature=[4,4];const notes=[],sections=[],warnings=new Set();
 part.measures.forEach((m,i)=>{
  if(Object.keys(m).some(k=>/repeat/i.test(k)&&m[k]))throw Error('This notation has repeats requiring a different expanded recording map.');
  signature=m.signature||signature;const length=signature[0]/signature[1],start=points[i],end=points[i+1]??start+lastSpan;
  if(m.marker?.text)sections.push({title:m.marker.text,time:Math.max(0,start),bar:i+1});
  for(const voice of m.voices||[]){let at=0;for(const beat of voice.beats||[]){
   const d=beat.duration;if(!Array.isArray(d)||!(d[0]>0&&d[1]>0))throw Error('Unsupported note duration.');
   if(!beat.rest)for(const n of beat.notes||[]){if(n.rest||n.tie)continue;const id=GM[n.fret];if(!id){warnings.add('Some auxiliary percussion is not mapped to this kit.');continue;}
    const grace=beat.graceNote==='beforeBeat'?d[0]/d[1]:0;const time=start+(end-start)*(at-grace)/length;if(time>=0)notes.push({id,t:+time.toFixed(6),articulation:[46,92].includes(n.fret)?'open':n.fret===44?'pedal':null,bar:i+1,fraction:at/length,duration:d[0]/d[1],ghost:!!n.ghost,accent:!!n.accentuated});
   }
   if(!beat.graceNote)at+=d[0]/d[1];
  }if(at>length+1e-7)throw Error('A notation voice exceeds its measure.');}
 });
 notes.sort((a,b)=>a.t-b.t);
 return {title:meta.title,duration:points.at(-1)+lastSpan,bars:points.filter(t=>t>=0),notes,sections,bpm:part.automations?.tempo?.[0]?.bpm||null,warnings:[...warnings],binding:{songId:meta.songId,revisionId:meta.revisionId,trackIndex,videoId:map.videoId,mapId:map.id},alignment:{offset:0,stretch:1}};
}
const cache=new Map();
async function json(url,ttl=300000){
 const c=cache.get(url);if(c&&c.until>Date.now())return c.data;
 const r=await fetch(url,{headers:{Accept:'application/json'},signal:AbortSignal.timeout(16000)});
 if(!r.ok)throw Error(r.status===403||r.status===401?'The song provider has restricted this request.':'The song provider is unavailable ('+r.status+').');
 let bytes=new Uint8Array(await r.arrayBuffer());
 if(bytes[0]===31&&bytes[1]===139)bytes=new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer());
 const data=JSON.parse(new TextDecoder().decode(bytes));
 if(cache.size>100)cache.delete(cache.keys().next().value);cache.set(url,{until:Date.now()+ttl,data});return data;
}
const API='https://www.songsterr.com/api';
function drum(t){return t.instrumentId===1024||/drum/i.test(t.instrument||'');}
export async function search(query){
 const params=new URLSearchParams({pattern:query,size:'24',inst:'drums'}),data=await json(API+'/songs?'+params,120000);
 const songs=Array.isArray(data)?data:data.songs||[];
 return songs.filter(s=>s.hasPlayer!==false&&!s.isBlocked&&!s.isRestricted&&!s.isJunk&&s.tracks?.some(drum)).map(s=>({id:s.songId,title:s.title,artist:typeof s.artist==='string'?s.artist:s.artist?.name||'',tracks:s.tracks.filter(drum).length}));
}
export async function metadata(id){const m=await json(API+'/meta/'+id);if(m.isBlocked||m.isRestricted||m.isJunk)throw Error('This song is unavailable from the provider.');return m;}
export async function song(id){
 const meta=await metadata(id),maps=await json(API+'/video-points/'+id+'/'+meta.revisionId+'/list');
 const tracks=meta.tracks.map((t,index)=>({...t,index})).filter(drum).map(t=>({index:t.index,name:t.name||'Drums',preferred:t.index===meta.popularTrackDrum}));
 const compatible=(Array.isArray(maps)?maps:[]).filter(m=>m.status==='done'&&!m.problematic&&m.revisionId===meta.revisionId&&/^[\w-]{11}$/.test(m.videoId)&&m.points?.length>=2);
 // Do not offer a recording whose measure map cannot cover the selected notation.
 const preferred=tracks.find(t=>t.preferred)||tracks[0];
 const part=preferred?await notation(meta,preferred.index):null;
 let unavailableReason='No compatible recording timing map is available.';
 const playable=part?compatible.filter(map=>{try{compile(part,map,meta,preferred.index);return true}catch(e){unavailableReason=e.message;return false}}).sort((a,b)=>Number(b.id)-Number(a.id)):[];
 const originals=playable.filter(m=>!m.feature||m.feature==='alternative');
 return {unavailableReason:playable.length?null:unavailableReason,id:meta.songId,title:meta.title,artist:typeof meta.artist==='string'?meta.artist:meta.artist?.name||'',revisionId:meta.revisionId,tracks,versions:originals.map(m=>({id:String(m.id),videoId:m.videoId,title:!m.feature?'Primary recording':'Alternate recording',kind:'original'})),backings:playable.filter(m=>m.feature==='backing').map(m=>({id:String(m.id),videoId:m.videoId,excludedTracks:m.tracks||[],title:'Backing recording',kind:'backing'}))};
}
async function notation(meta,index){
 // Public delivery hosts observed in the provider's current browser configuration.
 const host=meta.image?.endsWith('-stage')?'d3d3l6a6rcgkaf':'dqsljvtekg760';
 if(!meta.image)throw Error('The provider has no current notation file for this revision.');
 return json(`https://${host}.cloudfront.net/${meta.songId}/${meta.revisionId}/${meta.image}/${index}.json`);
}
export async function chart(id,track,mapId){
 const meta=await metadata(id);if(!meta.tracks?.[track]||!drum(meta.tracks[track]))throw Error('Choose a valid drum track.');
 const maps=await json(API+'/video-points/'+id+'/'+meta.revisionId+'/list'),map=maps.find(m=>String(m.id)===mapId);
 if(!map)throw Error('The recording map changed. Reopen this song.');
 if(map.feature==='backing'&&!map.tracks?.includes(track))throw Error('This backing track does not remove the selected drum track.');
 const part=await notation(meta,track);return compile(part,map,meta,track);
}
