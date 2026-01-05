
import React, { forwardRef, useEffect, useMemo, useRef, useState } from 'react';
import { motion, PanInfo } from 'framer-motion';
import { useLiveQuery } from 'dexie-react-hooks';
// import * as yake from 'yake-wasm'
import {  flexRender,createColumnHelper,useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  SortingState,
} from '@tanstack/react-table'; // ColumnDef,ColumnFiltersState,getFilteredRowModel,
import * as idb from './idb'
import { markdown2tab, stts, useDebounce } from './fc';
import { useNavigate, useParams } from 'react-router-dom';
import { upsRt } from './sub';
import DragTag from './dragTag';
// import { MinimalTextRank, textRankRobust } from '../textrank';
// Define the shape of your data
interface HiRow { txt: string; ref?:string; sts?: string[]; locTid?:number}
// input: h in [0,360] and s,v in [0,1] - output: r,g,b in [0,1]
function hsl2rgb(h,s,l) 
{ // https://stackoverflow.com/a/54014428/1773507
  let a= s *Math.min(l, 1-l);
  let f= (n:number ,k=(n +h /30) %12) => Math.floor(256* ( l - a *Math.max(Math.min(k-3 ,9-k ,1),-1) ))
  // return [f(0),f(8),f(4)];
  const toHex = (n: number) => n.toString(16).padStart(2, "0").toUpperCase();
  return `#${toHex( f(0))}${toHex( f(8))}${toHex( f(4))}`
}   
const getColorChar11 = (phrase: string) => {
  const hash = phrase.split('').slice(0,11).reduce((acc, char) => acc + char.charCodeAt(0), 0);
  //const colors = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#ffeead'];
  return hsl2rgb(hash%360, .8, .2) //colors[hash % colors.length];
};
function useLiveTop(){
  return useLiveQuery( async()=> await idb.db.tags.where('type').anyOf(['topTag']).toArray()
  , [], [])
}
// Custom React hook that provides a live-updating array of rows
// based on the given tags and search parameters.
// It automatically re-queries and updates whenever:
// - The parameters (tags or search) change
// - Relevant data in the database changes
function useHiRows(search:string,tags:string[],locTid?:number) {
  return useLiveQuery(
    async () => {
      // 1. Start with the most restrictive indexed field
      let query = idb.db.tags.toCollection();
      // 2. Filter by tags (using index if 'tags' is a MultiEntry index)
      if (tags.length > 0) {
        query = idb.db.tags.where('sts').anyOf(tags);
      } 
      if (search!=="") query = query  // js custom scan (no index)
        .and(row => {
          // All selected tags must be present (AND logic)
          const matchesTags = tags.every(tag => row.sts?.includes(tag));
          // Text search in 'txt' field (case-insensitive)
          const rowText = row.txt.toLowerCase();
          const terms = (search.match(/"[^"]*"|[^\s]+/g) || [])
            .map(str => str.replace(/^"|"$/g, '').trim().toLowerCase())
          const matchesSearch = terms.every(term => rowText.includes(term));
          return matchesTags && matchesSearch;
        })
      else if (locTid==-1) 
        return (await query.reverse().limit(222).toArray()).reverse() as HiRow[]
      else if (locTid) 
        return (await idb.getRowsAroundTid(locTid, 33)) as HiRow[]
      // 3. Apply secondary filters (full AND for tags + text search)
      const res = await query.limit(555).toArray()
      return res.map(t=>({txt:t.txt, sts:t.sts, ref:t.ref, locTid:t.tid})as HiRow)
    },  [search,tags,locTid], [] //re-run when tags or search change, default [] empty prevent undefined
  );
}

// ──────── Highlighted text (unchanged) ────────
function HighlightedText ({ txt, sts, ref, locTid, locFn }:{ 
  txt: string, sts: string[], ref?: string, locTid?:number, locFn }) {
  // if (!sts.length) return <>{txt}</>;
  const escaped = sts.map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const regex = new RegExp(`(${escaped.join('|')})`, 'gi');
  return ( <div> {locTid && <button onClick={()=>{locFn(locTid)}}>...</button>}
      {sts.length==0? txt : txt.split(regex).map((part, i) =>
        regex.test(part) ? (<span style={{ 
          backgroundColor: getColorChar11(part),color: 'white' 
          , cursor: 'default', margin: '0 2px', borderRadius: '4px', padding: '2px 6px'
            }} key={i}> {part} </span>) : (<span key={i}>{part}</span>)
      )}<a href={ref}>🔗</a></div>);
};
export function ListTx({ups, textRef}) {
  const [search, setSearch] = useState('');
  const [locTid, set_locTid] = useState(-1);
  const [showEditTag, set_showEditTag] = useState(false)
  const [tag2edit, set_tag2edit] = useState<idb.Tag>()
  const { '*': currentTagsPath } = useParams<{ '*': string }>();
  const selectedTags = useMemo(() => 
    currentTagsPath?.split('/').filter(Boolean) || []
  , [currentTagsPath]);
  const navigate = useNavigate();  
  const [sorting, setSorting] = useState<SortingState>([]);
  const debSearch = useDebounce(search)
  const rows = useHiRows(debSearch, selectedTags, locTid);
  const ttag = useLiveQuery( async()=> 
    (await idb.db.tags.where('type').anyOf(['topTag','tag']).sortBy('dt')).map(t=>t.ref)
  , [], [])
  function loc(tid:number) {setSearch(""); set_locTid(tid);  navigate('/')}
  const columns =  // createColumnHelper<HiRow>()
  useMemo(() => [createColumnHelper<HiRow>().accessor('txt', {
        cell: ({ row }) => (
          <HighlightedText txt={row.original.txt} sts={row.original.sts??[]}
          ref={row.original.ref} locTid={row.original.locTid} locFn={loc} />
        ), }),], [debSearch, selectedTags, locTid]);
  async function addTag(str:string){
    if (selectedTags.includes(str))return
    let t = await idb.db.tags.get({ref:str, type:'tag'})
    if (!t) {
      t={ref:str, type:'tag', txt:str+`: `, sts:[str], dt:new Date()}
      idb.db.tags.add(t)
      t = await idb.db.tags.get({ref:str, type:'tag'})
      ups([t])
    }
    navigate(str)
  }
  async function editTag(item:string, ) {
    let t = await idb.db.tags.get({ref:item, type:'tag'})
    if (!t) stts(`tag missing from indexDB`)
    set_tag2edit(t)
    set_showEditTag(true)
  }
  function repTag(item:string, prev:string) {
    if(item==='[Pinned]') item=''
    if (selectedTags.includes(item))return
    navigate(('/'+selectedTags.filter(s=>s!==prev).concat(item).join('/')))
  }
  // Handler for Ctrl+V (Keyboard Paste)
  function handlePaste(event: ClipboardEvent){
    const pastedText = event.clipboardData?.getData('text/plain');
    if (!pastedText) return stts('cannot read pasted text')
    const ts = markdown2tab(pastedText).map(m=> ({type:'tab',txt:m.txt, ref:m.ref, sts:['markdown','pasted']})as idb.Tag)
    if (ts.length===0) return stts('no markdown [title](url) in '+pastedText.slice(0,33)+'...')
    idb.db.tags.bulkPut(ts).then(()=> stts(`${ts.length} urls saved.`))
  }
  useEffect(()=> {
    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [])
  const table = useReactTable({
    data:rows,
    columns,
    state: {
      sorting,
    },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });
  return ( <div style={{ height:'100%',  }}>  {/* Table WebkitOverflowScrolling: 'touch',*/}
      <div  style={{ overflowX:'auto', display: 'flex', flexDirection: 'row', gap: '10px'}}>
        {showEditTag ? <div style={{flexGrow:1, minWidth:'111px'}}>{tag2edit && tag2edit.ref+':'} <input type="text" 
          value={search} placeholder='(related tags) tag1 tag2 "tag 3" '
          // onChange={e => setSearch(e.target.value)}
          onKeyDown={e=> {
            if(e.key==='Escape') set_showEditTag(false)
            if(e.key!=='Enter') return
          }} /> </div>
          :
          <input type="text" style={{flexGrow:1, minWidth:'111px'}}
          value={search} placeholder="Search... (Enter to tag, Down for history)"
          onChange={e => setSearch(e.target.value)}
          onKeyDown={e=> {
            if(e.key!=='Enter') return
            if(rows.length==0) return
            addTag(e.currentTarget.value)
            e.currentTarget.value = ''
          }} />}
        <div style={{display:'flex', flexDirection:'row', gap: '15px'}}>
          {selectedTags.map(selTag =>
            <DragTag current={selTag} key={selTag} options={['[Pinned]',...ttag]}
             onSelect={repTag} onLeft={editTag} replace={true}/>
                )} <DragTag current='[Related]' options={ttag} onSelect={(i, p)=> addTag(i)} />
                <DragTag current='[Add]' options={ttag} onSelect={(i, p)=> addTag(i)} />
            </div> 
      </div>
      <div style={{overflowX: 'hidden', height:'100%'}}><table> {/* Custom Header Bar */}
      <tbody>{table.getRowModel().rows.map(row => (
        <tr key={row.id}>{row.getVisibleCells().map(cell => (
          <td key={cell.id}> {flexRender(cell.column.columnDef.cell, cell.getContext())}
          </td>
        ))}</tr>
      ))}</tbody></table></div> </div>
  );
}
