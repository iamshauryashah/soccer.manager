import {transferCatalog,catalogName,CATALOG_VERSION} from './catalog.js';
const WINDOW=120000,EXTENSION=30000,reply=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
const error=(status,message)=>Object.assign(new Error(message),{status});
const managerKey=(world,manager)=>JSON.stringify([world,manager]);
const increment=amount=>Math.max(10000,Math.ceil(amount*.05/1000)*1000);
export class TransferMarket{
 constructor(ctx,env){this.ctx=ctx;this.env=env;this.data=null;this.parts=0;this.queue=Promise.resolve();this.delivering=false;this.now=()=>Date.now();this.loaded=ctx.blockConcurrencyWhile(async()=>{this.parts=await ctx.storage.get('parts')||0;if(this.parts){let text='';for(let i=0;i<this.parts;i++)text+=await ctx.storage.get('part:'+i);this.data=JSON.parse(text);}else{this.data={schema:1,coverageVersion:1,next:{1:0,2:0,3:0},listings:{},receipts:{},outbox:[]};this.refill();await this.persist();}let renamed=false;for(const listing of Object.values(this.data.listings)){if(!listing.resale&&listing.status==='available'&&(listing.player.catalogVersion||1)<CATALOG_VERSION){listing.player.name=catalogName(-listing.player.id-1);listing.player.catalogVersion=CATALOG_VERSION;renamed=true;}}if(this.data.coverageVersion!==1){for(const division of [1,2,3])this.rotateAvailable(division);this.data.coverageVersion=1;renamed=true;}if(renamed)await this.persist();this.committed=structuredClone(this.data);});}
 addListing(division){const index=this.data.next[division]++,phase=Math.floor(index/12),player=transferCatalog(Math.floor(phase/39)+1,phase%39,division)[index%12];this.data.listings[player.id]={player,division,status:'available',high:null,endsAt:null};}
 refill(){for(const division of [1,2,3]){let count=Object.values(this.data.listings).filter(p=>p.division===division&&['available','interest','open','settling'].includes(p.status)).length;while(count++<12)this.addListing(division);}}
 rotateAvailable(division){
  for(const listing of Object.values(this.data.listings))if(listing.division===division&&listing.status==='available'&&!listing.resale)listing.status='withdrawn';
  // A complete new batch guarantees coverage even if purchases consumed part of the previous batch.
  this.data.next[division]=Math.ceil(this.data.next[division]/12)*12;
  for(let i=0;i<12;i++)this.addListing(division);
 }

 async persist(){const text=JSON.stringify(this.data),parts=Math.ceil(text.length/24000),old=this.parts;await this.ctx.storage.transaction(async tx=>{for(let i=0;i<parts;i++)await tx.put('part:'+i,text.slice(i*24000,(i+1)*24000));await tx.put('parts',parts);for(let i=parts;i<old;i++)await tx.delete('part:'+i);});this.parts=parts;this.committed=structuredClone(this.data);await this.arm();}
 async arm(){const deadlines=Object.values(this.data.listings).filter(p=>['interest','open'].includes(p.status)).map(p=>p.endsAt);if(this.data.outbox.length)deadlines.push(this.now()+5000);if(deadlines.length)await this.ctx.storage.setAlarm(Math.min(...deadlines));else await this.ctx.storage.deleteAlarm();}
 enqueue(fn){const task=this.queue.then(async()=>{await this.loaded;try{return await fn();}catch(e){this.data=structuredClone(this.committed);throw e;}});this.queue=task.catch(()=>{});return task;}
 settle(listing){if(listing.status==='settling')return;listing.status='settling';this.data.outbox.push({id:'award:'+listing.high.bidId,type:'award',...listing.high,player:listing.player});}
 resolveInterest(listing){
  if(listing.status!=='interest')return;
  const answers=Object.values(listing.invites||{});
  if(answers.some(i=>i.answer==='yes')){listing.status='open';listing.endsAt=this.now()+WINDOW;}
  else if(!answers.some(i=>i.answer==='pending'))this.settle(listing);
 }
 closeDue(){let changed=false;for(const listing of Object.values(this.data.listings)){if(['interest','open'].includes(listing.status)&&listing.endsAt<=this.now()){this.settle(listing);changed=true;}}return changed;}
 registerManagers(world,division,managers){
  this.data.managers??={};let changed=false;
  const active=new Set(managers.map(m=>managerKey(world,m.id)));
  for(const [key,m] of Object.entries(this.data.managers))if(m.world===world&&m.division===division&&!active.has(key)){delete this.data.managers[key];changed=true;}
  for(const m of managers){const key=managerKey(world,m.id);if(this.data.closedManagers?.[key])continue;const entry={world,manager:m.id,club:m.club,division};if(JSON.stringify(this.data.managers[key])!==JSON.stringify(entry)){this.data.managers[key]=entry;changed=true;}}
  if(changed)for(const listing of Object.values(this.data.listings)){if(!['interest','open'].includes(listing.status))continue;for(const [key,invite]of Object.entries(listing.invites||{}))if(invite.world===world&&invite.answer==='pending'&&(!this.data.managers[key]||this.data.managers[key].division!==listing.division))invite.answer='no';this.resolveInterest(listing);}
  return changed;
 }

 release(bid){if(bid)this.data.outbox.push({...bid,id:'release:'+bid.bidId,type:'release'});}
 view(division,world,manager){return Object.values(this.data.listings).filter(p=>p.division===division&&['available','interest','open'].includes(p.status)).map(p=>({...p.player,auction:{invitedManagers:Object.values(p.invites||{}).filter(i=>i.world===world&&i.answer==='pending').map(i=>i.manager),interestPending:Object.values(p.invites||{}).filter(i=>i.answer==='pending').length,interestConfirmed:Object.values(p.invites||{}).filter(i=>i.answer==='yes').length,resale:!!p.resale,sourceClub:p.sourceClub||null,status:p.status,highBid:p.high?.amount||0,nextBid:p.high?p.high.amount+increment(p.high.amount):p.player.value,endsAt:p.endsAt,leadingClub:p.high?.club||null,leadingWorld:p.high?.world||null,leadingManager:p.high?.manager||null,isLeading:!!p.high&&p.high.world===world&&p.high.manager===manager}}));}
 async fetch(request){try{const result=await this.enqueue(async()=>{let body;try{body=await request.json();}catch{throw error(400,'Invalid market request.');}if(!body||typeof body!=='object')throw error(400,'Invalid market request.');if(this.closeDue())await this.persist();const route=new URL(request.url).pathname;
 if(route==='/close-manager'){
  if(typeof body.world!=='string'||typeof body.manager!=='string'||!body.world||!body.manager)throw error(400,'Invalid club closure.');
  this.data.closedManagers??={};const id=JSON.stringify([body.world,body.manager]);
  if(this.data.closedManagers[id])return{closed:true};this.data.closedManagers[id]=true;if(this.data.managers)delete this.data.managers[id];
  for(const listing of Object.values(this.data.listings)){
   if(listing.high?.world===body.world&&listing.high?.manager===body.manager&&['interest','open','settling'].includes(listing.status)){listing.status='available';listing.high=null;listing.endsAt=null;delete listing.invites;}
   if(listing.status==='sold'&&listing.owner?.world===body.world&&listing.owner?.manager===body.manager){listing.status='retired';delete listing.owner;listing.high=null;listing.endsAt=null;}
  }
  for(const listing of Object.values(this.data.listings)){const invite=listing.invites?.[id];if(invite?.answer==='pending')invite.answer='no';this.resolveInterest(listing);}
  this.data.outbox=this.data.outbox.filter(e=>e.world!==body.world||e.manager!==body.manager);this.refill();await this.persist();return{closed:true};
 }
 const closed=manager=>this.data.closedManagers?.[JSON.stringify([body.world,manager])];
 if((['/bid','/resell','/interest'].includes(route)&&closed(body.manager))||(route==='/reassign'&&(closed(body.from)||closed(body.to))))throw error(410,'This club has been deleted.');
 if(route==='/catalog'){
  if(![1,2,3].includes(body.division))throw error(400,'Unknown division.');
  if(Array.isArray(body.managers)&&this.registerManagers(body.world,body.division,body.managers))await this.persist();
  if(body.refresh){
   const {season,round}=body.refresh;if(!Number.isSafeInteger(season)||season<1||!Number.isInteger(round)||round<0||round>38||typeof body.world!=='string')throw error(400,'Invalid market refresh.');
   this.data.refreshes??={};const key=JSON.stringify([body.world,body.division]),day=(season-1)*39+round;
   if(day>(this.data.refreshes[key]??-1)){this.rotateAvailable(body.division);this.data.refreshes[key]=day;await this.persist();}
  }

  return{players:this.view(body.division,body.world,body.manager)};
 }
 if(route==='/interest'){
  const listing=this.data.listings[body.playerId],key=managerKey(body.world,body.manager),invite=listing?.invites?.[key];
  if(invite&&typeof body.interested==='boolean'&&invite.answer===(body.interested?'yes':'no'))return{recorded:true,status:listing.status};
  if(!listing||!['interest','open'].includes(listing.status))throw error(409,'This interest check has finished.');
  if(!invite||listing.division!==body.division)throw error(403,'This player is not waiting for your response.');
  if(typeof body.interested!=='boolean')throw error(400,'Choose interested or not interested.');
  const answer=body.interested?'yes':'no';if(invite.answer!=='pending'){if(invite.answer===answer)return{recorded:true,status:listing.status};throw error(409,'Your interest response has already been recorded.');}
  invite.answer=answer;this.resolveInterest(listing);await this.persist();return{recorded:true,status:listing.status};
 }
 if(route==='/reassign'){
  this.data.directReceipts??={};const saved=this.data.directReceipts[body.dealId];
  if(saved){if(saved.playerId!==body.playerId||saved.world!==body.world||saved.from!==body.from||saved.to!==body.to)throw error(409,'Transfer identity conflict.');return saved;}
  if(typeof body.dealId!=='string'||!body.dealId||!body.world||!body.from||!body.to)throw error(400,'Invalid direct transfer.');
  const listing=this.data.listings[body.playerId];
  if(listing?.status==='settling'&&listing.high?.world===body.world&&listing.high?.manager===body.from)throw error(503,'Previous ownership is still settling.');
  if(listing?.status!=='sold'||listing.owner?.world!==body.world||listing.owner?.manager!==body.from)throw error(409,'The selling club does not own this market player.');
  listing.owner={world:body.world,manager:body.to,club:body.club,amount:body.amount};
  const receipt={dealId:body.dealId,playerId:body.playerId,world:body.world,from:body.from,to:body.to};this.data.directReceipts[body.dealId]=receipt;await this.persist();return receipt;
 }
 if(route==='/resell'){
  this.data.saleReceipts??={};const saved=this.data.saleReceipts[body.saleId];
  if(saved){if(saved.world!==body.world||saved.manager!==body.manager||saved.originalId!==body.player?.id)throw error(409,'Sale identity conflict.');return saved;}
  const player=structuredClone(body.player);
  if(typeof body.saleId!=='string'||!body.saleId||!body.world||!body.manager||![1,2,3].includes(body.division)||!player||!Number.isSafeInteger(player.id)||!Number.isSafeInteger(player.value)||player.value<=0)throw error(400,'Invalid player sale.');
  let id=player.id;
  if(id<0){const previous=this.data.listings[id];if(previous?.status==='settling'&&previous.high?.world===body.world&&previous.high?.manager===body.manager)throw error(503,'Player ownership is still settling.');if(previous?.status!=='sold'||previous.owner?.world!==body.world||previous.owner?.manager!==body.manager)throw error(409,'Only the owning club can resell this player.');}
  else{const sequence=(this.data.nextResale||0)+1;if(sequence>=1e12)throw error(503,'Resale catalog limit reached.');this.data.nextResale=sequence;id=-(1e12+sequence);}
  player.id=id;this.data.listings[id]={player,division:body.division,status:'available',high:null,endsAt:null,resale:true,sourceClub:body.club};
  const receipt={saleId:body.saleId,world:body.world,manager:body.manager,originalId:body.player.id,playerId:id};this.data.saleReceipts[body.saleId]=receipt;
  await this.persist();return receipt;
 }
 if(route==='/bid'){const receipt=this.data.receipts[body.bidId];if(receipt){if(receipt.world!==body.world||receipt.manager!==body.manager||receipt.playerId!==body.playerId||receipt.amount!==body.amount)throw error(409,'Bid identity conflict.');return{accepted:true,...receipt};}
 const listing=this.data.listings[body.playerId];if(!listing||!['available','interest','open'].includes(listing.status))throw error(409,'This player is already sold or their auction is settling.');if(listing.division!==body.division)throw error(403,'This player is not available in your league.');const minimum=listing.high?listing.high.amount+increment(listing.high.amount):listing.player.value;if(!Number.isSafeInteger(body.amount)||body.amount<minimum)throw error(409,'The next bid must be at least £'+minimum.toLocaleString('en-GB')+'.');if(typeof body.bidId!=='string'||body.bidId.length>80||!body.world||!body.manager)throw error(400,'Invalid bid.');
 const first=!listing.high,previous=listing.high,key=managerKey(body.world,body.manager);
 const bid={bidId:body.bidId,playerId:body.playerId,amount:body.amount,world:body.world,manager:body.manager,club:body.club,division:body.division};this.release(previous);listing.high=bid;
 if(first&&!body.interestCheck){listing.status='open';listing.endsAt=this.now()+WINDOW;}
 else if(first){listing.status='interest';listing.endsAt=this.now()+WINDOW;listing.invites={};for(const [id,m]of Object.entries(this.data.managers||{}))if(m.division===body.division&&id!==key&&!this.data.closedManagers?.[id])listing.invites[id]={world:m.world,manager:m.manager,answer:'pending'};this.resolveInterest(listing);}
 else if(listing.status==='interest'){
  if(previous.world!==body.world||previous.manager!==body.manager){listing.invites??={};listing.invites[key]={world:body.world,manager:body.manager,answer:'yes'};this.resolveInterest(listing);}
 }else{if(listing.invites?.[key])listing.invites[key].answer='yes';listing.endsAt=Math.max(listing.endsAt,this.now()+EXTENSION);}
 this.data.receipts[bid.bidId]={...bid,endsAt:listing.endsAt};await this.persist();return{accepted:true,...this.data.receipts[bid.bidId]};}

 throw error(404,'Market endpoint not found.');});this.scheduleDelivery();return reply(result);}catch(e){this.scheduleDelivery();return reply({error:e.status?e.message:'The transfer market could not save that request.'},e.status||503);}}
 scheduleDelivery(){if(this.ctx.waitUntil)this.ctx.waitUntil(this.flushOutbox().catch(()=>{}));}
 async flushOutbox(){if(this.delivering)return;this.delivering=true;try{await this.loaded;for(let attempts=0;attempts<100;attempts++){const event=await this.enqueue(()=>structuredClone(this.data.outbox[0]));if(!event)break;let result;try{const stub=this.env.LEAGUE_WORLDS.get(this.env.LEAGUE_WORLDS.idFromName(event.world)),response=await stub.fetch(new Request('https://league.internal/internal/market',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(event)}));if(!response.ok)break;result=await response.json();}catch{break;}
 await this.enqueue(async()=>{if(!this.data.outbox.some(e=>e.id===event.id))return;this.data.outbox=this.data.outbox.filter(e=>e.id!==event.id);if(event.type==='award'){const listing=this.data.listings[event.playerId];if(listing?.high?.bidId===event.bidId){if(result.applied){listing.status='sold';listing.owner={world:event.world,manager:event.manager,club:event.club,amount:event.amount};}else{listing.status='available';listing.high=null;listing.endsAt=null;delete listing.invites;this.release(event);}this.refill();}}await this.persist();});}
 }finally{this.delivering=false;await this.enqueue(()=>this.arm());}}
 async alarm(){await this.enqueue(async()=>{this.closeDue();await this.persist();});await this.flushOutbox();}
}
