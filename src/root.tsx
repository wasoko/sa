// import './tw4.css'  // Adjust path if needed
import * as tw from './tw'
import * as fc from './fc'
import { stts } from './fc';
import * as idb from './idb'
import * as sub from './sub';
import {sbg} from './sub';
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
  const [signinfo, set_signinfo] = useState('')
  const [topTag, set_topTag] = useState<idb.Tag[]>([])
  function onChange_tree(key: string, new_value: any) {
    setTree(prev => ({ ...prev, [key]: new_value }));
    idb.db.tree.put({ key, value: new_value })
    .catch(error => {console.error(`Error updating ${key}:`, error);});
  }
  React.useEffect(() => {
    let active = true; // Flag to handle double-triggers and async races
    const { data: { subscription } } = sbg.auth.onAuthStateChange(async (event, session) => {
      if (!active) return; // Ignore if component unmounted (Strict Mode remount)
      if (event === 'SIGNED_IN' && session) {
        set_signinfo(stts(session.user.email ?? 'id: ' + session.user.id));
      } else if (event === 'SIGNED_OUT') 
        sbg.removeAllChannels();
    })
    ;
    (async()=> {
      const treeData = await idb.db.tree.toArray()
      setTree({...idb.DEF_TREE,...Object.fromEntries(treeData.map(i => [i.key, i.value]))});
      
      if(chrome.runtime) fc.reAddCB(fc.sttsCB)
      const estimate = await navigator.storage.estimate();
      console.log(`Total IndexedDB usage: ${estimate.usage?.toLocaleString()} bytes out of quota ${estimate.quota?.toLocaleString()}`);

      const { data: { session } } = await sbg.auth.getSession();
      if(active && session) set_signinfo(session.user.email ?? 'id: '+session.user.id)
    }) ()
    return ()=> {
      active = false; // Prevents async state updates on unmounted component
      sbg.removeAllChannels()
      subscription.unsubscribe(); // Unbinds the auth listener
    }
  },[])
  useEffect(()=> {
    let active=true
    if (!active) return
    if (!tree.server || !tree.pub_key) return
    // if (tree.server==='' && tree.pub_key==='') idb.DEF_TREE  // TODO reset
    if (tree.server==='' || tree.pub_key==='') return
    sub.set_sbg(tree.server, tree.pub_key, (sbg)=> {
    })
    return()=> active=false
  }, [tree.server, tree.pub_key])
  async function signinGoogle() {
    sbg.auth.signInWithOAuth({ provider: 'google' 
      , options: {redirectTo: `${window.location.origin}/auth-callback.html?next=${encodeURIComponent(window.location.hash)}`
    }})
  }
  async function signinWeibo() {
    
  }
  async function signout() {
    await sbg.auth.signOut({ scope: 'local' });
  }
  async function onFlipSetup(showSetup) {
    if (!showSetup) return
    stts(await idb.statStr(), "Saved")
    if (!sbg) return stts('bad cred','Sync')
    const {result, ...msgs} = await sub.last_sync_desc(sbg)
    if(msgs.ok) stts(msgs.name +` [${msgs.updated_at}]`, "Sync")  // dump except full result
    else stts(msgs.error, "Sync")
  }
  async function upSnap() {
    let st = performance.now()
    const { data: { user } } = await sbg.auth.getUser() 
    if (!user) return stts("err Not logged in")
    let oName = `tags${fc.fmt_ym(new Date())}.${await idb.db.tags.count()}.cbor.pako`;
    const res = await sbg.storage.from('bb').list(`${user.id}`
      , { limit: 11, sortBy: { column: 'created_at', order: 'desc' } });
    if (res.error) return fc.sideLog(stts('err checking existing'), res)
    const matched = res.data.filter((o: { name: string; })=> o.name.startsWith('tags'));
    console.log('stale check: ',matched)
    if(matched.length?? 0 >0)
      if (oName== (matched[0].name as string))
        return stts(`stale ${oName} skipped `)
    const ta = await idb.db.tags.toArray();
    // const es = await idb.db.vecs.toArray();
    const fileApi = sbg.storage.from('bb')
    fc.ul(ta, fileApi, `${user.id}/tags`,ta.length)
    // fc.ul({ebds:es, hist:histCac}, fileApi, 'misc',ta.length)
    stts((`✔upload done in ${performance.now() - st} msec`))
  }
  const nullDiff = {newDL:[],clash:[],ts:[]}
  const dlDiff = React.useRef<ReturnType<typeof idb.diffTags>>( nullDiff)
  async function dl2diff(){
    if(!sbg) return stts('cred not connecting.')
    const ts = await idb.db.tags.toArray()
    let sttr = ''
    stts((sttr = sttr +`downloading `)+'...')
    const dl = await sub.last_sync(sbg)
    dlDiff.current = idb.diffTags(ts, dl)
    const matched = dl.length - dlDiff.current.newDL.length - dlDiff.current.clash.length
    stts((matched === dl.length? 'Same as local, nothing to merge. ':'')
      +`${dlDiff.current.newDL.length} new /w ${dlDiff.current.clash.length} clash `
      + `(${ (matched/dl.length *100).toFixed(1)} % matched) `, "DlDiff")
    if (matched === dl.length) return
    set_showMerge(true)
  }
  async function mergeDiff() {
    if (!dlDiff || !sbg) return
    let sttr = ''
    stts((sttr = sttr +`backup local `)+'...')
    idb.db.bins.put({ key:'bak dl-tags', rec: {date:Date.now()}, bin: fc.encZip(dlDiff.ts)})
    stts((sttr = sttr +`✔. saving ${dlDiff.current.newDL.length} `)+'...')
    idb.db.tags.bulkPut( dlDiff.current.newDL)
    
    stts((sttr = sttr +`✔. upserting ${dlDiff.current.clash.length} clash `)+'...')
    const lastTag = await idb.db.tags.orderBy(':id').last()
    sub.upsRt(dlDiff.current.clash, sbg, lastTag?.tid ?? 1 )
    dlDiff.current = nullDiff
    set_showMerge(false)
    
    stts(`✔ done. `+idb.statStr(), "Saved")
    const estimate = await navigator.storage.estimate();
    console.log(`Total IndexedDB usage: ${estimate.usage?.toLocaleString()} bytes out of quota ${estimate.quota?.toLocaleString()}`);
    // misc hist vecs      
  }
  const ts2up:idb.Tag[] = []
  function ups(ts: idb.Tag[]) {
    ts2up.unshift(...ts)
    if (!sbg) return
    idb.db.tags.orderBy(':id').last().then(last=> 
      sub.upsRt(ts, sbg, last?.tid?? 1).then(()=> ts2up.length = 0))
  }
  async function refreshTag() {
    // set_topTag(await idb.db.tags.where('type').anyOf(['topTag']).toArray())
  }
  return (<div>
    <div style={{position:'fixed', width:'100%', zIndex:1, display: 'flex', flexDirection: 'row', left:0, bottom:0, }}>
    <SideBar tree={tree} onChange_tree={onChange_tree} onFlipSetup={onFlipSetup} 
    download2merge={dl2diff} showMerge={showMerge} mergeDiff={mergeDiff} refreshTag={refreshTag}
    signinfo={signinfo} signinGoogle={signinGoogle} signinWeibo={signinWeibo} signout={signout}
    upSnap={upSnap}
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