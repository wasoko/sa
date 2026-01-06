import React, { RefObject, useEffect, useRef, useState } from 'react';
import { motion, PanInfo } from 'framer-motion';
export function DragTag({current, options, onSelect, onLeft=()=>{}, replace: canReplace=false}
  :{current:string, options:string[]
    , onSelect:(item:string, prev:string)=>void
    , onLeft?:(item:string)=>void, replace?:boolean }){
  const [isOpen, setIsOpen] = useState(false);
  const [isLeft, set_isLeft] = useState(false);
  const [selected, setSelected] = useState(current);
  const ref = useRef<HTMLDivElement>(null)
  useClickOutside(ref, ()=>setIsOpen(false))
  // Selection logic for release
  const handleReleaseSelect = (item: string) => {
    if (onSelect) onSelect(item, selected)
    if (canReplace) setSelected(item);
    setIsOpen(false);
  };
  // Logic for horizontal swipe action
  const X_LEFT = -100
  const handleDragEnd = (_: any, info: PanInfo) => {
    if (info.offset.x < X_LEFT)
      onLeft(current);
    setIsOpen(false);
    set_isLeft(false)
  };
  return (
    <div ref={ref} style={{ display: 'flex' }}>
      <button onClick={()=>onLeft(current)}>🖉</button>{isLeft && "..."} {" "}
      <motion.button // Trigger: Opens on press down
        onPointerDown={() => setIsOpen(true)}
        // Capture horizontal swipe
        drag="x" dragConstraints={{ left: 0, right: 0 }} dragElastic={0.2}
        onDragEnd={handleDragEnd} whileTap={{ scale: 0.9 }}
        onDrag={(_,i)=> set_isLeft(i.offset.x < X_LEFT)}
        style={{ width: '100%', padding: '12px', cursor: 'grab' }} >
        {selected}
      </motion.button>
      {isOpen && (
        <motion.div style={{ position: 'fixed',top:'55px',zIndex: 20 }}
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }} > 
          {options.map((item) => ( <div key={item}
              // Selection: Triggers on pointer release
              onPointerUp={() => handleReleaseSelect(item)}
              style={{ padding: '12px', borderBottom: '1px solid #eee' }} >
              {item} </div>
          ))} </motion.div>
      )} </div>
  );
};

function useClickOutside ( ref: RefObject<HTMLElement | undefined>,
  callback: () => void, addEventListener = true,){
  function handleClick (event: MouseEvent) {
    if (ref.current && !ref.current.contains(event.target as HTMLElement))
      callback()
  }
  useEffect(() => {
    if (addEventListener)
      document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  })
} // https://coreui.io/blog/how-to-detect-a-click-outside-of-a-react-component/

export default DragTag;
