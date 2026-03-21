import React, { useRef, useState } from 'react';
import { EditorElement } from '../types';
import { AlignJustify, Plus } from 'lucide-react';

interface CanvasElementProps {
  element: EditorElement;
  isSelected: boolean;
  onSelect: (id: string | null, isShift: boolean) => void;
  onUpdate: (ids: string[], updates: Partial<EditorElement>) => void;
  onDragMove?: (id: string, x: number, y: number) => { x: number, y: number };
  onDragEnd?: () => void;
  zoom: number;
  isSpacePressed?: boolean;
}

const CanvasElement: React.FC<CanvasElementProps> = ({ element, isSelected, onSelect, onUpdate, onDragMove, onDragEnd, zoom, isSpacePressed }) => {
  const elementRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  
  // Drag State
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [initialOffset, setInitialOffset] = useState({ x: 0, y: 0 });
  
  // Refs for click vs drag detection
  const hasMoved = useRef(false);
  const wasSelectedOnDown = useRef(false);
  
  // Resize State
  const [isResizing, setIsResizing] = useState(false);
  const [resizeHandle, setResizeHandle] = useState<string | null>(null);
  const [initialSize, setInitialSize] = useState({ w: 0, h: 0, x: 0, y: 0 });

  // Hover State for Effect Preview
  const [isHovered, setIsHovered] = useState(false);

  // Navigation Menu State (for Hamburger)
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // --- Dragging Logic ---
  const handlePointerDown = (e: React.PointerEvent) => {
    // If Space is pressed, let the event pass through to the wrapper for panning
    if (isSpacePressed) return;

    e.stopPropagation();
    if (e.button !== 0) return;
    
    // Capture state at start
    hasMoved.current = false;
    wasSelectedOnDown.current = isSelected;

    // If not selected, select immediately to allow seeing props/handles
    if (!isSelected) {
        onSelect(element.id, e.shiftKey);
    }
    
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
    setInitialOffset({ x: element.x, y: element.y });
    
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (isDragging) {
      // Check for movement threshold
      const dist = Math.hypot(e.clientX - dragStart.x, e.clientY - dragStart.y);
      if (dist > 3) {
          hasMoved.current = true;
      }
      
      // Only move if threshold passed (prevents jitter on pure clicks)
      if (hasMoved.current) {
          const dx = (e.clientX - dragStart.x) / zoom;
          const dy = (e.clientY - dragStart.y) / zoom;
          
          let newX = initialOffset.x;
          let newY = initialOffset.y;

          if (element.anchorX === 'left') newX += dx;
          else if (element.anchorX === 'right') newX -= dx;
          else if (element.anchorX === 'center') newX += dx; 

          if (element.anchorY === 'top') newY += dy;
          else if (element.anchorY === 'bottom') newY -= dy;
          else if (element.anchorY === 'center') newY += dy;

          if (onDragMove) {
              onDragMove(element.id, Math.round(newX), Math.round(newY));
          } else {
              onUpdate([element.id], {
                x: Math.round(newX),
                y: Math.round(newY)
              });
          }
      }
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (isDragging) {
      setIsDragging(false);
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      
      if (onDragEnd) onDragEnd();

      // Toggle off if it was a click on an already selected element
      if (!hasMoved.current && wasSelectedOnDown.current) {
          onSelect(element.id, e.shiftKey);
      }
    }
  };

  // --- Resizing Logic ---
  const handleResizeStart = (e: React.PointerEvent, handle: string) => {
    // If Space is pressed, ignore resizing
    if (isSpacePressed) return;

    e.stopPropagation();
    e.preventDefault();
    setIsResizing(true);
    setResizeHandle(handle);
    setDragStart({ x: e.clientX, y: e.clientY });
    setInitialSize({ w: element.width, h: element.height, x: element.x, y: element.y });
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handleResizeMove = (e: React.PointerEvent) => {
    if (!isResizing) return;
    e.stopPropagation();

    const dx = (e.clientX - dragStart.x) / zoom;
    const dy = (e.clientY - dragStart.y) / zoom;
    
    let newWidth = initialSize.w;
    let newHeight = initialSize.h;
    let newX = initialSize.x;
    let newY = initialSize.y;

    const padding = element.style.padding || 0;
    const minW = contentRef.current ? contentRef.current.scrollWidth + (padding * 2) : 20;
    const minH = contentRef.current ? contentRef.current.scrollHeight + (padding * 2) : 20;

    if (resizeHandle?.includes('e')) {
        newWidth = Math.max(minW, initialSize.w + dx);
    }
    if (resizeHandle?.includes('s')) {
        newHeight = Math.max(minH, initialSize.h + dy);
    }
    if (resizeHandle?.includes('w')) {
        const requestedWidth = initialSize.w - dx;
        newWidth = Math.max(minW, requestedWidth);
        const actualChange = newWidth - initialSize.w;
        if (element.anchorX === 'left') {
             newX = initialSize.x - actualChange;
        } else if (element.anchorX === 'center') {
             newX = initialSize.x - (actualChange / 2);
        }
    }
    if (resizeHandle?.includes('n')) {
        const requestedHeight = initialSize.h - dy;
        newHeight = Math.max(minH, requestedHeight);
        const actualChange = newHeight - initialSize.h;
        if (element.anchorY === 'top') {
             newY = initialSize.y - actualChange;
        } else if (element.anchorY === 'center') {
             newY = initialSize.y - (actualChange / 2);
        }
    }

    onUpdate([element.id], {
        width: Math.round(newWidth),
        height: Math.round(newHeight),
        x: Math.round(newX),
        y: Math.round(newY)
    });
  };

  const handleResizeUp = (e: React.PointerEvent) => {
    if (isResizing) {
        setIsResizing(false);
        setResizeHandle(null);
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    }
  };

  // --- Transform Construction with Hover Effect ---
  let baseTransform = `
      ${element.anchorX === 'center' ? 'translateX(-50%)' : ''} 
      ${element.anchorY === 'center' ? 'translateY(-50%)' : ''}
  `.trim();

  let finalTransform = baseTransform;
  
  if (isHovered && !isDragging && !isResizing && !isSpacePressed) {
      if (element.hoverEffect === 'scale') {
          finalTransform += ' scale(1.05)';
      } else if (element.hoverEffect === 'lift') {
          finalTransform += ' translateY(-4px)';
      }
  }

  // Shadow calculation for lift effect
  let finalBoxShadow = element.style.boxShadow;
  if (isHovered && !isDragging && !isResizing && element.hoverEffect === 'lift') {
      // Add a stronger shadow for lift
      finalBoxShadow = finalBoxShadow ? `${finalBoxShadow}, 0 10px 20px rgba(0,0,0,0.15)` : '0 10px 20px rgba(0,0,0,0.15)';
  }

  // --- Style Construction ---
  const style: React.CSSProperties = {
    position: 'absolute',
    width: `${element.width}px`,
    height: `${element.height}px`,
    left: element.anchorX === 'left' ? `${element.x}px` : element.anchorX === 'center' ? '50%' : undefined,
    right: element.anchorX === 'right' ? `${element.x}px` : undefined,
    top: element.anchorY === 'top' ? `${element.y}px` : element.anchorY === 'center' ? '50%' : undefined,
    bottom: element.anchorY === 'bottom' ? `${element.y}px` : undefined,
    
    transform: finalTransform,
    boxSizing: 'border-box',
    marginLeft: element.anchorX === 'center' 
      ? `${element.x + (element.style.margin || 0)}px` 
      : (element.style.margin ? `${element.style.margin}px` : undefined),
    marginTop: element.anchorY === 'center' 
      ? `${element.y + (element.style.margin || 0)}px` 
      : (element.style.margin ? `${element.style.margin}px` : undefined),
    marginRight: element.style.margin ? `${element.style.margin}px` : undefined,
    marginBottom: element.style.margin ? `${element.style.margin}px` : undefined,

    backgroundColor: element.style.backgroundColor,
    color: element.style.color,
    fontSize: `${element.style.fontSize}px`,
    fontWeight: element.style.fontWeight,
    fontFamily: element.style.fontFamily,
    borderRadius: `${element.style.borderRadius}px`,
    borderWidth: `${element.style.borderWidth}px`,
    borderColor: element.style.borderColor,
    borderStyle: element.style.borderWidth ? 'solid' : 'none',
    textAlign: element.style.textAlign,
    
    // Opacity effect
    opacity: (isHovered && element.hoverEffect === 'opacity') ? (element.style.opacity || 1) * 0.7 : element.style.opacity,
    
    zIndex: element.style.zIndex,
    boxShadow: finalBoxShadow,
    
    padding: element.style.padding !== undefined ? `${element.style.padding}px` : undefined,
    
    display: 'flex',
    alignItems: element.type === 'text' ? 'flex-start' : 'center',
    justifyContent: element.type === 'text' 
      ? (element.style.textAlign === 'center' ? 'center' : element.style.textAlign === 'right' ? 'flex-end' : 'flex-start') 
      : 'center',
      
    // Cursor logic
    cursor: isDragging ? 'grabbing' : (element.style.cursor && element.style.cursor !== 'auto' ? element.style.cursor : (element.link ? 'pointer' : 'default')),
    
    userSelect: 'none',
    pointerEvents: isSpacePressed ? 'none' : 'auto',
    
    // Transition for smooth hover (removed transform to prevent jitter during zoom)
    transition: isDragging || isResizing ? 'none' : 'box-shadow 0.2s ease, opacity 0.2s ease',
  };

  const handleStyle = (pos: string) => {
      const s: React.CSSProperties = { position: 'absolute', width: 10, height: 10, background: 'white', border: '1px solid #6366f1', borderRadius: '50%', zIndex: 50 };
      if (pos === 'nw') { s.left = -5; s.top = -5; s.cursor = 'nw-resize'; }
      if (pos === 'ne') { s.right = -5; s.top = -5; s.cursor = 'ne-resize'; }
      if (pos === 'sw') { s.left = -5; s.bottom = -5; s.cursor = 'sw-resize'; }
      if (pos === 'se') { s.right = -5; s.bottom = -5; s.cursor = 'se-resize'; }
      return s;
  };

  const renderMenubarContent = () => {
    const gap = element.style.gap ?? 24;
    const padding = element.style.padding ?? 24;
    
    const leftItems = element.menuItems?.filter(i => (i.position || 'left') === 'left') || [];
    const rightItems = element.menuItems?.filter(i => i.position === 'right') || [];

    return (
        <div className="w-full h-full flex items-center pointer-events-none" style={{
            padding: `0 ${padding}px`,
            justifyContent: 'space-between',
        }}>
            <div style={{ display: 'flex', gap: `${gap}px`, alignItems: 'center' }}>
                {leftItems.map(item => (
                    <span key={item.id} className="font-medium hover:opacity-70 transition-opacity">{item.label}</span>
                ))}
            </div>
             <div style={{ display: 'flex', gap: `${gap}px`, alignItems: 'center' }}>
                {rightItems.map(item => (
                    <span key={item.id} className="font-medium hover:opacity-70 transition-opacity">{item.label}</span>
                ))}
            </div>
        </div>
    );
  };

  return (
    <>
      <div
        ref={elementRef}
        style={style}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onClick={(e) => e.stopPropagation()}
        className={`group ${isSelected ? 'ring-2 ring-indigo-500' : 'hover:ring-1 hover:ring-indigo-300'}`}
        onDoubleClick={(e) => {
             // If Space is pressed, don't allow editing
             if (isSpacePressed) return;
             e.stopPropagation();
             if(element.type === 'text') {
                 const newContent = prompt("テキストを編集", element.content);
                 if(newContent !== null) onUpdate(element.id, { content: newContent });
             }
        }}
      >
        {element.type === 'media' && element.mediaType === 'image' && (
          <img src={element.src} alt="" className="w-full h-full object-cover pointer-events-none" style={{ borderRadius: 'inherit' }} />
        )}

        {element.type === 'media' && element.mediaType === 'svg' && (
          <div 
            className="w-full h-full pointer-events-none" 
            dangerouslySetInnerHTML={{ __html: element.svgContent || '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/></svg>' }} 
            style={{ color: element.style.color }}
          />
        )}
        
        {element.type === 'text' && (
          <div ref={contentRef} className="w-full h-full break-words whitespace-pre-wrap pointer-events-none" style={{ minWidth: 'max-content', minHeight: 'max-content', textAlign: element.style.textAlign }}>
            {element.content}
          </div>
        )}

        {(element.type === 'rectangle' || element.type === 'circle' || element.type === 'button') && (
           <div ref={contentRef} className="w-full h-full break-words whitespace-pre-wrap pointer-events-none flex items-center justify-center" style={{ minWidth: 'max-content', minHeight: 'max-content', textAlign: element.style.textAlign }}>
             {element.content}
           </div>
        )}

        {element.type === 'navigation' && element.navType === 'horizontal' && renderMenubarContent()}

        {element.type === 'navigation' && element.navType === 'hamburger' && (
            <div 
                className="w-full h-full flex items-center justify-center relative bg-gray-50 border border-dashed border-gray-300 rounded" 
                style={{ backgroundColor: element.style.backgroundColor }}
                onClick={(e) => {
                    if (isSpacePressed) return;
                    e.stopPropagation();
                    setIsMenuOpen(!isMenuOpen);
                }}
            >
                <AlignJustify size={Math.min(element.width, element.height) * 0.6} color={element.style.color || '#333'} />
                
                {/* Menu Items List */}
                {isMenuOpen && (
                    <div 
                        className="absolute top-full right-0 bg-white shadow-xl p-2 rounded w-48 z-[100] border border-gray-100 mt-1 pointer-events-auto"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex justify-between items-center mb-1 border-b pb-1">
                            <p className="text-gray-400 text-[10px] uppercase font-bold">Menu Preview</p>
                            <button 
                                onClick={() => setIsMenuOpen(false)}
                                className="text-gray-400 hover:text-gray-600 p-0.5"
                            >
                                <Plus size={12} className="rotate-45" />
                            </button>
                        </div>
                         {element.menuItems?.map(item => (
                             <div key={item.id} className="py-2 px-2 hover:bg-gray-50 rounded text-sm cursor-pointer transition-colors border-b border-gray-50 last:border-0">
                                 {item.label}
                             </div>
                         ))}
                         {(!element.menuItems || element.menuItems.length === 0) && (
                             <p className="text-gray-400 text-xs py-2 text-center italic">No items</p>
                         )}
                    </div>
                )}
            </div>
        )}
        
        {isSelected && !isSpacePressed && (
            <>
                <div style={handleStyle('nw')} onPointerDown={(e) => handleResizeStart(e, 'nw')} onPointerMove={handleResizeMove} onPointerUp={handleResizeUp}/>
                <div style={handleStyle('ne')} onPointerDown={(e) => handleResizeStart(e, 'ne')} onPointerMove={handleResizeMove} onPointerUp={handleResizeUp}/>
                <div style={handleStyle('sw')} onPointerDown={(e) => handleResizeStart(e, 'sw')} onPointerMove={handleResizeMove} onPointerUp={handleResizeUp}/>
                <div style={handleStyle('se')} onPointerDown={(e) => handleResizeStart(e, 'se')} onPointerMove={handleResizeMove} onPointerUp={handleResizeUp}/>
            </>
        )}
      </div>
    </>
  );
};

export default CanvasElement;