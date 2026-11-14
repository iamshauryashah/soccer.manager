const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {harness}=require('./helpers/online-harness.cjs');
(async()=>{
 const h=await harness(),a=await h.join('DELETE','Delete United'),b=await h.join('DELETE','Keep Rovers'),c=await h.join('DELETE','Keep City'),actor=h.world('DELETE');actor.now=()=>h.clock.now;
 const [ma,mb]=actor.world.managers,club=actor.world.leagues[3].find(c=>c.id===ma.clubId),clubId=ma.clubId,originalRecord={p:club.p,pts:club.pts,gf:club.gf,ga:club.ga};
 let before=await h.state('DELETE',a);const owned=before.state.market.find(p=>p.value<before.state.cash/2);assert.equal((await h.action('DELETE',a,'bid',{id:owned.id,amount:owned.value})).status,200);h.clock.now=h.market().data.listings[owned.id].endsAt+1;await h.market().alarm();await h.flush();
 before=await h.state('DELETE',a);const target=before.state.market.find(p=>p.value<before.state.cash),pendingPlayer=(await h.state('DELETE',b)).state.squad.find(p=>p.pos==='GK');
 await h.action('DELETE',a,'offerPlayer',{clubId:mb.clubId,id:pendingPlayer.id,amount:100});await h.action('DELETE',a,'bid',{id:target.id,amount:target.value});
 const bid=structuredClone(h.market().data.listings[target.id].high);await h.action('DELETE',a,'autoReady',{enabled:true,minutes:5});
 let r=await h.action('DELETE',a,'deleteClub',{confirmName:'wrong'});assert.equal(r.status,400);assert.equal(actor.world.managers.length,3);
 await h.action('DELETE',b,'ready',{ready:true});await h.action('DELETE',c,'ready',{ready:true});
 r=await h.action('DELETE',a,'deleteClub',{confirmName:'Delete United'});assert.equal(r.status,200,JSON.stringify(r.data));assert.equal(r.data.deleted,true);assert.notEqual(r.data.replacement,'Delete United');assert.equal(actor.world.managers.length,2);assert.ok(!actor.world.careers[ma.id]);assert.ok(!actor.world.managers.some(m=>m.id===ma.id));assert.equal(Object.values(actor.world.leagues).flat().length,60);assert.equal(actor.world.leagues[3].length,20);const keptClub=actor.world.leagues[3].find(c=>c.id===clubId);assert.deepEqual({p:keptClub.p,pts:keptClub.pts,gf:keptClub.gf,ga:keptClub.ga},originalRecord);
 assert.equal((await h.api('DELETE','state',a)).status,401);assert.equal((await h.api('DELETE','action',a,{action:'deleteClub',args:{confirmName:'Delete United'},season:1,round:0})).status,401);
 assert.equal(actor.world.directOffers[0].status,'cancelled');assert.equal(h.market().data.listings[owned.id].status,'retired');assert.ok(['available','withdrawn'].includes(h.market().data.listings[target.id].status));assert.equal(h.market().data.listings[target.id].high,null);
 const replay=await h.market().fetch(new Request('https://market.internal/bid',{method:'POST',body:JSON.stringify(bid)}));assert.equal(replay.status,410);
 // Removing the last unready manager does not strand everyone else on the matchday.
 assert.ok(actor.world.round===1||actor.world.deadline===h.clock.now);if(actor.world.round===0)await actor.alarm();assert.equal(actor.world.round,1);await h.flush();assert.equal(h.market().data.outbox.length,0);
 await h.restartMarket();await h.restartWorld('DELETE');assert.equal((await h.api('DELETE','state',a)).status,401);assert.equal((await h.state('DELETE',b)).world.managerCount,2);
 const replacementKey=await h.join('DELETE','Fresh United'),replacement=await h.state('DELETE',replacementKey);assert.equal(replacement.state.squad.length,18);assert.equal(replacement.world.autoReady.enabled,false);assert.notEqual(replacementKey,a);
 // An unavailable market does not prevent local deletion; persistent cleanup is retried.
 const retry=await harness(),key=await retry.join('CLEANUP','Cleanup FC'),other=await retry.join('CLEANUP','Staying FC'),w=retry.world('CLEANUP'),oldManager=w.world.managers[0],s=await retry.state('CLEANUP',key),p=s.state.market[0];
 await retry.action('CLEANUP',key,'bid',{id:p.id,amount:p.value});const live=await retry.state('CLEANUP',key),get=retry.env.TRANSFER_MARKET.get;
 retry.env.TRANSFER_MARKET.get=()=>({async fetch(){throw Error('Offline');}});
 r=await retry.api('CLEANUP','action',key,{action:'deleteClub',args:{confirmName:'Cleanup FC'},season:live.state.season,round:live.state.round});assert.equal(r.status,200);assert.equal(w.world.pendingClosures.length,1);assert.ok(retry.storage('CLEANUP').alarm);
 retry.env.TRANSFER_MARKET.get=get;await retry.restartWorld('CLEANUP');await retry.world('CLEANUP').alarm();assert.equal(retry.world('CLEANUP').world.pendingClosures.length,0);assert.equal(retry.market().data.listings[p.id].status,'available');assert.equal((await retry.state('CLEANUP',other)).world.managerCount,1);assert.ok(!retry.world('CLEANUP').world.careers[oldManager.id]);
 // Pending ownership sync is protected rather than orphaning another club's transfer.
 const guarded=await harness(),g=await guarded.join('GUARDED','Guard FC'),gw=guarded.world('GUARDED');gw.world.pendingOwnership=[{dealId:'wait',playerId:-1,world:'GUARDED',from:gw.world.managers[0].id,to:'other'}];await gw.persist();assert.equal((await guarded.action('GUARDED',g,'deleteClub',{confirmName:'Guard FC'})).status,409);
 console.log('PASS: exact-name deletion confirmation, immediate access revocation, career/offer/timer removal, bid cleanup, retired ownership, league continuity, restart recovery and replacement clubs.');
})().catch(e=>{console.error(e);process.exit(1)});
