import {search,song,chart} from './catalog.mjs';
export default {async fetch(request){
 const u=new URL(request.url);
 if(request.method!=='GET'&&request.method!=='HEAD')return new Response('Method not allowed',{status:405});
 try{
  let result;
  if(u.pathname==='/api/search'){const q=(u.searchParams.get('q')||'').slice(0,160);result=await search(q);}
  else if(/^\/api\/songs\/\d+$/.test(u.pathname))result=await song(Number(u.pathname.split('/').at(-1)));
  else if(/^\/api\/charts\/\d+\/\d+\/\d+$/.test(u.pathname)){const parts=u.pathname.split('/');result=await chart(Number(parts[3]),Number(parts[4]),parts[5]);}
  else if(u.pathname.startsWith('/api/'))return Response.json({error:'Not found'},{status:404});
  else return serveAsset(u.pathname,request.method);
  return Response.json(result,{headers:{'Cache-Control':'private, max-age=60'}});
 }catch(e){return Response.json({error:e.message||'Song data could not load. Try again.'},{status:502,headers:{'Cache-Control':'no-store'}});}
}};
