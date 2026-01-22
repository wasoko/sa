
import * as cbor from 'cbor-x';
import { keyBy } from 'es-toolkit';
import { object } from 'framer-motion/client';
import * as pako from 'pako';
import { useEffect, useState } from 'react';
export type Result<T, E> = { ok: true; value: T } | { ok: false; error: E }
export const HF_OR = [  //'Xenova/jina-embeddings-v2-base-zh',
  // https://developer.volcengine.com/articles/7382408396873400371
  // 'TownsWu/PEG', // onnx missing https://developer.volcengine.com/articles/7382408396873400371

  'Xenova/bge-small-zh-v1.5', // onnx of 'BAAI/bge-large-zh-v1.5',
  'Classical/Yinka',
  'aspire/acge_text_embedding',
  'iampanda/zpoint_large_embedding_zh',
  'thenlper/gte-small-zh',
  'intfloat/multilingual-e5-small',
  'moka-ai/m3e-base',
  'sentence-transformers/paraphrase-MiniLM-L6-v2',
  'sentence-transformers/all-MiniLM-L6-v2',
  'sentence-transformers/all-mpnet-base-v2',
  'sentence-transformers/multi-qa-mpnet-base-dot-v1',
  'sentence-transformers/distilbert-base-nli-mean-tokens'
];
export const DEF_MODEL = HF_OR[0]
export function reAddCB(callback:
  (message: any, sender: chrome.runtime.MessageSender, sendResponse: (response?: any) => void) => void
) {
  chrome.runtime.onMessage.removeListener(callback)
  chrome.runtime.onMessage.addListener(callback)
}
export const sttsCB =  (message:any, _s?:any, _sr?:any) => {
  if (typeof document === 'undefined') return
  const dd = document.getElementById(message.type)
  if (dd !==null && message.type.startsWith('stts') )
    dd.textContent = message.stts
  return false
}
export const sttsDict:{[key:string]:string} = {}
export const stts = (str: string, scope = '') => {
  const stKey=scope+'STTS'
  sttsDict[stKey] = str
  if (str.startsWith("err"))
    console.error(str);
  console.info(str);
  sttsCB({type: 'stts'+scope, stts: str})
  if (chrome.runtime) chrome.runtime.sendMessage({type:'stts'+scope,stts:str})  // FIXME avoid recur
  if (chrome.storage) chrome.storage.session.get({[stKey]:''}).then((items) => {
    if (str!='')chrome.storage.session.set({[stKey]: items[stKey] + str})
    })
  return str;
}
export const scrollToTbodyN = (tbodyRef: React.RefObject<HTMLTableSectionElement>, n:number) => {
  if (tbodyRef.current && tbodyRef.current.children.length >0) {
    const i = n>=0? n: tbodyRef.current.children.length +n
    const scrollableElement = tbodyRef.current.children[i] as HTMLElement;
    scrollableElement.scrollIntoView({behavior: 'smooth',block:'nearest'});
  }
}
export function input2options(id:string, options:string[]) {
  const input = document.getElementById(id) as HTMLInputElement;
  const datalist = document.createElement('datalist') as HTMLDataListElement;
  if (input && datalist) {
    options.forEach(i => datalist.appendChild(Object.assign(document.createElement('option'), { value: i })));
    input.parentNode?.append(Object.assign(datalist, { id: 'datalist-' + input.id }));
    input.setAttribute('list', datalist.id);
  }
}
export function markdown2tab(markdown: string) {
  const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g; // [title](url)
  const items = [];
  let match;
  while ((match = linkRegex.exec(markdown)) !== null) 
    items.push({ txt: match[1], ref: match[2], })
  return items
}

export function useDebounce(value, delay=400) {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => { 
    if (value==="" || value===0 ) {
      setDebouncedValue(value)
      return
    }
    const timer = setTimeout(() => setDebouncedValue(value), delay);
      return () => clearTimeout(timer) 
    }, [value, delay]);
  return debouncedValue;
}
export function extractLinksFromSelection(selection: Selection): string[] {
  const links: string[] = [];
  const range = selection.getRangeAt(0);
  const container = document.createElement("div");
  container.appendChild(range.cloneContents());

  // Find actual <a> tags
  const anchors = container.querySelectorAll("a");
  anchors.forEach(a => links.push(a.href));

  // Optional: Find plain text URLs using regex
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const textMatches = container.textContent?.match(urlRegex);
  if (textMatches) links.push(...textMatches);

  return [...new Set(links)]; // Remove duplicates
}
export function showOpenLinksButton(event: MouseEvent | TouchEvent, links: string[]) {
  // 1. Remove any existing button first
  const existingBtn = document.getElementById('floating-open-links');
  if (existingBtn) existingBtn.remove();

  // 2. Get selection coordinates
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return;
  
  const range = selection.getRangeAt(0);
  const rect = range.getBoundingClientRect(); // Viewport coordinates

  // 3. Create the button
  const btn = document.createElement('button');
  btn.id = 'floating-open-links';
  btn.textContent = `Open ${links.length} link${links.length > 1 ? 's' : ''}`;
  
  // Style for 2025 modern look
  Object.assign(btn.style, {
    position: 'fixed',
    top: `${rect.top - 40 + window.scrollY}px`, // Position above selection
    left: `${rect.left + rect.width / 2}px`,
    transform: 'translateX(-50%)',
    zIndex: '9999',
    padding: '8px 12px',
    backgroundColor: '#007bff',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    boxShadow: '0 2px 5px rgba(0,0,0,0.2)'
  });

  // 4. Handle the opening logic
  const handler = () => {
    let blocked = false;
    
    links.forEach((url, index) => {
      // window.open returns null if blocked by the browser
      const newTab = window.open(url, '_blank');
      if (!newTab || newTab.closed || typeof newTab.closed === 'undefined') {
        blocked = true;
      }
    });

    if (blocked) {
      alert("Multiple links were blocked. Please enable popups for this site in your browser settings.");
    }
    
    btn.remove();
    selection.removeAllRanges();
  };
  btn.onclick = handler
  btn.onmouseup = handler
 // --- CLEANUP LOGIC: Remove button on unselect/click-away ---
  const removeOnUnselect = (e: MouseEvent | TouchEvent) => {
    if (e.target !== btn) { btn.remove();
      document.removeEventListener('mousedown', removeOnUnselect);
      document.removeEventListener('touchstart', removeOnUnselect);
    }
  };  
  setTimeout(() => {
    document.addEventListener('mousedown', removeOnUnselect);
    document.addEventListener('touchstart', removeOnUnselect);
  }, 10); // Delay slightly to prevent the current event from triggering it immediately
  
  document.body.appendChild(btn);
}
export async function ul(data:any, fileApi:any, obj_prefix: string, checksum:number) {
  let start = performance.now()
  const b2 = encZip(data)
  nowWarn(start, `ul_${obj_prefix}`,"encZip",111)
  if (b2.byteLength /1024/1025 > 50)
    console.error(`${obj_prefix} too large >50MB after cbor.encode ${(b2.byteLength/1024/1024).toFixed(3)}MB`)
  else {
    const { error } = await fileApi.upload(`${obj_prefix}.${checksum}.cbor.pako`
      , b2, {contentType: 'application/octet-stream', upsert: true})
    if (error)
      console.error(`uploading :${obj_prefix}`, error);
    else stts(`${obj_prefix} stored in ${performance.now() - start} msec`) 
  }
  nowWarn(start, `ul_${obj_prefix}`)
}
export function encZip(data: any) { return pako.gzip(cbor.encode(data))}
export function decZip(data: pako.Data) { return cbor.decode(pako.ungzip(data))}
export async function dl(fileApi:any, obj_path: string) {
  let start = performance.now()
  const res = await fileApi.download(obj_path)
  const buf = await res.data?.arrayBuffer()
  nowWarn(start, `dl`,`${obj_path}`)
  return decZip(new Uint8Array(buf ?? new Uint8Array()))
}
// export const pick = <T, K extends keyof T>(obj: T, keys: K[]): Pick<T, K> =>
//   Object.fromEntries(
//     keys.filter(key => key in obj).map(key => [key, obj[key]])
//   ) as Pick<T, K> // Type 'T' is not assignable to type 'object'.ts(2322)
export function escapeXml(unsafe: string): string {
    return unsafe
        .replaceAll('&', "&amp;")
        .replaceAll('<', "&lt;")
        .replaceAll('>', "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll('\'', "&apos;")
}
export function sumArray(...numbers: number[]): number {
  return numbers.reduce((total, num) => total + num, 0);
}
export function logRet(...data: any[]) {
  console.log(data)
  return data.join('')
}
export  function sideLog(msg:string, _stuff:unknown, ...data:any[]) {
  console.log(msg, _stuff, data)
  return _stuff
}
export  function ifDo(stuff:unknown, cond:boolean, cb:()=>void) {
  if (cond) cb()
  return stuff
}
export function nowWarn(start: DOMHighResTimeStamp, scope:string, note='', msWarn = 333, alpha = .5) {
  const d = performance.now() - start
  if (d > msWarn)
    console.warn(`${scope} ${d.toLocaleString('en-US')} ms - ${note}`)
  const key = `log-maxTime ${scope}`
  const kl = `log-xTime ${scope}`
  if ('undefined'!== typeof chrome) 
    if('undefined'!== typeof chrome.storage) {
    chrome.storage.session.get(key).then(kv=> {
      if (kv && kv[key]) if (d > kv[key]) chrome.storage.session.set({[key]:d})
      })
    chrome.storage.local.get(kl).then(kv=> {
      chrome.storage.local.set({[kl]: (kv[kl] ??d) * (1-alpha) +alpha *d })
      })
  }
  return performance.now()
}

// Generics (? lodash)
export function topFew<T>(k: number, arr: T[], compare: (a: T, b: T) => number = (a: any, b: any) => a-b): T[] {
  if(k >=arr.length) return arr
  const result: T[] = arr.slice(0, k); 
  for (const item of arr) {
    result.push(item)
    result.sort((a, b) => compare(b, a));  // descending order
    // init k already // if (result.length > k) 
    result.pop();  // remove largest
  }
  return result;
}
const hashtagRegex = /\B#[\p{L}\p{N}_]+/gu;
const trailingHashtagRegex = /(?:\s*#[\p{L}\p{N}_]+)+$/gu;
export const trimTrailingHashtags=(text:string) =>text.replace( trailingHashtagRegex,"").trimEnd()

export const diffDays = (d1, d2) => (d1-d2)/(1000 *60*60 *24)
export function fmt_ym(dt) { 
  const p=fmt2parts(dt) 
  return`${p.year}-${p.month.padStart(2,'0')}`
}
export function fmt_mdwhm(dt) { 
  const p=fmt2parts(dt) 
  return`${p.year} ${p.month.padStart(2,' ')}/${p.day.padStart(2,'0')} ${p.weekday} ${p.hour}:${p.minute}`
}
export function fmt2parts(dt) { return Object.fromEntries( new Intl.DateTimeFormat('en-US', {
    month: 'numeric', // MM
    day: '2-digit',   // dd
  year: 'numeric',
    weekday: 'short',  // ddd
  hour: '2-digit',
  minute: '2-digit',
  hour12: false
  }).formatToParts(dt).map(({type,value})=> [type,value]))
}; // { // new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) // #,##0.##
export const fmt_md = new Intl.DateTimeFormat('en-US', { month: 'numeric', day: '2-digit', })
// //unused
// function setKVjoin(rec: Record<string,string>, arg1: string, arg2: string) {
//     rec[arg1] = arg2;
//     return Object.keys(rec).map(key => `${key}:${rec[key]}`).join('; ')
// }