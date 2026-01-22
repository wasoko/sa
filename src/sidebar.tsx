import { useState } from 'react';
import { Settings, Sheet, Search, GitBranch, ChevronLeftCircle, RefreshCcwDot } from 'lucide-react';
import React from 'react';
import { DEF_TREE } from './idb';

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

export function SideBar({tree, onChange_tree, onFlipSetup
  , download2merge, showMerge, mergeDiff, signinfo, signinGoogle, signinWeibo,signout
  , upSnap, flipGrid, showGrid, refreshTag}) {
  const [showSetup, setShowSetup] = useState(false);
  const BTN_SIZE = '33px'
  React.useEffect(()=> {
      // fc.input2options('input-tree-emb_model-HF',HF_OR);
      onFlipSetup(showSetup)
  }, [showSetup])
  
  const handleTreeChange = (key: string) => (e: React.ChangeEvent<HTMLInputElement>) => 
    onChange_tree(key, e.target.value)

  return (
    <div style={{width:'100%'}}>
      {/* Setup Pane */}
      {showSetup && (<div style={{background: 'rgba(0,0,0, 0.8)', padding:22, overflow:'auto',maxHeight:'77vh'}}>
          <h3 >Settings</h3>
          {signinfo===''? <AsyncButton onClick={signinGoogle}>Google</AsyncButton>
          : <div>{signinfo} <AsyncButton onClick={signout}>Sign-out</AsyncButton></div> }
          {Object.entries(tree).map(([key, value]) => (
            <div key={key} style={{flexDirection:'row',display:'flex'}}>
              <label htmlFor={`input-tree-${key}`}> [{key}] </label>
              <input id={`input-tree-${key}`}type="search"
                value={value as string}
                placeholder={`${DEF_TREE[key]}`}
                onChange={handleTreeChange(key)}
                style={{flexGrow:1}} />
            </div> ))} 
          <pre id="sttsSignin"/>
          <pre id="sttsSync"/>
          <AsyncButton key="dl" onClick={download2merge}>Download</AsyncButton>
          <pre id="sttsDlDiff"/>
          {showMerge && <AsyncButton key="merge" onClick={mergeDiff}>☁️ Merge</AsyncButton>}
          <pre id="sttsSaved"/>
          <AsyncButton key="upSnap" onClick={upSnap}>☁️ Upload</AsyncButton>
          <pre id="sttsTagged"/>
          </div>)} 
      <aside style={{display:'flex', overflowX:'auto'}}>
        {showSetup && <button onClick={() => setShowSetup(false)} title={"<"}><ChevronLeftCircle size={BTN_SIZE} /></button>}
        <button title="Refresh" onClick={refreshTag}><RefreshCcwDot style={{ transform: 'scaleX(-1)'}} size={BTN_SIZE} /></button> 
        <button title='Grid' className={showGrid?'selected':''} onClick={flipGrid} ><Sheet size={BTN_SIZE} /></button>
        <button title="Set" onClick={() => setShowSetup(!showSetup)}><Settings size={BTN_SIZE} /></button>
        <button><Search size={BTN_SIZE} /></button>
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
