import {Dexie} from 'dexie';
import * as fc from './fc';
import { countBy } from 'es-toolkit';

export interface Tag { tid?: number, txt: string, ref: string
  , sts?: string[], ats?:number[] // related tags
  , dt:Date, type: string } // dt=latest seen b4 save-tags , 'bookmark' | 'history' | 'tab' | 'tag'
export const eqTags = (r1: Tag, r2: Tag) => r1.ref === r2.ref && r1.txt === r2.txt && r1.type== r2.type
export interface Refs {

  id?: number;
  title: string;
  /** Array to store the embedding of the title */
  // embedding?: BigInt[];
  href: string;
  dt: Date;
  type: 'bookmark' | 'history' | 'tab' | 'tag';
}
const modelEnum = {'Xenova/bge-small-zh-v1.5':15}
export const DEF_TREE:{[key:string]: unknown} = { //"cred": "https://PROJECTID.supabase.co|anon"
  "server": 'https://qhumewjpkzxaltwefqch.supabase.co',
  "pub_key": 'sb_publishable_5Stcng45Jofw5Wv3FA4GnQ_BivUYQ_K',
  // , "emb_model-HF":HF_OR[0]
}
export async function binPut(key:string, bin: any) {
  db.bins.put({ key, rec: { date: new Date().toLocaleString('zh-cn',{hour12:false}) }
      , bin: fc.encZip(bin) });
}
export class DDB extends Dexie {
  tree!: Dexie.Table<{ key: string, value: unknown }>;
  tags!: Dexie.Table<Tag>;
  vecs!: Dexie.Table<{ tid: number, mdl: string, vec: Float32Array }>;
  stat!: Dexie.Table<{ tid: number, key: string, value:unknown }>;
  bins!: Dexie.Table<{ key: string, rec: unknown, bin: Uint8Array, addAt?: Date, modAt?:Date}>;
  refs!: Dexie.Table<Refs>;

  constructor() {
    super('tagDB_0')
    this.version(8).stores({  // to infer 2nd generic type
      tree: 'key', // href+title, 
      tags: '++tid, dt, type, *sts, [ref+type]',
      vecs: '[tid+mdl]', // for orama or psqlvec
      stat: '[tid+key]',
      bins: 'key, [key+addAt], [key+modAt]',
      refs: '++id, title, href, dt, type'
    })
    this.version(9).stores({  // to infer 2nd generic type
      tree: 'key', // href+title, 
      tags: '++tid, dt, type, *sts, [ref+type]',
      vecs: '[tid+mdl]', // for orama or psqlvec
      stat: '[tid+key]',
      bins: 'key, [key+addAt], [key+modAt]',
      refs: '++id, title, href, dt, type'
    })
    function updatingHook(mod:any) { return {...mod, modAt: new Date()}}
    function creatingHook(_priKey:any, row:any) { 
      if (!row.addAt) row.addAt = new Date();
      if (!row.modAt) row.modAt = row.addAt
    }

    this.bins.hook('updating', updatingHook)
    this.bins.hook('creating', creatingHook)
    //.upgrade(async tx=> {});
  }
}
export async function getRowsAroundTid(tid: number, n: number) {
  // Get n rows before tid (in reverse order, then reverse back for chronological)
  n = Math.max(3, n)
  const b4 = await db.tags.where('tid').below(tid).limit(n/2).reverse().toArray()
  const af = await db.tags.where('tid').above(tid).limit(n -n/2 -1).toArray();
  const eq = await db.tags.get(tid)
  return [...b4.reverse(), eq , ...af] .filter(t=> t!==undefined);
}
// Create and export a singleton instance
export const db = new DDB(); 

async function stat_tags(){
  let str = ''
  const dts = await db.tags.orderBy('dt').reverse().limit(11).uniqueKeys()
  if (dts.length==0) return str
  str += ` updated ${fc.diffDays(new Date(), dts[0]).toFixed(2)} days ago`
  for(const dt of dts) {
    const ts = db.tags.where('dt').equals(dt)
    str += `\n`+`${await ts.count()}`.padStart(4,' ')+` at `+fc.fmt_mdwhm(dt) 
    const tsa = await ts.toArray()
    if (tsa.length===1) str += ' '+ tsa[0].type+`: `+tsa[0].txt + tsa[0].sts?.map(s=> ` #${s}`)?.join()
    // const cnt = ts.filter(t=> t.type!=='tab')
    str += ` max(tid)=${Math.max(...tsa.map(t=> t.tid ?? 0))}`
    const alltags = tsa.flatMap(t=>t.sts ??[])
    const tags = alltags.filter(t=>!t.startsWith('dev:'))
    if (tags.length >0)
      str += ` top tags: ${JSON.stringify( Object.fromEntries( fc.topFew(3, 
        Object.entries( countBy(tags, x=>x)))))}`
    if (alltags.length === tags.length) continue
    const cntdev = countBy(alltags.filter(t=> t.startsWith('dev:')), x=> x.substring(4))
    str += ` dev: ${JSON.stringify(cntdev)}`
    //.reduce((acc, s)=>
    //(acc[s] = (acc[s] || 0) +1, acc), {})
    // if (str.length>33) return false  // to stop dexie cursor
  }
  return str
}
export async function statStr() {
  return (`local saved: ${await db.tags.count()} tags ${await stat_tags()}
  ...\n${await db.stat.count()} stats max(tid)=${
    (await db.stat.reverse().last())?.tid},  ${await db.vecs.count()} vecs max(tid=${
      (await db.vecs.reverse().last())?.tid})`)
}
/** ignore identicals, split clashing by tid, ignoring exact match
 * @param ts 
 * @param dl 
 * @returns 
 */
export function diffTags( ts:Tag[], dl:Tag[]) {
  // TODO clean ancient backup
  let clash: Tag[] = []
  let newDL = dl  // default save all downloaded
  if (ts.length>0) {
    const tag2str=(t:Tag) => `${t.ref}|${t.txt}|${t.type}|${t.sts}` // for now ignore |${t.ats} 
    const tsSet = new Set(ts.map(tag2str))
    newDL = dl.filter(rt=> ! tsSet.has(tag2str(rt)))
    if (newDL.length >33)
      console.log(`${newDL.length} diff in idb`)
    else
      newDL.forEach(d=> console.log(`diff:[${d.txt}]\n  vs:(${d.ref})`))
    // upsert do not 
    const idSet = new Set(ts.map(t=> t.tid))
    if (newDL.some(t=> idSet.has(t.tid))) {
      clash = newDL.filter(t=> idSet.has(t.tid))
      const idClash = new Set(clash.map(t=> t.tid))
      newDL = newDL.filter(t=> ! idClash.has(t.tid))
    }
  }
  return { newDL, clash, ts}
}