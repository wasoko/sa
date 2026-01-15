// import './tw4.css'  // Adjust path if needed
import * as tw from './tw'
import * as fc from './fc'
import { stts } from './fc';
import * as idb from './idb'
import * as sub from './sub';
import {sbc} from './sub';
import { SideBar } from './sidebar';
// import ExcelProxy from './server';
import * as sb from '@supabase/supabase-js';
import { main_animate, canvas, sttsE, setProgress } from './main_animate';
import { createRoot } from 'react-dom/client';
import React, { useEffect, useMemo, useState } from 'react';
import { BrowserRouter, Routes, Route, useLocation, HashRouter } from 'react-router-dom';
// function stts(str: string) { return sttsE.textContent = str }
async function main() {
  // main_animate();
  setProgress(1, '')
}
main().catch(err => {
  console.error(err);
  sttsE.textContent = 'Initialization failed';
});
function TagServer() {
  const params = new URLSearchParams(window.location.search);
  const urlAnon = params.get('cred');
  if (!urlAnon || !urlAnon.includes('|')) {
    return JSON.stringify(
      { error: 'Missing or invalid ?key=URL|ANON_KEY parameter' },
      null,2); 
    return }
  const sbc = sb.createClient(urlAnon.split('|')[0], urlAnon.split('|')[1]
    , {auth:{debug:false, }})
  if (!sbc) return JSON.stringify({error: 'cred not connecting.'})
  // document.body.innerText =
  const [ts, setTS] = useState([])
  useEffect(()=> {
    (async()=> setTS(await sub.last_sync(sbc)))()
  }, [])//.then((ts:idb.Tag[])=> 
  return JSON.stringify(ts, null, 2)
}

function RootFC() {
  if (useLocation().pathname==='/json') return <TagServer />
  const [tree, setTree] = useState<{ [key: string]: unknown; }>(idb.DEF_TREE);
  const [showGrid, set_showGrid] = useState(true)
  const [showMerge, set_showMerge] = useState(false)
  const [topTag, set_topTag] = useState<idb.Tag[]>([])
  function onChange_tree(key: string, new_value: any) {
    setTree(prev => ({ ...prev, [key]: new_value }));
    idb.db.tree.put({ key, value: new_value })
    .catch(error => {console.error(`Error updating ${key}:`, error);});
  }
  React.useEffect(() => {
    (async()=> {
      const treeData = await idb.db.tree.toArray()
      setTree({...idb.DEF_TREE,...Object.fromEntries(treeData.map(i => [i.key, i.value]))});
      
      if(chrome.runtime) fc.reAddCB(fc.sttsCB)
      const estimate = await navigator.storage.estimate();
      console.log(`Total IndexedDB usage: ${estimate.usage?.toLocaleString()} bytes out of quota ${estimate.quota?.toLocaleString()}`);
    }) ()
  },[])
  // let active_sbc:sb.SupabaseClient | null = null
  // const sbc = useMemo(() => {
  //   if (tree.cred==='' || !tree.cred) return
  //   if (tree.cred===idb.DEF_TREE['cred']) return
  //   if (tree.cred===active_cred && active_sbc) return active_sbc
  //   if (active_sbc) {
  //     // Explicitly shut down the Realtime WebSocket to free up locks
  //     active_sbc.realtime.disconnect(); 
  //     // Remove all listeners to prevent memory leaks
  //     active_sbc.removeAllChannels();
  //     active_sbc = null;
  //   }
  //   active_cred = tree.cred as string
  //   const [url,key] = active_cred.split('|');
  //   try { 
  //     const res = sb.createClient(url,key
  //       , {auth:{debug:false, persistSession:true,}})
  //     if (res) {
  //       sub.last_sync_desc(res).then(s=> {
  //         if (s.startsWith('err'))
  //           stts(`error: `+s, "Sync")
  //       })
  //     } else stts(`err bad cred url ${url} or key ${key}`, "Sync")
  //   } catch(e) {
  //     stts(e.message, "Sync")
  //     console.error(`error: `,e)
  //   }
  let active_cred = ''
  useEffect(()=> {
    if (tree.cred==='' || !tree.cred) return
    if (tree.cred===idb.DEF_TREE['cred']) return
    if (tree.cred===active_cred ) return 
    active_cred = tree.cred as string
    const [url,anon] = active_cred.split('|');
    if (!anon) return
    sub.set_sbc(url,anon)
  }, [tree.cred])
  useEffect(()=> {
    if (!sbc) return
    let abort = false
    let channel:any = null
    sub.subRt(sbc).then(c=> {
      if(abort) sbc?.removeChannel(c) 
      else channel=c
    })
    return ()=>{abort = true
      if(channel) sbc?.removeChannel(channel)}
  }, [sbc])
  async function onFlipSetup(showSetup) {
    if (!showSetup) return
    stts(await idb.statStr(), "Saved")
    if (!sbc) return stts('bad cred','Sync')
    const {result, ...msgs} = await sub.last_sync_desc(sbc)
    stts(JSON.stringify(msgs), "Sync")  // dump except full result
  }
  let dlDiff:any = null
  async function dl2diff(){
    if(!sbc) return stts('cred not connecting.')
    const ts = await idb.db.tags.toArray()
    let sttr = ''
    stts((sttr = sttr +`downloading `)+'...')
    const dl = await sub.last_sync(sbc)
    dlDiff = idb.diffTags(ts, dl)
    const matched = dl.length - dlDiff.newDL.length - dlDiff.clash.length
    stts((matched === dl.length? 'Same as local, nothing to merge. ':'')
      +`${dlDiff.newDL.length} new /w ${dlDiff.clash.length} clash `
      + `(${ (matched/dl.length *100).toFixed(1)} % matched) `, "DlDiff")
    if (matched === dl.length) return
    set_showMerge(true)
  }
  async function mergeDiff() {
    if (!dlDiff || !sbc) return
    let sttr = ''
    stts((sttr = sttr +`backup local `)+'...')
    idb.db.bins.put({ key:'bak dl-tags', rec: {date:Date.now()}, bin: fc.encZip(ts)})
    stts((sttr = sttr +`✔. saving ${dlDiff.newDL.length} `)+'...')
    idb.db.tags.bulkPut( dlDiff.newDL)
    
    stts((sttr = sttr +`✔. upserting ${dlDiff.clash.length} clash `)+'...')
    const lastTag = await idb.db.tags.orderBy(':id').last()
    sub.upsRt(dlDiff.clash, sbc, lastTag?.tid ?? 1 )
    
    stts(`✔ done. `+idb.statStr(), "Saved")
    const estimate = await navigator.storage.estimate();
    console.log(`Total IndexedDB usage: ${estimate.usage?.toLocaleString()} bytes out of quota ${estimate.quota?.toLocaleString()}`);
    set_showMerge(false)
    // misc hist vecs      
  }
  const ts2up:idb.Tag[] = []
  function ups(ts: idb.Tag[]) {
    ts2up.unshift(...ts)
    if (!sbc) return
    idb.db.tags.orderBy(':id').last().then(last=> 
      sub.upsRt(ts, sbc, last?.tid?? 1).then(()=> ts2up.length = 0))
  }
  async function refreshTag() {
    // set_topTag(await idb.db.tags.where('type').anyOf(['topTag']).toArray())
  }
  return (<div>
    <div style={{position:'fixed', width:'100%', zIndex:1, display: 'flex', flexDirection: 'row', left:0, bottom:0, }}>
    <SideBar tree={tree} onChange_tree={onChange_tree} onFlipSetup={onFlipSetup} 
    download2merge={dl2diff} showMerge={showMerge} mergeDiff={mergeDiff} refreshTag={refreshTag}
    flipGrid={()=>set_showGrid(!showGrid) } showGrid={showGrid}/> 
    <div id="stts" style={{ position: 'absolute', bottom: '55px', right: '10px',}}></div>
    </div>
    <div style={{position:'fixed', inset:0}}>
    <tw.CelestialGridViewer showGrid={showGrid} set_showGrid={set_showGrid} ups={ups} /> 
    </div>
    </div>)
}
const container = document.getElementById('root');
if (!container) throw new Error('Failed to find the root element');
createRoot(container).render(  <React.StrictMode> 
  <HashRouter ><Routes>
    <Route path="/*" element={<RootFC />} />
    {/* <Route path="/json" element={<ExcelProxy />} /> */}
  </Routes></HashRouter>
</React.StrictMode>);