const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {harness}=require('./helpers/online-harness.cjs');
(async()=>{
 const h=await harness(),a=await h.join('TIMERS','Timer Rovers'),b=await h.join('TIMERS','Slow United');let world=h.world('TIMERS');world.now=()=>h.clock.now;const start=h.clock.now;
 assert.equal((await h.state('TIMERS',a)).world.autoReady.enabled,false);
 let r=await h.action('TIMERS',a,'autoReady',{enabled:true,minutes:5});assert.equal(r.status,200);assert.equal(r.data.world.autoReady.nextAt,start+300000);assert.equal(h.storage('TIMERS').alarm,start+300000);
 assert.equal((await h.action('TIMERS',b,'autoReady',{enabled:true,minutes:10})).status,200);
 h.clock.now=start+299999;await world.alarm();assert.equal((await h.state('TIMERS',a)).world.ready,false);
 h.clock.now=start+300000;await world.alarm();assert.equal((await h.state('TIMERS',a)).world.ready,true);assert.equal((await h.state('TIMERS',b)).world.ready,false);assert.equal(world.world.round,0);assert.equal(h.storage('TIMERS').alarm,start+600000);
 // Saved settings and alarms survive a server restart; no open browser is involved.
 world=await h.restartWorld('TIMERS');world.now=()=>h.clock.now;
 h.clock.now=start+600000;await world.alarm();let sa=await h.state('TIMERS',a);assert.equal(sa.state.round,1);assert.equal(sa.world.ready,false);assert.equal(sa.world.autoReady.nextAt,h.clock.now+300000);assert.equal((await h.state('TIMERS',b)).world.autoReady.nextAt,h.clock.now+600000);
 await world.alarm();assert.equal(world.world.round,1,'Repeated alarm does not play another match');
 // Disabling the timer while already ready does not revoke readiness; manual unready stops it.
 h.clock.now+=300000;await world.alarm();assert.equal((await h.state('TIMERS',a)).world.ready,true);
 r=await h.action('TIMERS',a,'autoReady',{enabled:false});assert.equal(r.status,200);assert.equal(r.data.world.ready,true);assert.equal(r.data.world.autoReady.nextAt,null);
 assert.equal((await h.action('TIMERS',a,'autoReady',{enabled:true,minutes:2})).data.world.autoReady.nextAt,null);
 r=await h.action('TIMERS',a,'ready',{ready:false});assert.equal(r.data.world.autoReady.enabled,false);assert.equal(r.data.world.ready,false);
 for(const minutes of [0,-1,1.5,1441,'5',null])assert.equal((await h.action('TIMERS',a,'autoReady',{enabled:true,minutes})).status,400);
 assert.equal((await h.action('TIMERS',a,'autoReady',{enabled:true,minutes:1440})).status,200);
 assert.equal((await h.action('TIMERS',a,'autoReady',{enabled:true,minutes:1})).data.world.autoReady.nextAt,h.clock.now+60000);
 assert.equal((await h.api('TIMERS','action',null,{action:'autoReady',args:{enabled:true,minutes:5},season:1,round:1})).status,401);
 // Invalid lineups are repaired once; unavailable teams pause instead of auto-approving a forfeit.
 const manager=world.world.managers[0],career=world.world.careers[manager.id];career.lineup=[];await world.persist();h.clock.now+=60000;await world.alarm();assert.equal((await h.state('TIMERS',a)).world.ready,true);
 await h.action('TIMERS',a,'ready',{ready:false});world.world.careers[manager.id].squad.forEach(p=>p.injury=3);await world.persist();await h.action('TIMERS',a,'autoReady',{enabled:true,minutes:1});h.clock.now+=60000;await world.alarm();sa=await h.state('TIMERS',a);assert.equal(sa.world.ready,false);assert.equal(sa.world.autoReady.enabled,false);assert.match(sa.world.autoReady.message,/valid starting XI/);
 // A long outage advances at most one match; it never fast-forwards missed intervals.
 const solo=await harness(),key=await solo.join('SINGLE','Only FC'),actor=solo.world('SINGLE');actor.now=()=>solo.clock.now;await solo.action('SINGLE',key,'autoReady',{enabled:true,minutes:5});solo.clock.now+=86400000*3;await actor.alarm();assert.equal(actor.world.round,1);assert.equal((await solo.state('SINGLE',key)).world.autoReady.nextAt,solo.clock.now+300000);
 // At the end of a season the timer pauses; manual season readiness resumes it.
 for(let i=1;i<38;i++){solo.clock.now+=300000;await actor.alarm();}
 let end=await solo.state('SINGLE',key);assert.equal(end.state.round,38);assert.equal(end.world.autoReady.nextAt,null);assert.match(end.world.autoReady.message,/season end/);
 solo.clock.now+=3600000;await actor.alarm();assert.equal(actor.world.round,38);
 r=await solo.action('SINGLE',key,'ready',{ready:true});assert.equal(r.data.state.season,2);assert.equal(r.data.state.round,0);assert.equal(r.data.world.autoReady.nextAt,solo.clock.now+300000);
 // Rendered controls allow a custom interval and stop through the authenticated API.
 const nodes={},snap=await solo.state('SINGLE',key),ctx={Math,Date,console,setTimeout:()=>0,clearTimeout(){},setInterval(){},localStorage:{setItem(){},removeItem(){}},onlineSnapshot:snap,onlineProfile:{code:'SINGLE',key},document:{querySelector(s){return nodes[s]??={innerHTML:'',textContent:'',value:'',className:'',open:false,showModal(){this.open=true},close(){this.open=false}};}}};ctx.window=ctx;
 const endpoints=[];ctx.onlineRequest=async(endpoint,body)=>{endpoints.push(endpoint);const x=await solo.api('SINGLE',endpoint,key,body);if(x.status>=400)throw Error(x.data.error);return x.data;};vm.createContext(ctx);vm.runInContext(fs.readFileSync('public/online-game.js','utf8'),ctx);
 assert.match(nodes['#online-world'].innerHTML,/Auto-ready: ON · 5 min/);ctx.configureAutoReady();assert.match(nodes['#modal'].innerHTML,/value="5"/);ctx.document.querySelector('#auto-ready-minutes').value='7';await ctx.saveAutoReady();assert.equal((await solo.state('SINGLE',key)).world.autoReady.minutes,7);assert.equal(nodes['#modal'].open,false);assert.equal(endpoints[0],'auto-ready');await ctx.stopAutoReady();assert.equal((await solo.state('SINGLE',key)).world.autoReady.enabled,false);
 assert.equal(endpoints[1],'auto-ready');
 assert.equal((await solo.api('SINGLE','auto-ready',null,{args:{enabled:false},season:2,round:0})).status,401);
 console.log('PASS: configurable offline auto-ready timers, multi-manager waiting, restart persistence, one match per interval, stop/unready, interval validation, lineup repair/pause, season-end pause/resume and UI controls.');
})().catch(e=>{console.error(e);process.exit(1)});
