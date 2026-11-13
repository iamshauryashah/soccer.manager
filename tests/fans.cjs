const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const code=fs.readFileSync('public/index.html','utf8').match(/<script>([\s\S]*?)<\/script>/)[1];
function game(saved=null){const elements={},storage={value:saved};const ctx={Math,console,setTimeout:()=>0,clearTimeout(){},localStorage:{getItem(){return storage.value},setItem(k,v){storage.value=v}},document:{querySelector(s){return elements[s]??={innerHTML:'',textContent:'',showModal(){},close(){}}}}};vm.createContext(ctx);vm.runInContext(code,ctx);return {run:s=>vm.runInContext(s,ctx),storage};}
let g=game();assert.equal(g.run('state.fans'),65);assert.ok(g.run('attendance()<state.capacity'));
const rows=g.run('[15,20,25,30,40].map(price=>({price,crowd:attendance(price),revenue:attendance(price)*price}))');
for(let i=1;i<rows.length;i++)assert.ok(rows[i].crowd<=rows[i-1].crowd,'Higher prices do not create demand');assert.ok(rows[4].revenue<rows[2].revenue,'£40 earns less than £25 at the starting club');
console.log('Starting club forecasts:',Array.from(rows,r=>`£${r.price}: ${r.crowd} fans, £${r.revenue}`).join('; '));
// Check low through high support without a universal £40 optimum or phantom crowds.
for(const fans of [0,20,40,65,80,100]){g.run(`state.fans=${fans}`);const revenue=Array.from(g.run('[15,20,25,30,40].map(p=>attendance(p)*p)'));assert.ok(revenue[4]<Math.max(...revenue.slice(0,4)),'£40 is not dominant with an ordinary fan base');for(const price of [15,20,25,30,40]){const n=g.run(`attendance(${price})`);assert.ok(Number.isInteger(n)&&n>=0&&n<=6000);}}
g.run('state.fans=65;state.capacity=20000');const normal=g.run('attendance(25)');g.run('state.fans=30');assert.ok(g.run('attendance(25)')<normal,'Unhappy supporters stay away');
g.run('state.fans=65;state.capacity=6000');const crowd=g.run('attendance(25)');g.run('state.capacity+=2000');assert.equal(g.run('attendance(25)'),crowd,'Extra seats do not create supporters');
// Fan responses happen at matches, not while clicking ticket selectors.
g.run('state=fresh();state.ticket=20;state.fans=60');assert.equal(g.run('updateFanSupport(2,0,false)'),3);assert.equal(g.run('updateFanSupport(0,2,false)'),-3);
g.run('state.fans=60;state.ticket=40');assert.ok(g.run('updateFanSupport(1,1,true)')<0,'Home fans dislike overpriced tickets');g.run('state.fans=60');assert.equal(g.run('updateFanSupport(1,1,false)'),0,'Away matches do not charge home ticket prices');
g.run('state.fans=60;setTicketPrice(40);setTicketPrice(15);setTicketPrice(40)');assert.equal(g.run('state.fans'),60);g.run('setTicketPrice(999)');assert.equal(g.run('state.ticket'),40);
// Last match crowd and money must agree with the pre-match forecast.
g.run('state=fresh();state.ticket=40;autoPick()');const expected=g.run('attendance()'),price=g.run('state.ticket');g.run('playMatch()');assert.equal(g.run('state.lastHomeGate.crowd'),expected);assert.equal(g.run('state.lastHomeGate.revenue'),expected*price);assert.equal(g.run("state.ledger.find(l=>l.label==='Home ticket revenue').amount"),expected*price);assert.ok(g.run("document.querySelector('#modal').innerHTML.includes('Attendance')"));assert.ok(g.run("finances().includes('Compare ticket prices')"));
const support=g.run('state.fans'),base=g.run('state.fanBase');g=game(g.storage.value);assert.equal(g.run('state.fans'),support);assert.equal(g.run('state.fanBase'),base);g.run('state.round=14;newSeason()');assert.equal(g.run('state.fans'),support);assert.equal(g.run('state.fanBase'),base);
const old=JSON.parse(g.storage.value);delete old.fans;delete old.fanBase;delete old.lastHomeGate;old.cash=654321;g=game(JSON.stringify(old));assert.equal(g.run('state.fans'),65);assert.equal(g.run('state.fanBase'),6500);assert.equal(g.run('state.cash'),654321);
console.log('PASS: price-sensitive crowds, non-dominant £40 tickets, fan support, realistic expansion demand, match-only effects, forecast/accounting agreement, reloads, season continuity, old-save migration.');
