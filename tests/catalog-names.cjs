const assert=require('node:assert/strict');
(async()=>{
 const {transferCatalog,catalogName,CATALOG_VERSION}=await import('../src/catalog.js');
 const {nameGroups}=await import('../src/catalog-rules.js');
 const base=new Set();for(const g of nameGroups)for(const f of g.first)for(const l of g.last)base.add((f+' '+l).normalize('NFKC').toLowerCase().replace(/[’‘]/g,"'"));
 const names=new Set();for(let i=0;i<base.size*3;i++){const name=catalogName(i);assert.ok(!names.has(name),name);names.add(name);}
 const first=transferCatalog(1,0,3);assert.ok(new Set(first.map(p=>p.name.split(' ')[1])).size>=8,'Opening market has varied initials');assert.deepEqual(first,transferCatalog(1,0,3));
 const h=await require('./helpers/online-harness.cjs').harness();const market=h.market();await market.loaded;
 const listings=Object.values(market.data.listings),available=listings[0],active=listings[1];
 const id=available.player.id,ovr=available.player.ovr,value=available.player.value;
 available.player.name='Legacy A. Name';available.player.catalogVersion=1;
 active.status='open';active.endsAt=h.clock.now+120000;active.high={bidId:'existing-bid',amount:123456};active.player.name='Keep A. Name';active.player.catalogVersion=1;
 await market.persist();const updated=await h.restartMarket();
 assert.equal(updated.data.listings[id].player.name,catalogName(-id-1));assert.equal(updated.data.listings[id].player.catalogVersion,CATALOG_VERSION);assert.equal(updated.data.listings[id].player.ovr,ovr);assert.equal(updated.data.listings[id].player.value,value);
 assert.equal(updated.data.listings[active.player.id].player.name,'Keep A. Name');assert.equal(updated.data.listings[active.player.id].high.amount,123456);
 await h.restartMarket();assert.equal(h.market().data.listings[id].player.name,catalogName(-id-1));
 console.log('PASS: varied transfer initials, unique full names across three complete name-pool cycles, stable identities, available-listing upgrade, active-bid preservation and restart persistence.');
})().catch(e=>{console.error(e);process.exit(1)});
