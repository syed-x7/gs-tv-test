/* GhostScreens TV test: serves the test clip from IndexedDB with Range support. */
var served=0;
self.addEventListener('install',function(){self.skipWaiting();});
self.addEventListener('activate',function(e){e.waitUntil(self.clients.claim());});
self.addEventListener('message',function(e){if(e.data&&e.data.type==='count'&&e.ports[0])e.ports[0].postMessage(served);});
function getClip(){
  return new Promise(function(res,rej){
    var req=indexedDB.open('gs-tv-test',1);
    req.onupgradeneeded=function(){req.result.createObjectStore('a');};
    req.onerror=function(){rej(req.error);};
    req.onsuccess=function(){
      var g=req.result.transaction('a').objectStore('a').get('clip');
      g.onsuccess=function(){g.result?res(g.result):rej('clip not stored');};
      g.onerror=function(){rej(g.error);};
    };
  });
}
self.addEventListener('fetch',function(event){
  var url=new URL(event.request.url);
  if(!/\/sw-media\/clip\.mp4$/.test(url.pathname))return;
  served++;
  event.respondWith(getClip().then(function(blob){
    var size=blob.size, range=event.request.headers.get('range'), type='video/mp4';
    var m=range&&/bytes=(\d*)-(\d*)/.exec(range);
    if(m&&(m[1]!==''||m[2]!=='')){
      var start,end;
      if(m[1]===''){start=Math.max(0,size-parseInt(m[2],10));end=size-1;}
      else{start=parseInt(m[1],10);end=m[2]===''?size-1:Math.min(parseInt(m[2],10),size-1);}
      if(start>=size)return new Response(null,{status:416,headers:{'Content-Range':'bytes */'+size}});
      return new Response(blob.slice(start,end+1,type),{status:206,headers:{
        'Content-Type':type,'Content-Length':String(end-start+1),
        'Content-Range':'bytes '+start+'-'+end+'/'+size,'Accept-Ranges':'bytes'}});
    }
    return new Response(blob,{status:200,headers:{'Content-Type':type,'Content-Length':String(size),'Accept-Ranges':'bytes'}});
  }).catch(function(e){return new Response('sw error: '+e,{status:500});}));
});
