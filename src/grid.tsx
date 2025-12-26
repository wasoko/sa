
import React, { forwardRef, useEffect, useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
// import * as yake from 'yake-wasm'
import {  flexRender,createColumnHelper,useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  SortingState,
} from '@tanstack/react-table'; // ColumnDef,ColumnFiltersState,getFilteredRowModel,
import * as idb from './idb'
import * as sq from './sq.types'
import { useDebounce } from './fc';
// import { MinimalTextRank, textRankRobust } from '../textrank';

// Define the shape of your data
export interface HiRow { txt: string;sts?: string[]; locTid?:number}
interface AtomQuery {search:string,tags:string[],locTid?:number}
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
// Custom React hook that provides a live-updating array of rows
// based on the given tags and search parameters.
// It automatically re-queries and updates whenever:
// - The parameters (tags or search) change
// - Relevant data in the database changes
export function useHiRows(search:string,tags:string[],locTid?:number) {
  return useLiveQuery(
    async () => {
      // 1. Start with the most restrictive indexed field
      let query = idb.db.tags.toCollection();
      // 2. Filter by tags (using index if 'tags' is a MultiEntry index)
      if (tags.length > 0) {
        query = idb.db.tags.where('sts').anyOf(tags);
      } else if (search!=="") query = query  // js custom scan (no index)
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
        return (await query.reverse().limit(555).toArray()) as HiRow[]
      else if (locTid) 
        return (await idb.getRowsAroundTid(locTid, 33)) as HiRow[]
      // 3. Apply secondary filters (full AND for tags + text search)
      return (await query.limit(555).toArray()
        ).map(t=>({txt:t.txt, sts:t.sts, locTid:t.tid})as HiRow);
    },  [search,tags,locTid], [] //re-run when tags or search change, default [] empty prevent undefined
  );
}
// ──────── Highlighted text (unchanged) ────────
const HighlightedText: React.FC<{ txt: string; sts: string[], locTid?:number, locFn }> 
= ({ txt: txt, sts: sts, locTid:locTid, locFn:locFn }) => {
  if (!sts.length) return <>{txt}</>;
  const escaped = sts.map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const regex = new RegExp(`(${escaped.join('|')})`, 'gi');
  return ( <div> {locTid && <button onClick={()=>{locFn(locTid)}}>…</button>}
      {txt.split(regex).map((part, i) =>
        regex.test(part) ? (<span style={{ 
          backgroundColor: getColorChar11(part),color: 'white' 
          , cursor: 'default', margin: '0 2px', borderRadius: '4px', padding: '2px 6px'
            }} key={i}> {part} </span>) : (<span key={i}>{part}</span>)
      )}</div>);
};
export const scrollToElement = (tbodyRef: React.RefObject<HTMLTableSectionElement>, n:number) => {
  if (tbodyRef.current && tbodyRef.current.children.length >0) {
    const i = n>=0? n: tbodyRef.current.children.length +n
    const scrollableElement = tbodyRef.current.children[i] as HTMLElement;
    scrollableElement.scrollIntoView({behavior: 'smooth',block:'nearest'});
  }
};
export function ListTx() {
  const [aQuery, set_aQuery] = useState<AtomQuery>({search:"",tags:[]})
  const [search, setSearch] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [locTid, set_locTid] = useState(-1);
  const [sorting, setSorting] = useState<SortingState>([]);
  const debSearch = useDebounce(search)
  
  const rows = useHiRows(debSearch, selectedTags, locTid);

  // Configuration for slicers
  const slicers = [
    { name: 'Role', tags: ['Admin', 'Editor', 'Viewer'] },
    { name: 'Status', tags: ['Active', 'Pending', 'Archived'] },
  ];
  const toggleTag = (tag: string) => {
    setSelectedTags(prev => prev.includes(tag) 
      ? prev.filter(t => t !== tag) 
      : [...prev, tag]
    );
  };
  function loc(tid:number) {setSearch(""); set_locTid(tid);  setSelectedTags([])}
  const columns =  // createColumnHelper<HiRow>()
  useMemo(() => [createColumnHelper<HiRow>().accessor('txt', {
        cell: ({ row }) => (
          <HighlightedText txt={row.original.txt} sts={row.original.sts??[]}
          locTid={row.original.locTid} locFn={loc} />
        ), }),], [aQuery]);

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
        <input type="text" style={{flexGrow:1, minWidth:'111px'}}
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search..." />
        <div style={{display:'flex', flexDirection:'row', gap: '15px'}}>
          {slicers.map(slicer => (<div key={slicer.name} style={{display:'flex', flexDirection:'row', alignItems:'center', gap:'5px'}}>
            <span style={{fontSize:'12px', fontWeight:'bold'}}>{slicer.name}:</span>
            {slicer.tags.map(tag => (<button key={tag} onClick={() => toggleTag(tag)}
                  style={{padding:'2px 5px', fontSize:'11px',
                    backgroundColor: selectedTags.includes(tag) ? '#007bff' : '#eee',
                    color: selectedTags.includes(tag) ? 'white' : 'black'
                  }}>{tag}</button>
                ))}</div>
          ))} </div> </div>
      <div style={{overflowX: 'hidden', height:'100%'}}><table> {/* Custom Header Bar */}
      <tbody>{table.getRowModel().rows.map(row => (
        <tr key={row.id}>{row.getVisibleCells().map(cell => (
          <td key={cell.id}>
            {flexRender(cell.column.columnDef.cell, cell.getContext())}
          </td>
        ))}</tr>
      ))}</tbody></table></div> </div>
  );
}
