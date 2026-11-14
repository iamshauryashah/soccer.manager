const assert=require('node:assert/strict');
const {harness}=require('./helpers/online-harness.cjs');
(async()=>{
 const h=await harness(),a=await h.join('SELLERS','Seller Rovers'),b=await h.join('BUYERS','Buyer United'),c=await h.join('BUYERS','Rival Town');
 let sa=await h.state('SELLERS',a),sb=await h.state('BUYERS',b);
 const original=sa.state.squad.find(p=>p.pos==='GK'),other=sb.state.squad.find(p=>p.id===original.id),cash=sa.state.cash;
 let r=await h.action('SELLERS',a,'sell',{id:original.id});assert.equal(r.status,200,JSON.stringify(r.data));assert.equal(r.data.state.cash,cash+Math.round(original.value*.8));assert.ok(!r.data.state.squad.some(p=>p.id===original.id));assert.ok(!r.data.state.lineup.includes(original.id));
 let listing=(await h.state('BUYERS',b)).state.market.find(p=>p.name===original.name);assert.ok(listing);assert.ok(listing.id<=-1e12);assert.equal(listing.auction.sourceClub,'Seller Rovers');assert.equal(listing.auction.resale,true);
 assert.deepEqual({...listing,id:original.id,auction:undefined},{...original,auction:undefined},'Only global identity changes; all player attributes stay intact');
 assert.equal((await h.action('SELLERS',a,'sell',{id:original.id})).status,404);assert.equal((await h.state('SELLERS',a)).state.cash,cash+Math.round(original.value*.8));
 // The same local ID in another world is a different player and gets a different market ID.
 r=await h.action('BUYERS',b,'sell',{id:other.id});assert.equal(r.status,200);const resales=r.data.state.market.filter(p=>p.auction.resale);assert.equal(resales.length,2);assert.equal(new Set(resales.map(p=>p.id)).size,2);
 // Two other managers bid; only the winner receives the sold player.
 const buyerCash=(await h.state('BUYERS',b)).state.cash;
 assert.equal((await h.action('BUYERS',b,'bid',{id:listing.id,amount:listing.value})).status,200);await h.flush();
 let sc=await h.state('BUYERS',c),next=sc.state.market.find(p=>p.id===listing.id).auction.nextBid;
 assert.equal((await h.action('BUYERS',c,'bid',{id:listing.id,amount:next})).status,200);await h.flush();assert.equal((await h.state('BUYERS',b)).state.cash,buyerCash);
 h.clock.now=h.market().data.listings[listing.id].endsAt+1;await h.market().alarm();await h.flush();
 sc=await h.state('BUYERS',c);assert.equal(sc.state.squad.filter(p=>p.id===listing.id).length,1);assert.equal(sc.state.squad.find(p=>p.id===listing.id).name,original.name);assert.ok(!(await h.state('SELLERS',a)).state.market.some(p=>p.id===listing.id));
 // A bought player can be sold again, keeping his global identity and current attributes.
 const resaleCash=sc.state.cash;
 r=await h.action('BUYERS',c,'sell',{id:listing.id});assert.equal(r.status,200,JSON.stringify(r.data));assert.equal(r.data.state.cash,resaleCash+Math.round(original.value*.8));
 listing=(await h.state('SELLERS',a)).state.market.find(p=>p.id===listing.id);assert.ok(listing);assert.equal(listing.auction.sourceClub,'Rival Town');assert.equal(listing.auction.status,'available');
 assert.equal((await h.action('SELLERS',a,'bid',{id:listing.id,amount:listing.value})).status,200);h.clock.now=h.market().data.listings[listing.id].endsAt+1;await h.market().alarm();await h.flush();
 assert.equal((await h.state('SELLERS',a)).state.squad.filter(p=>p.id===listing.id).length,1);
 await h.restartWorld('SELLERS');await h.restartMarket();assert.ok(!(await h.state('BUYERS',b)).state.market.some(p=>p.id===listing.id));
 // Existing formation and squad safeguards reject the sale before any payment/listing.
 sa=await h.state('SELLERS',a);const world=h.world('SELLERS'),career=world.world.careers[world.world.managers[0].id];career.squad=career.squad.slice(0,14);await world.persist();const protectedCash=career.cash;
 r=await h.action('SELLERS',a,'sell',{id:career.squad[0].id});assert.equal(r.status,400);assert.equal((await h.state('SELLERS',a)).state.cash,protectedCash);
 // A lost publish response survives restart and retries without a duplicate listing/payment.
 const lost=await harness(),key=await lost.join('RETRY','Retry FC'),start=await lost.state('RETRY',key),p=start.state.squad.find(p=>p.pos==='GK'),get=lost.env.TRANSFER_MARKET.get;
 let drop=true;lost.env.TRANSFER_MARKET.get=()=>({async fetch(req){const response=await get().fetch(req);if(drop&&new URL(req.url).pathname==='/resell'){drop=false;throw Error('Response lost');}return response;}});
 r=await lost.action('RETRY',key,'sell',{id:p.id});assert.equal(r.status,200);assert.equal(r.data.world.pendingSales,1);assert.ok(lost.storage('RETRY').alarm);
 lost.env.TRANSFER_MARKET.get=get;await lost.restartWorld('RETRY');await lost.world('RETRY').alarm();
 const recovered=await lost.state('RETRY',key);assert.equal(recovered.world.pendingSales,0);assert.equal(recovered.state.cash,start.state.cash+Math.round(p.value*.8));assert.equal(recovered.state.market.filter(x=>x.name===p.name).length,1);assert.equal(Object.keys(lost.market().data.saleReceipts).length,1);
 // Direct retries remain idempotent even after another club owns the listing.
 const receipt=Object.values(lost.market().data.saleReceipts)[0],globalId=receipt.playerId;
 lost.market().data.listings[globalId].status='sold';lost.market().data.listings[globalId].owner={world:'OTHER',manager:'another'};await lost.market().persist();
 const replay=await lost.market().fetch(new Request('https://market.internal/resell',{method:'POST',body:JSON.stringify({saleId:receipt.saleId,world:receipt.world,manager:receipt.manager,player:p,division:3,club:'Retry FC'})}));assert.equal(replay.status,200);assert.equal(lost.market().data.listings[globalId].status,'sold');
 console.log('PASS: sold players enter global auctions, one sale payment, preserved attributes, cross-world ID isolation, bidding/refunds, exclusive owner, resale of purchased players, roster guards, restart and lost-response recovery.');
})().catch(e=>{console.error(e);process.exit(1)});
