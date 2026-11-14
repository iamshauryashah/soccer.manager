import {createGame} from './engine.js';
import {fail,project,storeCareer,memberDivision,assertCanSell} from './world.js';
const club=(world,id)=>Object.values(world.leagues).flat().find(c=>c.id===id);
const member=(world,id)=>world.managers.find(m=>m.id===id);
const name=(world,id)=>club(world,member(world,id)?.clubId)?.name||'Former club';
export function expireOffers(world,now){
 let changed=false;for(const offer of world.directOffers||[]){if(offer.status!=='pending')continue;
  if(offer.expiresAt<=now){offer.status='expired';changed=true;}
  else if(!world.careers[offer.to]?.squad.some(p=>p.id===offer.playerId)){offer.status='unavailable';changed=true;}
 }
 return changed;
}
export function offersFor(world,manager){
 const own=(world.directOffers||[]).filter(o=>o.from===manager.id||o.to===manager.id);
 const visible=[...own.filter(o=>o.status==='pending'),...own.filter(o=>o.status!=='pending').slice(-40)].sort((a,b)=>b.createdAt-a.createdAt);
 return visible.map(o=>({id:o.id,direction:o.to===manager.id?'incoming':'outgoing',fromClub:name(world,o.from),toClub:name(world,o.to),playerId:o.playerId,playerName:o.playerName,pos:o.pos,ovr:o.ovr,amount:o.amount,status:o.status,createdAt:o.createdAt,expiresAt:o.expiresAt}));
}
export function squadView(world,clubId){
 if(!Number.isSafeInteger(clubId))throw fail(400,'Choose a club.');
 const manager=world.managers.find(m=>m.clubId===clubId);if(!manager)throw fail(404,'Only manager-run clubs have squads to view.');
 const game=createGame({initialState:project(world,manager)}),state=game.state,team=club(world,clubId),starters=state.squad.filter(p=>state.lineup.includes(p.id));
 return{clubId,name:team.name,division:memberDivision(world,clubId),ready:manager.ready,rating:game.validLineup()?Math.round(starters.reduce((n,p)=>n+p.ovr,0)/11*10)/10:team.rating,
  squad:state.squad.map(p=>({id:p.id,name:p.name,pos:p.pos,age:p.age,ovr:p.ovr,potential:p.potential,fitness:p.fitness,morale:p.morale,injury:p.injury,wage:p.wage,value:game.currentPlayerValue(p),starter:state.lineup.includes(p.id)}))};
}
function ledger(career,world,amount,label){career.cash+=amount;career.ledger.unshift({round:world.round+1,label,amount});career.ledger=career.ledger.slice(0,90);}
export function directOfferAction(world,manager,action,args,now){
 expireOffers(world,now);world.directOffers??=[];
 if(action==='offerPlayer'){
  const seller=world.managers.find(m=>m.clubId===args.clubId);if(!seller||seller.id===manager.id)throw fail(400,'Choose another manager’s club in this world.');
  const player=world.careers[seller.id].squad.find(p=>p.id===args.id);if(!player)throw fail(409,'That player is no longer in this squad.');
  if(!Number.isSafeInteger(args.amount)||args.amount<1)throw fail(400,'Enter a whole-pound offer of at least £1.');
  if(world.careers[manager.id].cash<args.amount)throw fail(400,'Your offer exceeds your available cash.');
  const pending=world.directOffers.filter(o=>o.status==='pending'&&o.from===manager.id);
  if(pending.some(o=>o.to===seller.id&&o.playerId===player.id))throw fail(409,'You already have an offer for this player. Withdraw it before sending a new price.');
  if(pending.length>=20)throw fail(400,'You can have up to 20 pending offers. Withdraw one first.');
  // Bound retained history without discarding any live offer.
  world.directOffers=[...world.directOffers.filter(o=>o.status==='pending'),...world.directOffers.filter(o=>o.status!=='pending').slice(-200)];
  world.directOffers.push({id:crypto.randomUUID(),from:manager.id,to:seller.id,playerId:player.id,playerName:player.name,pos:player.pos,ovr:player.ovr,amount:args.amount,status:'pending',createdAt:now,expiresAt:now+48*3600000});return;
 }
 const offer=world.directOffers.find(o=>o.id===args.offerId);if(!offer)throw fail(404,'Offer not found.');
 if((action==='cancelOffer'?offer.from:offer.to)!==manager.id)throw fail(403,'This offer does not belong to your club.');
 if(offer.status!=='pending')throw fail(409,'This offer is already '+offer.status+'.');
 if(action==='rejectOffer'){offer.status='rejected';return;}
 if(action==='cancelOffer'){offer.status='withdrawn';return;}
 if(action!=='acceptOffer')throw fail(400,'Unknown offer action.');
 const buyer=member(world,offer.from),seller=manager,buyCareer=world.careers[buyer.id],sellCareer=world.careers[seller.id];
 if(buyer.ready||seller.ready)throw fail(409,'Both clubs must be unready before a transfer can complete.');
 if(world.pendingOwnership?.some(p=>p.playerId===offer.playerId))throw fail(409,'This player’s previous transfer is still being confirmed. Try again shortly.');
 const game=createGame({initialState:project(world,seller)}),player=structuredClone(assertCanSell(game,offer.playerId));
 if(buyCareer.cash<offer.amount)throw fail(409,'The buying club no longer has enough available cash.');
 if(buyCareer.squad.length+Object.keys(buyCareer.auctionHolds||{}).length>=25)throw fail(409,'The buying club has no free squad space.');
 if(buyCareer.squad.some(p=>p.id===player.id))throw fail(409,'The buying club already owns this player.');
 game.state.squad=game.state.squad.filter(p=>p.id!==player.id);game.state.lineup=game.state.lineup.filter(id=>id!==player.id);game.save();storeCareer(world,seller,game);
 const from=name(world,seller.id),to=name(world,buyer.id);
 ledger(world.careers[seller.id],world,offer.amount,'Direct sale · '+player.name+' to '+to);
 ledger(buyCareer,world,-offer.amount,'Direct signing · '+player.name+' from '+from);buyCareer.squad.push(player);
 const buyerGame=createGame({initialState:project(world,buyer)});buyerGame.save();storeCareer(world,buyer,buyerGame);
 for(const owner of [buyer,seller]){const career=world.careers[owner.id];career.news.unshift({season:world.season,week:world.round+1,text:player.name+' transfers from '+from+' to '+to+' for £'+offer.amount.toLocaleString('en-GB')+'.'});career.news=career.news.slice(0,30);}
 offer.status='accepted';for(const other of world.directOffers)if(other.id!==offer.id&&other.status==='pending'&&other.to===seller.id&&other.playerId===player.id)other.status='unavailable';
 if(player.id<0){world.pendingOwnership??=[];world.pendingOwnership.push({dealId:offer.id,playerId:player.id,world:world.code,from:seller.id,to:buyer.id,club:to,amount:offer.amount});}
}
