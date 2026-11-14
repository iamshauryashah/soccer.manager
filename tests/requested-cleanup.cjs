const assert=require('node:assert/strict');
(async()=>{
 const {harness}=require('./helpers/online-harness.cjs'),{applyRequestedCleanup}=await import('../src/club-deletion.js');
 const h=await harness(),keys=[];for(const name of ['Temporary George','Temporary Lanesra','Lanesra Club','SuperNS','Die Club'])keys.push(await h.join('SNS123',name));
 const actor=h.world('SNS123'),[george,lanesra,...protectedManagers]=actor.world.managers;
 const clubs=Object.values(actor.world.leagues).flat();clubs.find(c=>c.id===george.clubId).name='George';clubs.find(c=>c.id===lanesra.clubId).name='Lanesra';
 const protectedBefore=protectedManagers.map(m=>({manager:structuredClone(m),career:structuredClone(actor.world.careers[m.id]),club:structuredClone(clubs.find(c=>c.id===m.clubId))}));
 actor.now=()=>Date.parse('2026-11-14T21:20:00Z');await actor.persist();
 const original=structuredClone(actor.world);const elsewhere=structuredClone(original);elsewhere.code='OTHER';assert.equal(applyRequestedCleanup(elsewhere,actor.now()),false);assert.deepEqual(elsewhere.careers,original.careers);
 const expired=structuredClone(original);assert.equal(applyRequestedCleanup(expired,Date.parse('2026-11-15T00:00:00Z')),false);assert.deepEqual(expired,original);
 const pending=structuredClone(original);pending.pendingSales=[{manager:george.id}];assert.equal(applyRequestedCleanup(pending,actor.now()),false);assert.equal(pending.managers.length,5);
 await actor.requestedCleanup();assert.equal(actor.world.managers.length,3);assert.ok(!actor.world.careers[george.id]);assert.ok(!actor.world.careers[lanesra.id]);
 for(const expected of protectedBefore){assert.deepEqual(actor.world.managers.find(m=>m.id===expected.manager.id),expected.manager);assert.deepEqual(actor.world.careers[expected.manager.id],expected.career);assert.deepEqual(Object.values(actor.world.leagues).flat().find(c=>c.id===expected.club.id),expected.club);}
 assert.equal(Object.values(actor.world.leagues).flat().length,60);assert.equal((await h.api('SNS123','state',keys[0])).status,401);assert.equal((await h.api('SNS123','state',keys[1])).status,401);
 assert.equal((await h.state('SNS123',keys[2])).state.clubs[0].name,'Lanesra Club');
 const reloaded=await h.restartWorld('SNS123');assert.equal(reloaded.world.managers.length,3);
 // A later club using a deleted name is outside the already-completed request.
 const fresh=await h.join('SNS123','George');assert.equal((await h.state('SNS123',fresh)).state.clubs[0].name,'George');assert.equal(reloaded.world.managers.length,4);
 console.log('PASS: only exact George and Lanesra in SNS123 removed atomically; Lanesra Club and other managers/careers unchanged; replay, pending-transfer and expiry guards.');
})().catch(e=>{console.error(e);process.exit(1)});
