import './tw4.css';  // Adjust path if needed
import * as fc from './fc';
import * as tw from './tw';
import * as idb from './idb'
import { SideBar } from './sidebar';
import * as sb from '@supabase/supabase-js';
import { main_animate, canvas, sttsE, setProgress } from './main_animate';
import { createRoot } from 'react-dom/client';
import React, { useEffect, useMemo, useState } from 'react';
import { subRt, upsRt } from './sub';
function stts(str: string) { return sttsE.textContent = str }
async function main() {
  // main_animate();
  setProgress(1, '')
}
main().catch(err => {
  console.error(err);
  sttsE.textContent = 'Initialization failed';
});

function RootFC() {
  const [tree, setTree] = useState<{ [key: string]: unknown; }>(idb.DEF_TREE);
  let sameCred = ''
  const [showGrid, set_showGrid] = useState(false)
  function onChange_tree(key: string, new_value: any) {
    setTree(prev => ({ ...prev, [key]: new_value }));
    idb.db.tree.put({ key, value: new_value })
    .catch(error => {console.error(`Error updating ${key}:`, error);});
  }
  React.useEffect(() => {
    (async()=> {
      const treeData = await idb.db.tree.toArray()
      setTree({...idb.DEF_TREE,...Object.fromEntries(treeData.map(i => [i.key, i.value]))});
      const estimate = await navigator.storage.estimate();
      console.log(`Total IndexedDB usage: ${estimate.usage?.toLocaleString()} bytes out of quota ${estimate.quota?.toLocaleString()}`);
    }) ()
  },[])
  const sbc = useMemo(() => {
    if (tree.cred===idb.DEF_TREE['cred']) return
    if (tree.cred===sameCred) return
    sameCred = tree.cred as string
    const urlAnon = tree.cred as string;
    return sb.createClient(urlAnon.split('|')[0], urlAnon.split('|')[1]
    , {auth:{debug:false}}
  )}, [tree.cred])
  useEffect(()=> {
    if (!sbc) return
    let abort = false
    let channel:any = null
    subRt(sbc).then(c=> {
      if(abort) sbc.removeChannel(c) 
      else channel=c
    })
    return ()=>{abort = true
      if(channel) sbc.removeChannel(channel)}
  }, [sbc])
  async function dl2merge(){
    if(!sbc) return stts('cred not connecting.')
    const fileApi = sbc.storage.from('bb')
    const res = await fileApi.list('', { limit: 11, sortBy: { column: 'created_at', order: 'desc' } });
    
    const obj = res.data?.filter((o: { name: string; })=> o.name.startsWith('tags'))[0].name as string
    const ts = await idb.db.tags.toArray()
    let sttr = ''
    fc.stts((sttr = sttr +`✔. local backup`)+'...')
    idb.db.bins.put({ key:'bak dl-tags', rec: {date:Date.now()}, bin: fc.encZip(ts)})
    const {newDL, clash} = idb.diffTags(ts, await fc.dl(fileApi, obj))
    
    fc.stts((sttr = sttr +`✔. saving ${newDL.length} with-holding ${clash.length} tid-clash`)+'...')
    idb.db.tags.bulkPut( newDL)
    fc.stts((sttr = sttr +`✔. upserting clash... `)+'')

    const lastTag = await idb.db.tags.orderBy(':id').last()
    upsRt(clash, sbc, lastTag?.tid ?? 1 )
    stts(`✔ done decode bulkPut ${newDL.length} new DL with ${clash.length} clash upserted`)
    const estimate = await navigator.storage.estimate();
    console.log(`Total IndexedDB usage: ${estimate.usage?.toLocaleString()} bytes out of quota ${estimate.quota?.toLocaleString()}`);
    // misc hist vecs      
  }
  return (<div>
    <div style={{position:'fixed', zIndex:1, display: 'flex', flexDirection: 'row', left:0, bottom:0, }}>
    <SideBar tree={tree} onChange_tree={onChange_tree} download2merge={dl2merge} 
    flipGrid={()=>set_showGrid(!showGrid)}/> 
    </div>
    <div style={{position:'fixed', inset:0}}>
    <tw.CelestialGridViewer showGrid={showGrid} set_showGrid={set_showGrid} /> 
    </div>
    </div>)
}
const container = document.getElementById('root');
if (!container) throw new Error('Failed to find the root element');
createRoot(container).render(  <React.StrictMode> 
  <RootFC/>
</React.StrictMode>);


