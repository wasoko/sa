import { useState } from 'react';
import { Settings, FileJson, Search, GitBranch, ChevronLeftCircle } from 'lucide-react';
import * as fc from './fc'
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

export function SideBar({tree, onChange_tree, download2merge}) {
  const [showSetup, setShowSetup] = useState(false);
  const BTN_SIZE = '44px'
  React.useEffect(()=> {
      // fc.input2options('input-tree-emb_model-HF',HF_OR);
  }, [showSetup])
  
  const handleTreeChange = (key: string) => (e: React.ChangeEvent<HTMLInputElement>) => 
    onChange_tree(key, e.target.value)

  return (
    <div > {/* Sidebar */} 
      {/* Setup Pane */}
      {showSetup && (
        <div >
          <h3 >Settings</h3>
          {Object.entries(tree).map(([key, value]) => (
            <div key={key}>
              <label htmlFor={`input-tree-${key}`}> [{key}] </label>
              <input id={`input-tree-${key}`}type="search"
                value={value as string}
                onChange={handleTreeChange(key)} />
            </div> ))} 
          <button onClick={download2merge}>Download</button>
          </div>)} 
      <aside >
        {showSetup && <button onClick={() => setShowSetup(false)} title={"<"}><ChevronLeftCircle size={BTN_SIZE} /></button>}
        <button title={"Set"} onClick={() => setShowSetup(!showSetup)}><Settings size={BTN_SIZE} /></button>
        <button><FileJson size={BTN_SIZE} /></button>
        <button><Search size={BTN_SIZE} /></button>
        <button><GitBranch size={BTN_SIZE} /></button> 
      </aside>
    </div>
  );
}


const AsyncButton = ({ onClick, children, loadingText = "…", ...props }) => {
  const [isLoading, setIsLoading] = useState(false);

  const handleClick = async (e) => {
    setIsLoading(true);
    try {
      // Execute the passed function and wait for it to resolve
      await onClick(e);
    } catch (error) {
      console.error("Process failed:", error);
    } finally {
      // Re-enable the button regardless of success or failure
      setIsLoading(false);
    }
  };

  return (
    <button 
      {...props} 
      onClick={handleClick} 
      disabled={isLoading || props.disabled}
    >
      {isLoading ? children+loadingText : children}
    </button>
  );
};
