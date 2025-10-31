import { useState } from 'react';
import { Settings, FileJson, Search, GitBranch, ChevronLeftCircle } from 'lucide-react';
import * as idb from '../../tab/src/idb'
import * as fc from '../../tab/src/fc'
import React from 'react';

export const HF_OR = [
  'jinaai/jina-embeddings-v2-base-zh',
  'TownsWu/PEG',
  'Classical/Yinka',
  'BAAI/bge-large-zh-v1.5',
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

export default function SideBar() {
  const [tree, setTree] = useState<{ [key: string]: unknown; }>(idb.DEF_TREE);
  const [showSetup, setShowSetup] = useState(false);
  const BTN_SIZE = 33

  React.useEffect(() => {
    (async()=> {
      const treeData = await idb.db.tree.toArray()
      setTree({...idb.DEF_TREE,...Object.fromEntries(treeData.map(i => [i.key, i.value]))});
      
    }) ()
  },[])

  React.useEffect(()=> {
      fc.input2options('input-tree-emb_model-HF',HF_OR);
  }, [showSetup])
  
  const handleTreeChange = (key: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setTree(prev => ({ ...prev, [key]: e.target.value }));
    idb.db.tree.put({ key, value: e.target.value })
    .catch(error => {console.error(`Error updating ${key}:`, error);});
  };

  return (
    <div >
      {/* Sidebar */}
        <aside >
        {showSetup && <button onClick={() => setShowSetup(false)}><ChevronLeftCircle size={BTN_SIZE} /></button>}
        <button onClick={() => setShowSetup(!showSetup)}><Settings size={BTN_SIZE} /></button>
        <button><FileJson size={BTN_SIZE} /></button>
        <button><Search size={BTN_SIZE} /></button>
        <button><GitBranch size={BTN_SIZE} /></button>
      {/* </div> */}
      </aside>

      {/* Setup Pane */}
      {showSetup && (
        <div >
          <h3 >Setup</h3>
          {Object.entries(tree).map(([key, value]) => (
            <div key={key} >
              <label htmlFor={`input-tree-${key}`}> [{key}] </label>
              <input
                id={`input-tree-${key}`}type="search"
                value={value as string}
                onChange={handleTreeChange(key)}
              />
            </div>
          ))}
        </div>
      )}

    </div>
  );
}