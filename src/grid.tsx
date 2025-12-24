
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
// import { MinimalTextRank, textRankRobust } from '../textrank';

// Define the shape of your data
export interface HiRow { txt: string;sts?: string[];}
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
export function useHiRows(tags: string[], search: string = '') {
  return useLiveQuery(
    async () => {
      // 1. Start with the most restrictive indexed field
      let query = idb.db.tags.toCollection();
      // 2. Filter by tags (using index if 'tags' is a MultiEntry index)
      if (tags.length > 0) {
        query = idb.db.tags.where('sts').anyOf(tags);
      }
      // 3. Apply secondary filters (full AND for tags + text search)
      return await query
        .and(row => {
          // All selected tags must be present (AND logic)
          const matchesTags = tags.every(tag => row.sts?.includes(tag));
          // Text search in 'txt' field (case-insensitive)
          const matchesSearch = row.txt.toLowerCase().includes(search.toLowerCase());
          return matchesTags && matchesSearch;
        })
        .limit(555)
        .toArray().then(ts=> ts.map(t=>({txt:t.txt, sts:t.sts})as HiRow));
    },  [tags, search], [] //re-run when tags or search change, default [] empty prevent undefined
  );
}
// ──────── Highlighted text (unchanged) ────────
const HighlightedText: React.FC<{ text: string; phrases: string[] }> = ({ text, phrases }) => {
  if (!phrases.length) return <>{text}</>;

  const escaped = phrases.map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const regex = new RegExp(`(${escaped.join('|')})`, 'gi');

  return (
    <>
      {text.split(regex).map((part, i) =>
        regex.test(part) ? (
          <span
            key={i}
            style={{
              backgroundColor: '#4ecdc4',
              color: 'white',
              padding: '3px 8px',
              borderRadius: '6px',
              fontWeight: 500,
            }}
          >
            {part}
          </span>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
};
export const scrollToElement = (tbodyRef: React.RefObject<HTMLTableSectionElement>, n:number) => {
  if (tbodyRef.current && tbodyRef.current.children.length >0) {
    const i = n>=0? n: tbodyRef.current.children.length +n
    const scrollableElement = tbodyRef.current.children[i] as HTMLElement;
    scrollableElement.scrollIntoView({behavior: 'smooth',block:'nearest'});
  }
};
export function ListTx() {
  const [search, setSearch] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [sorting, setSorting] = useState<SortingState>([]);
  const rows = useHiRows(selectedTags, search);

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
  const columns =  // createColumnHelper<HiRow>()
  useMemo(() => [createColumnHelper<HiRow>().accessor('txt', {
        cell: ({ row }) => (
          <HighlightedText text={row.original.txt} phrases={row.original.sts??[]} />
        ), }),], [search, selectedTags]);

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
  return ( <div style={{overflowY:'auto',WebkitOverflowScrolling: 'touch', height:'100%' }}>  {/* Table */}
      <div><table> {/* Custom Header Bar */}
      <thead style={{position: 'sticky', top:'0',zIndex: 10
        ,}}><tr><th><div  style={{ display: 'flex', flexDirection: 'row', gap: '10px'}}> {/* Search Input */}
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
          ))} </div> </div></th></tr></thead>
      <tbody>{table.getRowModel().rows.map(row => (
        <tr key={row.id}>{row.getVisibleCells().map(cell => (
          <td key={cell.id}>
            {flexRender(cell.column.columnDef.cell, cell.getContext())}
          </td>
        ))}</tr>
      ))}</tbody></table></div> </div>
  );
}
