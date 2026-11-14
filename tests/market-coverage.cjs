const assert=require('node:assert/strict');
(async()=>{
 const {transferCatalog}=await import('../src/catalog.js'),{createGame}=await import('../src/engine.js');
 for(let season=1;season<=3;season++)for(let round=0;round<39;round++)for(const division of [1,2,3]){
  const pool=transferCatalog(season,round,division),ranges={1:[78,93],2:[66,84],3:[55,74]},[lo,hi]=ranges[division];assert.ok(pool.every(p=>p.ovr>=lo&&p.ovr<=hi));assert.ok(Math.max(...pool.map(p=>p.ovr))>=hi-1);assert.ok(Math.min(...pool.map(p=>p.ovr))<=lo+1);if(division===2)assert.ok(pool.filter(p=>p.ovr>=80).length>=3);
 }
 const solo=createGame();for(let i=0;i<20;i++)assert.ok(solo.generateMarket(2).filter(p=>p.ovr>=80).length>=3);
 const h=await require('./helpers/online-harness.cjs').harness(),a=await h.join('COVERAGE','Coverage FC'),b=await h.join('SLOWPOOL','Slow Club'),market=h.market();
 const call=async body=>{const r=await market.fetch(new Request('https://market.internal/catalog',{method:'POST',body:JSON.stringify(body)}));assert.equal(r.status,200);return (await r.json()).players;};
 const initial=await call({world:'COVERAGE',division:2});for(const p of initial)if(p.ovr>76)market.data.listings[p.id].status='sold';await market.persist();
 assert.ok((await call({world:'COVERAGE',division:2})).every(p=>p.ovr<=76));
 const active=(await call({world:'COVERAGE',division:2}))[0];const response=await market.fetch(new Request('https://market.internal/bid',{method:'POST',body:JSON.stringify({bidId:'protected-bid',playerId:active.id,world:'ACTIVE',manager:'active-manager',club:'Active Club',division:2,amount:active.value})}));assert.equal(response.status,200);const activeBefore=structuredClone(market.data.listings[active.id]);
 const recruit=(await h.state('COVERAGE',a)).state.squad[0];const sold=await market.fetch(new Request('https://market.internal/resell',{method:'POST',body:JSON.stringify({saleId:'keep-resale',world:'SELLER',manager:'seller',club:'Seller FC',division:2,player:recruit})}));assert.equal(sold.status,200);const resaleId=(await sold.json()).playerId,resaleBefore=structuredClone(market.data.listings[resaleId]);
 const refresh={world:'COVERAGE',division:2,refresh:{season:1,round:1}};let current=await call(refresh);
 let generated=current.filter(p=>!p.auction.resale&&p.id!==active.id);assert.equal(generated.length,12);assert.ok(generated.filter(p=>p.ovr>=80).length>=3);assert.deepEqual(market.data.listings[active.id],activeBefore);assert.deepEqual(market.data.listings[resaleId],resaleBefore);
 const ids=current.map(p=>p.id);assert.deepEqual((await call(refresh)).map(p=>p.id),ids,'Replaying a matchday does not rotate twice');assert.deepEqual((await call({world:'OTHER',division:2})).map(p=>p.id),ids,'All worlds share the refreshed pool');
 // Actual match advancement refreshes all leagues, not ordinary polling or a slow world's calendar.
 const seen=new Set(generated.map(p=>p.id));for(let round=0;round<7;round++){
  const actor=h.world('COVERAGE');Object.values(actor.world.careers).forEach(c=>c.squad.forEach(p=>p.injury=0));await actor.persist();
  const r=await h.action('COVERAGE',a,'ready',{ready:true});assert.equal(r.status,200,JSON.stringify(r.data));
  current=await call({world:'COVERAGE',division:2});generated=current.filter(p=>!p.auction.resale&&p.id!==active.id);assert.equal(generated.length,12);assert.ok(generated.filter(p=>p.ovr>=80).length>=3);if(round>0)assert.ok(generated.every(p=>!seen.has(p.id)));generated.forEach(p=>seen.add(p.id));
  assert.deepEqual((await h.state('COVERAGE',a)).state.market,(await h.state('SLOWPOOL',b)).state.market);assert.deepEqual(market.data.listings[active.id],activeBefore);assert.deepEqual(market.data.listings[resaleId],resaleBefore);
 }
 // Existing markets adopt a fresh balanced batch without changing active auctions or resale listings.
 delete market.data.coverageVersion;await market.persist();const beforeRestart=new Set(generated.map(p=>p.id));await h.restartMarket();const renewed=h.market(),after=await renewed.fetch(new Request('https://market.internal/catalog',{method:'POST',body:JSON.stringify({world:'COVERAGE',division:2})}));const refreshed=(await after.json()).players.filter(p=>!p.auction.resale&&p.id!==active.id);
 assert.equal(refreshed.length,12);assert.ok(refreshed.every(p=>!beforeRestart.has(p.id)));assert.ok(refreshed.filter(p=>p.ovr>=80).length>=3);assert.deepEqual(renewed.data.listings[active.id],activeBefore);assert.deepEqual(renewed.data.listings[resaleId],resaleBefore);
 console.log('PASS: balanced rating ranges, 80+ League 2 options, matchday pool renewal, globally shared listings, refresh replay safety, and preserved active bids/resales during migration.');
})().catch(e=>{console.error(e);process.exit(1)});
