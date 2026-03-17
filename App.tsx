import React, { useState, useCallback, useEffect, useRef } from 'react';
import Toolbar from './components/Toolbar';
import PropertiesPanel from './components/PropertiesPanel';
import CanvasElement from './components/CanvasElement';
import { EditorElement, ElementType, Page } from './types';
import { downloadBundle } from './utils/codeGenerator';
import { Download, Undo, Redo, ZoomIn, ZoomOut, Hand, Plus, Trash2, Edit2 } from 'lucide-react';

const CANVAS_WIDTH = 1280;
const CANVAS_HEIGHT = 800;

// Initial Data
const INITIAL_PAGE_ID = 'home';
const INITIAL_ELEMENT: EditorElement = {
  id: '1',
  type: 'text',
  x: 0,
  y: 0,
  anchorX: 'center',
  anchorY: 'center',
  width: 400,
  height: 120,
  content: 'FriendBuilderへようこそ！\nここをダブルクリックして編集できます。',
  style: {
    color: '#333333',
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    backgroundColor: 'transparent',
  }
};

const App: React.FC = () => {
  // Page State
  const [pages, setPages] = useState<Page[]>([
      { id: INITIAL_PAGE_ID, name: 'ホーム', elements: [INITIAL_ELEMENT] }
  ]);
  const [activePageId, setActivePageId] = useState<string>(INITIAL_PAGE_ID);
  
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeGuides, setActiveGuides] = useState<{type: 'x' | 'y', pos: number}[]>([]);
  
  // Viewport State
  const [zoom, setZoom] = useState(0.5);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  
  // Context Menu & Renaming State
  const [contextMenu, setContextMenu] = useState<{x: number, y: number, pageId: string} | null>(null);
  const [editingPageId, setEditingPageId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const editInputRef = useRef<HTMLInputElement>(null);
  
  const lastMousePos = useRef<{ x: number, y: number } | null>(null);
  const hasPanned = useRef(false);

  // History tracks the entire Pages array
  const [history, setHistory] = useState<Page[][]>([
      [{ id: INITIAL_PAGE_ID, name: 'ホーム', elements: [INITIAL_ELEMENT] }]
  ]);
  const [historyIndex, setHistoryIndex] = useState(0);

  const canvasWrapperRef = useRef<HTMLDivElement>(null);

  // Derived state for current page elements
  const activePage = pages.find(p => p.id === activePageId) || pages[0];
  const elements = activePage.elements;

  // --- Helpers ---
  const constrainPan = useCallback((x: number, y: number, z: number) => {
      if (!canvasWrapperRef.current) return { x, y };
      const { clientWidth, clientHeight } = canvasWrapperRef.current;
      const margin = 100;
      const canvasScreenW = CANVAS_WIDTH * z;
      const canvasScreenH = CANVAS_HEIGHT * z;
      const minX = margin - canvasScreenW;
      const maxX = clientWidth - margin;
      const minY = margin - canvasScreenH;
      const maxY = clientHeight - margin;
      return {
          x: Math.min(Math.max(x, minX), maxX),
          y: Math.min(Math.max(y, minY), maxY)
      };
  }, []);

  // Initialize view
  useEffect(() => {
    if (canvasWrapperRef.current) {
        const { clientWidth, clientHeight } = canvasWrapperRef.current;
        const startZoom = 0.6;
        const startX = (clientWidth - CANVAS_WIDTH * startZoom) / 2;
        const startY = (clientHeight - CANVAS_HEIGHT * startZoom) / 2;
        setZoom(startZoom);
        setPan(constrainPan(startX, startY, startZoom));
    }
  }, [constrainPan]);

  // Handle outside click to close context menu
  useEffect(() => {
      const handleClick = () => setContextMenu(null);
      window.addEventListener('click', handleClick);
      return () => window.removeEventListener('click', handleClick);
  }, []);

  // Focus input when editing starts
  useEffect(() => {
      if (editingPageId && editInputRef.current) {
          editInputRef.current.focus();
          editInputRef.current.select();
      }
  }, [editingPageId]);

  // --- History Management ---
  const saveHistory = (newPages: Page[]) => {
      const newHistory = history.slice(0, historyIndex + 1);
      newHistory.push(newPages);
      setHistory(newHistory);
      setHistoryIndex(newHistory.length - 1);
  };

  const handleUndo = () => {
    if (historyIndex > 0) {
      setHistoryIndex(historyIndex - 1);
      setPages(history[historyIndex - 1]);
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex(historyIndex + 1);
      setPages(history[historyIndex + 1]);
    }
  };

  // --- Element Management ---
  const updateElements = (newElements: EditorElement[]) => {
      const newPages = pages.map(p => p.id === activePageId ? { ...p, elements: newElements } : p);
      setPages(newPages);
      saveHistory(newPages);
  };

  const handleAddElement = (type: ElementType, subType?: string) => {
    const id = Date.now().toString();
    const newElement: EditorElement = {
      id,
      type,
      x: 100, 
      y: 100,
      anchorX: 'left',
      anchorY: 'top',
      width: type === 'text' ? 200 : 100,
      height: type === 'text' ? 60 : 100,
      content: type === 'text' ? 'テキスト' : type === 'button' ? 'ボタン' : '',
      style: {
        backgroundColor: type === 'rectangle' ? '#e2e8f0' : type === 'button' ? '#3b82f6' : 'transparent',
        borderRadius: type === 'circle' ? 100 : type === 'button' ? 8 : 0,
        color: type === 'button' ? '#ffffff' : '#000000',
        fontSize: 16,
        textAlign: 'center',
      },
    };

    if (type === 'media') {
        newElement.mediaType = 'image';
        newElement.src = `https://picsum.photos/300/300?random=${id}`;
        newElement.width = 200;
        newElement.height = 200;
    } else if (type === 'navigation') {
        newElement.navType = (subType as 'horizontal' | 'hamburger') || 'horizontal';
        newElement.width = newElement.navType === 'hamburger' ? 60 : CANVAS_WIDTH;
        newElement.height = 60;
        newElement.x = newElement.navType === 'hamburger' ? 20 : 0;
        newElement.y = 20;
        newElement.anchorX = newElement.navType === 'hamburger' ? 'right' : 'center';
        newElement.anchorY = 'top';
        newElement.style.backgroundColor = '#ffffff';
        newElement.style.boxShadow = '0 2px 4px rgba(0,0,0,0.05)';
        newElement.style.textAlign = 'right';
        newElement.style.gap = 24;
        newElement.style.padding = 24;
        newElement.menuItems = [
            { id: '1', label: 'ホーム', link: '#home' },
            { id: '2', label: 'サービス', link: '#services' },
        ];
    }

    updateElements([...elements, newElement]);
    setSelectedId(id);
  };

  const handleUpdateElement = useCallback((id: string, updates: Partial<EditorElement>) => {
    setPages(currentPages => {
        const updatedPages = currentPages.map(page => {
            if (page.id !== activePageId) return page;
            return {
                ...page,
                elements: page.elements.map(el => el.id === id ? { ...el, ...updates, style: { ...el.style, ...updates.style } } : el)
            };
        });
        return updatedPages;
    });
  }, [activePageId]);

  const handleUpdateElementWithHistory = (id: string, updates: Partial<EditorElement>) => {
      const newPages = pages.map(p => p.id === activePageId ? {
          ...p,
          elements: p.elements.map(el => el.id === id ? { ...el, ...updates, style: { ...el.style, ...updates.style } } : el)
      } : p);
      setPages(newPages);
      saveHistory(newPages);
  };

  const handleDragMove = useCallback((id: string, x: number, y: number) => {
    const el = elements.find(e => e.id === id);
    if (!el) return { x, y };

    const SNAP_THRESHOLD = 5;
    const guides: {type: 'x' | 'y', pos: number}[] = [];
    let snappedX = x;
    let snappedY = y;

    // Get element bounds in canvas space
    const getBounds = (element: EditorElement, posX: number, posY: number) => {
        let left = 0, top = 0;
        if (element.anchorX === 'left') left = posX;
        else if (element.anchorX === 'right') left = CANVAS_WIDTH - element.width - posX;
        else if (element.anchorX === 'center') left = (CANVAS_WIDTH / 2) + posX - (element.width / 2);

        if (element.anchorY === 'top') top = posY;
        else if (element.anchorY === 'bottom') top = CANVAS_HEIGHT - element.height - posY;
        else if (element.anchorY === 'center') top = (CANVAS_HEIGHT / 2) + posY - (element.height / 2);

        return {
            left,
            right: left + element.width,
            centerX: left + element.width / 2,
            top,
            bottom: top + element.height,
            centerY: top + element.height / 2
        };
    };

    const currentBounds = getBounds(el, x, y);

    // Snapping targets
    const xTargets = [0, CANVAS_WIDTH / 2, CANVAS_WIDTH];
    const yTargets = [0, CANVAS_HEIGHT / 2, CANVAS_HEIGHT];

    elements.forEach(other => {
        if (other.id === id) return;
        const otherBounds = getBounds(other, other.x, other.y);
        xTargets.push(otherBounds.left, otherBounds.centerX, otherBounds.right);
        yTargets.push(otherBounds.top, otherBounds.centerY, otherBounds.bottom);
    });

    let xSnapped = false;
    let ySnapped = false;

    // Check X snapping
    for (const target of xTargets) {
        const diffs = [
            { val: currentBounds.left, type: 'left' },
            { val: currentBounds.centerX, type: 'center' },
            { val: currentBounds.right, type: 'right' }
        ];
        for (const d of diffs) {
            if (Math.abs(d.val - target) < SNAP_THRESHOLD) {
                const offset = target - d.val;
                snappedX += offset;
                guides.push({ type: 'x', pos: target });
                xSnapped = true;
                break;
            }
        }
        if (xSnapped) break;
    }

    // Check Y snapping
    for (const target of yTargets) {
        const diffs = [
            { val: currentBounds.top, type: 'top' },
            { val: currentBounds.centerY, type: 'center' },
            { val: currentBounds.bottom, type: 'bottom' }
        ];
        for (const d of diffs) {
            if (Math.abs(d.val - target) < SNAP_THRESHOLD) {
                const offset = target - d.val;
                snappedY += offset;
                guides.push({ type: 'y', pos: target });
                ySnapped = true;
                break;
            }
        }
        if (ySnapped) break;
    }

    setActiveGuides(guides);
    handleUpdateElement(id, { x: snappedX, y: snappedY });
    return { x: snappedX, y: snappedY };
  }, [elements, handleUpdateElement]);

  const handleDragEnd = useCallback(() => {
    setActiveGuides([]);
    saveHistory(pages);
  }, [pages]);

  const handleDeleteElement = useCallback((id: string) => {
    setPages(currentPages => {
        const newPages = currentPages.map(p => {
             if (p.id !== activePageId) return p;
             return { ...p, elements: p.elements.filter(el => el.id !== id) };
        });
        saveHistory(newPages);
        return newPages;
    });
    setSelectedId(null);
  }, [activePageId]);

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
      
      if (isInput) return;

      if (e.code === 'Space' && !e.repeat) {
         e.preventDefault(); 
         setIsSpacePressed(true);
      }

      if (e.key === 'Backspace' || e.key === 'Delete') {
          if (selectedId) {
              e.preventDefault();
              handleDeleteElement(selectedId);
          }
      }
    };
    
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') setIsSpacePressed(false);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
       window.removeEventListener('keydown', handleKeyDown);
       window.removeEventListener('keyup', handleKeyUp);
    };
  }, [selectedId, handleDeleteElement]);


  const handleDuplicateElement = (element: EditorElement) => {
    const newElement = {
        ...element,
        id: Date.now().toString(),
        x: element.x + 20,
        y: element.y + 20,
        menuItems: element.menuItems ? [...element.menuItems] : undefined
    };
    updateElements([...elements, newElement]);
    setSelectedId(newElement.id);
  };

  // --- Page Management ---
  const handleAddPage = () => {
      const id = 'page-' + Date.now();
      const newPage: Page = {
          id,
          name: `ページ ${pages.length + 1}`,
          elements: []
      };
      const newPages = [...pages, newPage];
      setPages(newPages);
      saveHistory(newPages);
      setActivePageId(id);
  };

  const handleDeletePage = (e: React.MouseEvent, pageId: string) => {
      e.stopPropagation();
      if (pages.length <= 1) {
          alert("最後のページは削除できません");
          return;
      }
      if (!confirm("このページを削除しますか？")) return;

      const newPages = pages.filter(p => p.id !== pageId);
      setPages(newPages);
      saveHistory(newPages);
      if (activePageId === pageId) {
          setActivePageId(newPages[0].id);
      }
  };

  const handleRenamePage = (pageId: string, newName: string) => {
      const newPages = pages.map(p => p.id === pageId ? { ...p, name: newName } : p);
      setPages(newPages);
      saveHistory(newPages);
  };

  const startRenaming = (page: Page) => {
      setEditingPageId(page.id);
      setEditingName(page.name);
      setContextMenu(null);
  };

  const finishRenaming = () => {
      if (editingPageId) {
          if (editingName.trim()) {
              handleRenamePage(editingPageId, editingName);
          }
          setEditingPageId(null);
      }
  };

  const handleExport = async () => {
    await downloadBundle(pages);
  };

  // --- Zoom/Pan Logic ---
  useEffect(() => {
    const wrapper = canvasWrapperRef.current;
    if (!wrapper) return;
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (e.ctrlKey) {
        const rect = wrapper.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        const worldX = (mouseX - pan.x) / zoom;
        const worldY = (mouseY - pan.y) / zoom;
        const zoomDelta = -e.deltaY * 0.002;
        const newZoom = Math.min(5, Math.max(0.1, zoom + zoomDelta));
        const newPanX = mouseX - worldX * newZoom;
        const newPanY = mouseY - worldY * newZoom;
        setZoom(newZoom);
        setPan(constrainPan(newPanX, newPanY, newZoom));
      } else {
        setPan(prev => {
            const nextX = prev.x - e.deltaX;
            const nextY = prev.y - e.deltaY;
            return constrainPan(nextX, nextY, zoom);
        });
      }
    };
    wrapper.addEventListener('wheel', handleWheel, { passive: false });
    return () => wrapper.removeEventListener('wheel', handleWheel);
  }, [zoom, pan, constrainPan]);

  const handleWrapperPointerDown = (e: React.PointerEvent) => {
      if (e.button === 0 || e.button === 1) {
          setIsPanning(true);
          lastMousePos.current = { x: e.clientX, y: e.clientY };
          hasPanned.current = false;
          (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
      }
  };

  const handleWrapperPointerMove = (e: React.PointerEvent) => {
      if (isPanning && lastMousePos.current) {
          const dx = e.clientX - lastMousePos.current.x;
          const dy = e.clientY - lastMousePos.current.y;
          if (Math.abs(dx) > 2 || Math.abs(dy) > 2) hasPanned.current = true;
          setPan(prev => constrainPan(prev.x + dx, prev.y + dy, zoom));
          lastMousePos.current = { x: e.clientX, y: e.clientY };
      }
  };

  const handleWrapperPointerUp = (e: React.PointerEvent) => {
      setIsPanning(false);
      lastMousePos.current = null;
      (e.currentTarget as HTMLDivElement).releasePointerCapture(e.pointerId);
  };
  
  const handleManualZoom = (delta: number) => {
      if (!canvasWrapperRef.current) return;
      const { clientWidth, clientHeight } = canvasWrapperRef.current;
      const newZoom = Math.min(5, Math.max(0.1, zoom + delta));
      const centerX = clientWidth / 2;
      const centerY = clientHeight / 2;
      const worldX = (centerX - pan.x) / zoom;
      const worldY = (centerY - pan.y) / zoom;
      const newPanX = centerX - worldX * newZoom;
      const newPanY = centerY - worldY * newZoom;
      setZoom(newZoom);
      setPan(constrainPan(newPanX, newPanY, newZoom));
  };

  const selectedElement = elements.find(el => el.id === selectedId) || null;

  return (
    <div className="flex h-screen flex-col overflow-hidden text-slate-800 font-sans">
      <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-6 shrink-0 z-20">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 rounded-xl flex items-center justify-center text-white shadow-lg transform -rotate-3">
              <span className="font-bold text-lg">W</span>
            </div>
            <h1 className="text-2xl tracking-tight hidden md:block font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600" style={{ fontFamily: "'Dancing Script', cursive" }}>
              Webside
            </h1>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
            <div className="flex bg-gray-100 rounded-md p-1 gap-1">
                <button onClick={handleUndo} disabled={historyIndex === 0} className="p-1.5 hover:bg-white rounded disabled:opacity-30 transition"><Undo size={16}/></button>
                <button onClick={handleRedo} disabled={historyIndex === history.length -1} className="p-1.5 hover:bg-white rounded disabled:opacity-30 transition"><Redo size={16}/></button>
            </div>
            <div className="h-6 w-px bg-gray-300 mx-2"></div>
            <button 
                onClick={handleExport}
                className="flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-700 transition shadow-sm"
            >
                <Download size={16} />
                <span>書き出し (Zip)</span>
            </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden relative">
        <Toolbar onAdd={handleAddElement} />

        {/* Center Canvas Area with Bottom Tabs */}
        <div className="flex-1 flex flex-col min-w-0 bg-gray-200 relative">
            <div 
                ref={canvasWrapperRef}
                className="flex-1 overflow-hidden relative select-none"
                onPointerDown={handleWrapperPointerDown}
                onPointerMove={handleWrapperPointerMove}
                onPointerUp={handleWrapperPointerUp}
                style={{ cursor: isSpacePressed ? 'grab' : isPanning ? 'grabbing' : 'default' }}
                onClick={() => {
                    if (hasPanned.current) return;
                    if (!isSpacePressed) setSelectedId(null);
                }}
            >
                <div 
                    className="bg-white shadow-xl absolute transition-none"
                    style={{ 
                        width: `${CANVAS_WIDTH}px`, 
                        height: `${CANVAS_HEIGHT}px`,
                        transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                        transformOrigin: '0 0',
                        backgroundImage: 'radial-gradient(#e5e7eb 1px, transparent 1px)',
                        backgroundSize: '20px 20px'
                    }}
                >
                    {elements.map(el => (
                        <CanvasElement 
                            key={el.id}
                            element={el}
                            isSelected={el.id === selectedId}
                            onSelect={setSelectedId}
                            onUpdate={handleUpdateElementWithHistory}
                            onDragMove={handleDragMove}
                            onDragEnd={handleDragEnd}
                            zoom={zoom}
                            isSpacePressed={isSpacePressed}
                        />
                    ))}

                    {/* Smart Guides */}
                    {activeGuides.map((guide, i) => (
                        <div 
                            key={i}
                            className="absolute bg-red-500 pointer-events-none z-[100]"
                            style={{
                                left: guide.type === 'x' ? `${guide.pos}px` : 0,
                                top: guide.type === 'y' ? `${guide.pos}px` : 0,
                                width: guide.type === 'x' ? '1px' : '100%',
                                height: guide.type === 'y' ? '1px' : '100%',
                            }}
                        />
                    ))}
                </div>
            </div>

            {/* Excel-like Bottom Tab Bar */}
            <div className="h-9 bg-white border-t border-gray-300 flex items-center justify-between px-2 select-none z-30 shadow-[0_-2px_10px_rgba(0,0,0,0.05)]">
                 <div className="flex items-end h-full overflow-x-auto no-scrollbar gap-0.5 pt-1">
                     {pages.map(page => (
                         <div 
                            key={page.id}
                            onContextMenu={(e) => {
                                e.preventDefault();
                                setContextMenu({ x: e.clientX, y: e.clientY - 80, pageId: page.id });
                            }}
                            onClick={() => { setActivePageId(page.id); setSelectedId(null); }}
                            onDoubleClick={() => startRenaming(page)}
                            className={`group relative h-full px-4 flex items-center gap-2 cursor-pointer text-xs font-medium border-t-2 border-x border-b-0 transition-colors rounded-t-sm min-w-[100px] max-w-[200px]
                                ${activePageId === page.id 
                                    ? 'bg-gray-50 text-indigo-600 border-t-indigo-500 border-x-gray-200' 
                                    : 'bg-gray-100 text-gray-500 border-t-transparent border-x-transparent hover:bg-gray-50 hover:text-gray-700'
                                }
                            `}
                         >
                            {editingPageId === page.id ? (
                                <input 
                                    ref={editInputRef}
                                    value={editingName}
                                    onChange={e => setEditingName(e.target.value)}
                                    onBlur={finishRenaming}
                                    onKeyDown={e => e.key === 'Enter' && finishRenaming()}
                                    className="w-full bg-white border border-indigo-300 rounded px-1 py-0.5 outline-none text-gray-800 text-xs"
                                    onClick={e => e.stopPropagation()}
                                />
                            ) : (
                                <>
                                    <span className="truncate flex-1 text-center select-none">{page.name}</span>
                                    {pages.length > 1 && (
                                        <button 
                                            onClick={(e) => handleDeletePage(e, page.id)}
                                            className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-red-100 hover:text-red-600 rounded transition-all"
                                            title="ページを閉じる"
                                        >
                                            <Plus size={12} className="rotate-45" />
                                        </button>
                                    )}
                                </>
                            )}
                         </div>
                     ))}
                     <button 
                        onClick={handleAddPage}
                        className="h-6 w-6 flex items-center justify-center rounded-full hover:bg-gray-200 text-gray-500 ml-1 transition"
                        title="新しいページ"
                     >
                        <Plus size={14} />
                     </button>
                 </div>

                 {/* Status Bar: Mode Indicator & Zoom */}
                 <div className="flex items-center gap-4 text-xs text-gray-500 bg-white h-full pl-2">
                      {isSpacePressed && <span className="text-indigo-600 font-bold flex items-center gap-1"><Hand size={12}/> 移動モード</span>}
                      <div className="flex items-center gap-1">
                          <button onClick={() => handleManualZoom(-0.1)} className="p-1 hover:bg-gray-100 rounded"><ZoomOut size={14}/></button>
                          <span className="w-10 text-center">{Math.round(zoom * 100)}%</span>
                          <button onClick={() => handleManualZoom(0.1)} className="p-1 hover:bg-gray-100 rounded"><ZoomIn size={14}/></button>
                      </div>
                 </div>
            </div>

            {/* Context Menu Overlay */}
            {contextMenu && (
                 <div 
                    className="fixed bg-white shadow-lg rounded-md border border-gray-200 py-1 z-50 min-w-[140px]"
                    style={{ left: contextMenu.x, top: contextMenu.y }}
                    onClick={(e) => e.stopPropagation()}
                 >
                     <button 
                        className="w-full text-left px-3 py-2 text-xs hover:bg-gray-50 text-gray-700 flex items-center gap-2"
                        onClick={() => {
                             const p = pages.find(p => p.id === contextMenu.pageId);
                             if(p) startRenaming(p);
                        }}
                     >
                        <Edit2 size={12}/> 名前の変更
                     </button>
                     <button 
                        className="w-full text-left px-3 py-2 text-xs hover:bg-red-50 text-red-600 flex items-center gap-2"
                        onClick={(e) => {
                             handleDeletePage(e, contextMenu.pageId);
                             setContextMenu(null);
                        }}
                     >
                        <Trash2 size={12}/> 削除
                     </button>
                 </div>
            )}
        </div>

        <PropertiesPanel 
            element={selectedElement} 
            onUpdate={handleUpdateElementWithHistory}
            onDelete={() => selectedId && handleDeleteElement(selectedId)}
            onDuplicate={handleDuplicateElement}
            canvasWidth={CANVAS_WIDTH}
            canvasHeight={CANVAS_HEIGHT}
            pages={pages}
        />
      </div>
    </div>
  );
};

export default App;