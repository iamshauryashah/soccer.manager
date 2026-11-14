const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
(async()=>{
 const {createGame}=await import('../src/engine.js');const g=createGame(),p=g.state.squad.find(p=>p.pos==='GK');
 p.ovr=70;p.potential=80;p.xp=8;p.injury=0;p.value=1;
 assert.equal(g.currentPlayerValue(p),630000);assert.equal(g.playerSalePrice(p),504000);
 p.value=90000000;assert.equal(g.playerSalePrice(p),504000,'Historical purchase/guide price is ignored');
 g.train('technical');assert.equal(p.ovr,71);assert.equal(g.playerSalePrice(p),536000,'Training increases the sale offer');
 p.fitness=1;p.morale=1;assert.equal(g.playerSalePrice(p),536000,'Base OVR sets valuation');
 g.state.division=2;assert.equal(g.currentPlayerValue(p),1210000);g.state.division=3;
 const before=g.state.cash;g.sell(p.id);assert.equal(g.state.cash-before,536000);
 // The dialog shows the exact offer that the sale pays.
 const nodes={},ctx={Math,console,setTimeout:()=>0,clearTimeout(){},localStorage:{getItem(){return null},setItem(){}},document:{querySelector(s){return nodes[s]??={innerHTML:'',textContent:'',className:'',showModal(){},close(){}}}}};vm.createContext(ctx);vm.runInContext(fs.readFileSync('public/solo.html','utf8').match(/<script>([\s\S]*?)<\/script>/)[1],ctx);
 vm.runInContext('var target=state.squad.find(p=>p.pos==="GK");target.ovr=71;target.value=1;askSell(target.id)',ctx);
 assert.ok(nodes['#modal'].innerHTML.includes('£536k'));assert.ok(nodes['#modal'].innerHTML.includes('71 OVR'));
 // The online authoritative sale and its resale listing use the same current valuation.
 const h=await require('./helpers/online-harness.cjs').harness(),key=await h.join('VALUES','Value United'),buyer=await h.join('VALBUY','Buyer Rovers'),world=h.world('VALUES'),career=world.world.careers[world.world.managers[0].id],t=career.squad.find(p=>p.pos==='GK');
 t.ovr=70;t.potential=80;t.xp=8;t.injury=0;t.value=987654321;await world.persist();
 assert.equal((await h.action('VALUES',key,'train',{type:'technical'})).status,200);
 const state=await h.state('VALUES',key),trained=state.state.squad.find(p=>p.id===t.id);assert.equal(trained.ovr,71);
 const r=await h.action('VALUES',key,'sell',{id:t.id});assert.equal(r.status,200);assert.equal(r.data.state.cash-state.state.cash,536000);
 const listed=(await h.state('VALBUY',buyer)).state.market.find(p=>p.name===t.name);assert.equal(listed.ovr,71);assert.equal(listed.value,670000);
 assert.equal((await h.action('VALBUY',buyer,'bid',{id:listed.id,amount:listed.value})).status,200);
 console.log('PASS: current OVR valuation, historical-price independence, training increase, league scaling, preview/payment agreement and correctly priced shared resale listing.');
})().catch(e=>{console.error(e);process.exit(1)});
