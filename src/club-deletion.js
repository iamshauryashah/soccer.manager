import {createGame} from './engine.js';
import {memberDivision,nameKey} from './world.js';
export function removeManagedClub(world,manager,now){
 const division=memberDivision(world,manager.clubId),club=world.leagues[division].find(c=>c.id===manager.clubId);
 const existing=new Set(Object.values(world.leagues).flat().filter(c=>c.id!==club.id).map(c=>nameKey(c.name))),defaults=Object.values(createGame().state.leagues).flat();
 const preferred=defaults.find(c=>c.id===club.id),replacement=[preferred,...defaults].find(c=>!existing.has(nameKey(c.name)));club.name=replacement.name;
 for(const offer of world.directOffers||[])if(offer.status==='pending'&&(offer.from===manager.id||offer.to===manager.id))offer.status='cancelled';
 delete world.careers[manager.id];world.managers=world.managers.filter(m=>m.id!==manager.id);
 world.pendingClosures??=[];world.pendingClosures.push({world:world.code,manager:manager.id});
 if(!world.managers.length||!world.managers.some(m=>m.ready))world.deadline=null;
 else if(world.managers.every(m=>m.ready))world.deadline=now;
 else if(!world.deadline)world.deadline=now+86400000;
 return club.name;
}
const OPERATION='requested-sns123-george-lanesra-20261114';
const EXPIRES=Date.parse('2026-11-14T22:30:00Z');
// One-time, exact-name administrative cleanup explicitly requested by the site owner.
// The receipt prevents this operation from affecting future clubs with these names.
export function applyRequestedCleanup(world,now){
 if(!world||world.code!=='SNS123'||now>EXPIRES||world.adminOperations?.[OPERATION])return false;
 const clubs=Object.values(world.leagues).flat(),names=['George','Lanesra'];
 const targets=names.map(name=>world.managers.find(m=>clubs.find(c=>c.id===m.clubId)?.name===name));
 if(targets.some(m=>!m))return false;
 if(targets.some(m=>world.pendingSales?.some(s=>s.manager===m.id)||world.pendingOwnership?.some(t=>t.from===m.id||t.to===m.id)))return false;
 const receipt=targets.map((m,i)=>({clubId:m.clubId,name:names[i],manager:m.id}));
 for(const manager of targets)removeManagedClub(world,manager,now);
 world.adminOperations??={};world.adminOperations[OPERATION]={completedAt:now,removed:receipt};return true;
}
