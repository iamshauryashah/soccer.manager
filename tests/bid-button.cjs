const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
(async()=>{
 const h=await require('./helpers/online-harness.cjs').harness(),code='BID-BUTTON',key=await h.join(code,'Button United'),observer=await h.join('BID-WATCH','Observer FC'),snapshot=await h.state(code,key),nodes={},calls=[];
 const ctx={Math,Date,console,setTimeout:()=>0,clearTimeout(){},setInterval(){},localStorage:{setItem(){},removeItem(){}},onlineSnapshot:snapshot,onlineProfile:{code,key},document:{querySelector(s){return nodes[s]??={innerHTML:'',textContent:'',value:'',className:'',open:false,showModal(){this.open=true},close(){this.open=false}};}}};ctx.window=ctx;
 ctx.onlineRequest=async(endpoint,body)=>{calls.push(endpoint);const r=await h.api(code,endpoint,key,body);if(r.status>=400)throw Error(r.data.error);return r.data;};
 vm.createContext(ctx);vm.runInContext(fs.readFileSync('public/online-game.js','utf8'),ctx);
 const player=snapshot.state.market.find(p=>p.value<snapshot.state.cash),before=snapshot.state.cash;
 ctx.onlineSnapshot.world.capabilities=undefined;ctx.reviewTransferBid(player.id);assert.match(nodes['#modal'].innerHTML,/Place bid/);ctx.document.querySelector('#transfer-bid-amount').value=String(player.value);
 await ctx.confirmTransferBid(player.id);
 assert.equal(calls[0],'bid');assert.equal(nodes['#modal'].open,false);
 const current=await h.state(code,key);assert.equal(current.state.cash,before-player.value);assert.equal(current.state.auctionHolds[player.id].status,'leading');
 // The dedicated route still enforces authentication and rejects insufficient bids.
 assert.equal((await h.api(code,'bid',null,{args:{id:player.id,amount:player.value},season:1,round:0})).status,401);
 assert.equal((await h.api(code,'bid',key,{args:{id:player.id,amount:1},season:1,round:0})).status,400);
 console.log('PASS: Place bid button reaches dedicated route, reserves funds, leads auction, closes dialog, and accepts snapshots without optional capability metadata.');
})().catch(e=>{console.error(e);process.exit(1)});
