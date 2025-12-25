import { useState } from 'react';
import { Settings, Sheet, Search, GitBranch, ChevronLeftCircle } from 'lucide-react';
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

export function SideBar({tree, onChange_tree, download2merge, flipGrid}) {
  const [showSetup, setShowSetup] = useState(false);
  const BTN_SIZE = '77px'
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
          <AsyncButton onClick={download2merge}>Download</AsyncButton>
          </div>)} 
      <aside >
        {showSetup && <button onClick={() => setShowSetup(false)} title={"<"}><ChevronLeftCircle size={BTN_SIZE} /></button>}
        <button title="Set" onClick={() => setShowSetup(!showSetup)}><Settings size={BTN_SIZE} /></button>
        <button title='Grid' onClick={flipGrid} ><Sheet size={BTN_SIZE} /></button>
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
    try {      // Execute the passed function and wait for it to resolve
      await onClick(e);
    } catch (error) {
      console.error("Process failed:", error);
    } finally { setIsLoading(false)}
  };
  return ( <button {...props} 
    onClick={handleClick}  disabled={isLoading || props.disabled}>
    {/* Use a fragment to wrap children and text safely */}
    {isLoading ? <>{children} {loadingText}</> : children}
    </button>
  );
};
