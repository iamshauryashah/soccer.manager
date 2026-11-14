import {nameGroups,DIVISIONS} from './catalog-rules.js';
export const CATALOG_VERSION=1;
const key=s=>s.normalize('NFKC').toLowerCase().replace(/[’‘]/g,"'");
const seen=new Set(),names=[];
for(const group of nameGroups)for(const first of group.first)for(const last of group.last){const name=first+' '+last;if(!seen.has(key(name))){seen.add(key(name));names.push({first,last});}}
function gcd(a,b){while(b)[a,b]=[b,a%b];return a;}
let step=2053;while(gcd(step,names.length)!==1)step++;
function initials(n){let text='';do{text=String.fromCharCode(65+n%26)+text;n=Math.floor(n/26)-1;}while(n>=0);return text.split('').join('.')+'.';}
function randomFor(seed){let x=2166136261;for(const ch of seed){x^=ch.charCodeAt(0);x=Math.imul(x,16777619);}return()=>{x+=0x6D2B79F5;let t=x;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};}
// Catalog identity depends only on calendar and league, never the world or its purchases.
// Negative IDs and dotted middle initials separate catalog players from club recruits.
export function transferCatalog(season,round,division){
 if(!Number.isSafeInteger(season)||season<1||!Number.isInteger(round)||round<0||round>38||![1,2,3].includes(division))throw Error('Invalid transfer catalog calendar.');
 const config=DIVISIONS[division],random=randomFor('touchline-catalog-v1:'+season+':'+round+':'+division),rand=(lo,hi)=>lo+Math.floor(random()*(hi-lo+1));
 return Array.from({length:12},(_,slot)=>{const ordinal=((season-1)*39+round)*36+(division-1)*12+slot;if(!Number.isSafeInteger(ordinal))throw Error('Transfer catalog limit reached.');const entry=names[((ordinal%names.length)*step)%names.length],ovr=rand(...config.market),baseValue=Math.round((ovr-42)**2*800/10000)*10000,baseWage=Math.round((ovr-35)*75/100)*100;
 return{id:-(ordinal+1),name:entry.first+' '+initials(Math.floor(ordinal/names.length))+' '+entry.last,pos:['GK','DEF','MID','FWD'][slot%4],age:rand(18,32),ovr,potential:Math.min(94,ovr+rand(3,14)),morale:rand(65,87),fitness:rand(88,100),injury:0,wage:Math.round(baseWage*Math.sqrt(config.transferScale)/100)*100,value:Math.round(baseValue*config.transferScale/10000)*10000,xp:0,catalogVersion:CATALOG_VERSION};});
}
