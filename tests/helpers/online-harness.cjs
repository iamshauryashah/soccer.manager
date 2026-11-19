const assert=require('node:assert/strict');
exports.harness=async function(){const {default:worker,LeagueWorld,TransferMarket}=await import('../../src/worker.js');
class Storage{constructor(){this.map=new Map();this.alarm=null;}async get(k){return structuredClone(this.map.get(k));}async transaction(fn){const copy=new Map(this.map);await fn({put:async(k,v)=>{assert.ok(Buffer.byteLength(String(v))<128*1024);copy.set(k,structuredClone(v));},delete:async k=>copy.delete(k)});this.map=copy;}async setAlarm(t){this.alarm=t;}async deleteAlarm(){this.alarm=null;}}
const worlds=new Map(),stores=new Map(),tasks=new Set(),marketStorage=new Storage(),clock={now:Date.now()};let market;
const context=storage=>({storage,blockConcurrencyWhile:fn=>fn(),waitUntil(p){tasks.add(p);p.then(()=>tasks.delete(p),()=>tasks.delete(p));}});
const getWorld=code=>{if(!worlds.has(code)){const storage=stores.get(code)||new Storage();stores.set(code,storage);worlds.set(code,new LeagueWorld(context(storage),env));}return worlds.get(code);};
const getMarket=()=>{if(!market){market=new TransferMarket(context(marketStorage),env);market.now=()=>clock.now;}return market;};
let allowAutoReady=true;
const env={AUTH_SERVICE:{fetch:async()=>Response.json({allowed:allowAutoReady})},LEAGUE_WORLDS:{idFromName:x=>x,get:code=>({fetch:r=>getWorld(code).fetch(r)})},TRANSFER_MARKET:{idFromName:x=>x,get:()=>({fetch:r=>getMarket().fetch(r)})}};
async function api(code,endpoint,key,body,origin){const response=await worker.fetch(new Request('https://game.test/api/worlds/'+code+'/'+endpoint,{method:body?'POST':'GET',headers:{...(key?{Authorization:'Bearer '+key}:{}),...(body?{'Content-Type':'application/json'}:{}),...(origin?{Origin:origin}:{})},...(body?{body:JSON.stringify(body)}:{})}),env);return{status:response.status,data:await response.json()};}
async function state(code,key){const r=await api(code,'state',key);assert.equal(r.status,200,JSON.stringify(r.data));return r.data;}
async function action(code,key,action,args={},snapshot){const s=snapshot||await state(code,key);return api(code,'action',key,{action,args,season:s.state.season,round:s.state.round});}
async function join(code,name){const r=await api(code,'join',null,{clubName:name});assert.equal(r.status,201,JSON.stringify(r.data));return r.data.managerKey;}
async function flush(){for(let i=0;i<20;i++){if(tasks.size)await Promise.all([...tasks]);await getMarket().flushOutbox();if(!tasks.size&&!getMarket().data.outbox.length)break;}}
return{api,state,action,join,flush,clock,env,setAutoReadyAccess:value=>{allowAutoReady=value;},world:getWorld,market:getMarket,storage:code=>stores.get(code),async restartWorld(code){worlds.delete(code);const actor=getWorld(code);await actor.loaded;return actor;},async restartMarket(){market=null;const actor=getMarket();await actor.loaded;return actor;}};
};
