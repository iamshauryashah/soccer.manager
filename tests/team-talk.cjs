const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const code=fs.readFileSync('public/solo.html','utf8').match(/<script>([\s\S]*?)<\/script>/)[1];
function game(saved=null){const elements={},storage={value:saved};const ctx={Math,console,setTimeout:()=>0,clearTimeout(){},localStorage:{getItem(){return storage.value},setItem(k,v){storage.value=v}},document:{querySelector(s){return elements[s]??={innerHTML:'',textContent:'',showModal(){},close(){}}}}};vm.createContext(ctx);vm.runInContext(code,ctx);return {ctx,storage,run:s=>vm.runInContext(s,ctx)};}
let g=game();
g.run(`state.squad.forEach((p,i)=>p.morale=[40,60,65,70,75,79,80,90,100][i%9]);`);
let before=g.run('state.squad.map(p=>p.morale)');g.run("boost('talk')");let after=g.run('state.squad.map(p=>p.morale)');
assert.deepEqual(Array.from(after).slice(0,9),[44,64,68,72,76,80,80,90,100]);
assert.equal(g.run('teamTalkStatus().remaining'),3);
for(let i=0;i<20;i++)g.run("boost('talk')");assert.deepEqual(Array.from(g.run('state.squad.map(p=>p.morale)')),Array.from(after));
// Reloading and manipulating the old weekly flag cannot reset the cooldown.
g=game(g.storage.value);assert.equal(g.run('teamTalkStatus().remaining'),3);g.run('state.talked=false');assert.equal(g.run('teamTalkStatus().available'),false);
for(let match=1;match<=3;match++){
 g.run('state.squad.forEach(p=>{p.injury=0;p.fitness=100});autoPick();playMatch();');
 assert.equal(g.run('state.round'),match);assert.equal(g.run('teamTalkStatus().remaining'),3-match);
 if(match<3){const morale=g.run('JSON.stringify(state.squad.map(p=>p.morale))');g.run("boost('talk')");assert.equal(g.run('JSON.stringify(state.squad.map(p=>p.morale))'),morale);}
}
g.run('state.squad.forEach(p=>p.morale=50)');assert.equal(g.run('teamTalkStatus().available'),true);g.run("boost('talk')");assert.equal(g.run('avg("morale")'),54);
// Do not waste a talk on a confident squad, or lower high morale to the cap.
g.run('state=fresh();autoPick();state.squad.forEach(p=>p.morale=95)');assert.equal(g.run('teamTalkStatus().available'),false);g.run("boost('talk')");assert.equal(g.run('avg("morale")'),95);assert.equal(g.run('state.lastTeamTalkMatch'),null);
// A late-season talk remains on cooldown into the following season.
g.run("state=fresh();state.round=37;state.squad.forEach(p=>{p.morale=40;p.injury=0;p.fitness=100});autoPick();boost('talk');playMatch();");assert.equal(g.run('teamTalkStatus().available'),false);g.run('newSeason()');assert.equal(g.run('teamTalkStatus().remaining'),2);
// Existing careers retain their squad and migrate an already-used weekly talk.
const old=JSON.parse(g.storage.value);delete old.lastTeamTalkMatch;old.talked=true;old.season=3;old.round=5;old.cash=123456;g=game(JSON.stringify(old));assert.equal(g.run('state.cash'),123456);assert.equal(g.run('teamTalkStatus().remaining'),3);
old.talked=false;g=game(JSON.stringify(old));assert.equal(g.run('teamTalkStatus().remaining'),0);
// Paid bonuses keep their existing weekly limit and price.
g.run('state.cash=100000;state.bonus=false;state.squad.forEach(p=>p.morale=40)');g.run("boost('bonus');boost('bonus')");assert.equal(g.run('state.cash'),50000);assert.equal(g.run('avg("morale")'),50);
console.log('PASS: diminishing gains, morale ceiling, repeat-click protection, three actual matches, reload persistence, season rollover, old-save migration, paid bonuses.');
