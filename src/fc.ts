
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
    const scrollableElement = tbodyRef.current.children[i] satisfies HTMLElement;
    scrollableElement.scrollIntoView({behavior: 'smooth',block:'nearest'});
  }
}
export function input2options(id:string, options:string[]) {
  const input = document.getElementById(id) satisfies HTMLInputElement;
  const datalist = document.createElement('datalist') satisfies HTMLDataListElement;
  if (input && datalist) {
    options.forEach(i => datalist.appendChild(Object.assign(document.createElement('option'), { value: i })));
    input.parentNode?.append(Object.assign(datalist, { id: 'datalist-' + input.id }));
    input.setAttribute('list', datalist.id);
  }
} // let UT=1  ;if (typeof exports === 'undefined') { var exports = {}} // for bun repl
const hashtagRegex = /\s#[\p{L}\p{N}_]+/gu
const hashtail = /(?:\s+#[\p{L}\p{N}_]+#?)+$/gu;  // (?:... group non-capture
const hashDelSymbols = /[^\p{L}\p{N}_]/gu
export function t2txt(txt, sts:string[]) {
    const exHash = txt.match(hashtagRegex)?.map((m:string)=> 
      m.trim().slice(1).toLocaleLowerCase()) || []
    // console.info(exHash)
    return `${txt}${sts.filter(s=> !exHash.includes(s.toLocaleLowerCase()))
        .map(s => ` #${s.replace(hashDelSymbols,'')}`).join('')}`
}
export function txtRx(txt) {
  let cleaned = txt
  let MIN_SUFFIX = 33
  let sts:string[] = []
  // if (txt.length <=MIN_SUFFIX) 
  //   return [txt, sts]
  ; let SEP =  [' - ', ' | ', '-','|',' _',' · ',' — ',' – ','/ X',' 鸡娃客','_哔哩哔哩_bilibili']
  ; let offset = Math.max(...SEP.map(sep=> txt.lastIndexOf(sep)))
  if (offset > Math.max(1,txt.length-MIN_SUFFIX)) {
    // console.debug('txtRx:', txt.slice(offset,txt.length))
    sts.unshift(`suffix_`+txt.slice(offset,txt.length).replace(hashDelSymbols, ''))
    cleaned = txt.slice(0, offset).trim()
  }
  sts.unshift(...new Set(cleaned.match(hashtagRegex)?.map(s=> s.slice(1)) as string[]))
  cleaned = cleaned.replace(hashtail,'')
  ; let TERM = ['. ', '。','; ','；'] // first 
  offset = Math.min(...TERM.map(sep=> cleaned.indexOf(sep, 33)).filter(o=>o!==-1)) // trunc long paragraph at nearest sentences
  if (offset)  cleaned = cleaned.slice(0, offset).trim()
  return [cleaned, sts]
}if('undefined'!==typeof UT)["快讯：昆仑万维公告，第三季度营收为20.72亿元，同比增长56.16%；净利润为1.9亿元，同比增长180.13%。前三季度营收为58.05亿元，同比增长51.63%；净利润亏损6.65亿元，同比下降6.19%。 - 华尔街见闻"
  , "快讯：中共中央关于制定国民经济和社会发展第十五个五年规划的建议发布。其中指出，适度超前建设新型基础设施，推进信息通信网络、全国一体化算力网、重大科技基础设施等建设和集约高效利用，推进传统基础设施更新和数智化改造。完善现代化综合交通运输体系，加强跨区域统筹布局、跨方式一体衔接，强化薄弱地区覆盖和通达保障。健全多元化、韧性强的国际运输通道体系。优化能源骨干通道布局，加力建设新型能源基础设施。加快建设现代化水网，增强洪涝灾害防御、水资源统筹调配、城乡供水保障能力。推进城市平急两用公共基础设施建设。 - 华尔街见闻"
  , "平安保险在线客服,平安理赔查询,平安理赔系统- 中国平安官方直销网站"
  , "中港通巴士 - Google Search"
  , "由浅入深，万字解析：人民币的发行机制和汇率走势（下）_哔哩哔哩_bilibili"
  , "开车必备！自动朗读微信通知的神器玩过吗-微信 ——快科技(驱动之家旗下媒体)--科技改变未来"
  , "Watch 'Schonfeld University | Rates & Financing' | Microsoft Stream"
  , "繫年 - 維基百科，自由的百科全書"
  , "Bacterial Flagellar Motor #biology #science #bacterialflagellum - YouTube"
  , "3~6年级竞赛数学导引（PDF扫描版，含详细解答） 鸡娃客"
  , "👍九龍灣出租 EPSON FF-680W FastFoto scan 相片 相 高速掃描器, Computers & Tech, Printers, Scanners & Copiers on Carousell"
  ].forEach(t=> console.log(txtRx(t)))
export function txtref2tab(txt, ref) {
  const [cleaned, sts] = txtRx(txt)
  return { txt: cleaned, ref, sts} //: ['ref_'+cleanDomain(ref).replace('.','_'),...sts] }
}
export function markdown2tab(markdown: string) {
  let rx =  /\[(.+)(?<!\\)\]\((.+)\)/g    // escape ]( in url
  const items = [];
  let match;
  while ((match = rx.exec(markdown)) !== null) 
    items.push(txtref2tab(match[1], match[2].replaceAll('\\](','](')))
  return items  // undo escape added from popup.tsx
} 
if('undefined'!==typeof UT) ['[t\\](UR](L)','[t](UR\\](L)','[t](UR](L)'].map(s=> (/\[(.+)(?<!\\)\]\((.+)\)/g.exec(s)))
export function cleanDomain(url: string) {
    // Remove protocol (http://, https://) and optional "www."
    if (url.startsWith('file:'))
      return url.slice(7, url.indexOf('\/',11))
    const cleanUrl = url.replace(/https?:\/\/(www\.)?/, '');
    return cleanUrl.split('/')[0]
} ['file:///C:/Users/wso/Downloads/JIRA.html', 'file://ny5-na-risk-01.corp.schonfeld.com/risk_vol1/src/barra/BarraOptimizer9.0/doc/Optimizer_User_Guide.pdf'
  ,'blah.co.uk', 'news.yahoo.co.jp', 'tsmc.com.tw', 'news.google.com', 'news.google.com.hk',
].forEach(r=> console.log(cleanDomain(r)))

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
export  function sideLog(msg:string, _stuff:any, ...data:any[]) {
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
export function userAgentStr() {
  return navigator.userAgentData?.brands?.map(b => b.brand)
  .find(b => !b.startsWith('Not') && !b.startsWith('Chromium')) 
  || navigator.userAgent.match(/(\w+)\/([\d.]+)/)?.[1] || 'BrowserX'
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