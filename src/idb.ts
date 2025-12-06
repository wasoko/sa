import {Dexie} from 'dexie';
import * as fc from './fc';

export interface Tag { tid?: number, txt: string, ref: string
  , sts?: string[], ats?:number[] // related tags
  , dt:Date, type: 'bookmark' | 'history' | 'tab' | 'tag' } // dt=latest seen b4 save-tags 

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
export const DEF_TREE:{[key:string]: unknown} = { "cred": "https://PROJECTID.supabase.co|anon"
  // , "emb_model-HF":HF_OR[0]
}
export async function getTree(key: string){
  // (Dexie as any).debug = true 
  const row = await db.tree.get(key);
  return row ? row.value : DEF_TREE[key];
}
export async function binPut(key:string, bin: any) {
  // try{
  db.bins.put({ key, rec: { date: new Date().toLocaleString('zh-cn',{hour12:false}) }
      , bin: fc.encZip(bin) });
  // }catch(ex) {}
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

// utils
