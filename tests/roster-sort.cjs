const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const script=fs.readFileSync('public/solo.html','utf8').match(/<script>([\s\S]*?)<\/script>/)[1];
function solo(memory={}){const nodes={},ctx={Math,console,setTimeout:()=>0,clearTimeout(){},localStorage:{getItem:k=>memory[k]??null,setItem(k,v){memory[k]=v}},document:{querySelector(s){return nodes[s]??={innerHTML:'',textContent:'',className:'',open:false,showModal(){this.open=true},close(){this.open=false}}}}};vm.createContext(ctx);vm.runInContext(script,ctx);return {ctx,nodes,run:s=>vm.runInContext(s,ctx),memory};}
(async()=>{
 const g=solo();g.run('state.squad.forEach((p,i)=>{p.ovr=50+i;p.potential=90;p.fitness=100;p.injury=0});state.squad[0].ovr=90;state.squad[1].ovr=70;state.squad[2].ovr=70;save()');
 const ids=Array.from(g.run('state.squad.map(p=>p.id)')),lineup=Array.from(g.run('state.lineup'));
 assert.ok(g.run('squad()').includes('<th>Potential</th>'));assert.ok(g.run('squad()').includes('<span class="rating">90</span>'));
 g.run('sortSquad()');const ratings=Array.from(g.run('rosterPlayers().map(p=>p.ovr)'));assert.deepEqual(ratings,[...ratings].sort((a,b)=>b-a));assert.deepEqual(Array.from(g.run('state.squad.map(p=>p.id)')),ids);assert.deepEqual(Array.from(g.run('state.lineup')),lineup);
 const sortedIds=Array.from(g.run('rosterPlayers().map(p=>p.id)'));assert.ok(sortedIds.indexOf(ids[1])<sortedIds.indexOf(ids[2]),'Equal ratings keep the existing order');assert.equal(g.memory['touchline-squad-sort'],'overall-desc');
 const reload=solo(g.memory);assert.equal(reload.run('squadSort'),'overall-desc');assert.match(reload.run('squad()'),/aria-pressed="true"/);
 const {createGame}=await import('../src/engine.js');const state=createGame().state,snapshot={revision:1,state,world:{code:'ROSTER',managerCount:0,readyCount:0,ready:false,round:0,managers:[]}},nodes={},saved={};
 const ctx={Math,Date,console,setTimeout:()=>0,clearTimeout(){},setInterval(){},onlineSnapshot:snapshot,localStorage:{getItem:k=>saved[k]??null,setItem(k,v){saved[k]=v}},document:{querySelector(s){return nodes[s]??={innerHTML:'',textContent:'',className:'',value:'',open:false,showModal(){this.open=true},close(){this.open=false}}}}};ctx.window=ctx;vm.createContext(ctx);vm.runInContext(fs.readFileSync('public/online-game.js','utf8'),ctx);
 vm.runInContext("switchTab('Squad');sortSquad()",ctx);assert.match(nodes['#content'].innerHTML,/<th>Potential<\/th>/);assert.match(nodes['#content'].innerHTML,/Current OVR ↓/);
 const next=structuredClone(snapshot);next.revision=2;next.state.squad[0].ovr=99;ctx.applyOnlineSnapshot(next,false);assert.equal(vm.runInContext('rosterPlayers()[0].ovr',ctx),99);assert.match(nodes['#content'].innerHTML,/aria-pressed="true"/);
 console.log('PASS: roster potential column, highest-current-OVR sorting, stable ties, unchanged lineup/roster order, saved display preference and online refreshes.');
})().catch(e=>{console.error(e);process.exit(1)});
