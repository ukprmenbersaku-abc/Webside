import React, { useRef, useState, useEffect } from 'react';
import { EditorElement, AnchorX, AnchorY, PRESET_COLORS, MenuItem, Page } from '../types';
import { Trash2, AlignLeft, AlignCenter, AlignRight, Copy, ArrowRight, ArrowDown, Plus, Upload, GripVertical, ExternalLink, Link as LinkIcon, Layers, MousePointer2, Move, Type as TypeIcon, Sparkles } from 'lucide-react';

interface PropertiesPanelProps {
  element: EditorElement | null;
  onUpdate: (id: string, updates: Partial<EditorElement>) => void;
  onDelete: (id: string) => void;
  onDuplicate: (element: EditorElement) => void;
  canvasWidth: number;
  canvasHeight: number;
  pages: Page[];
}

const GOOGLE_FONTS = [
  { label: '標準 (Sans-serif)', value: 'sans-serif' },
  { label: 'Dancing Script (筆記体)', value: "'Dancing Script', cursive" },
  { label: 'Noto Sans JP', value: "'Noto Sans JP', sans-serif" },
  { label: 'M PLUS 1p', value: "'M PLUS 1p', sans-serif" },
  { label: 'Sawarabi Mincho', value: "'Sawarabi Mincho', serif" },
  { label: 'Yomogi', value: "'Yomogi', cursive" },
  { label: 'DotGothic16', value: "'DotGothic16', sans-serif" },
  { label: 'Roboto', value: "'Roboto', sans-serif" },
  { label: 'Open Sans', value: "'Open Sans', sans-serif" },
  { label: 'Lato', value: "'Lato', sans-serif" },
  { label: 'Montserrat', value: "'Montserrat', sans-serif" },
];

const PropertiesPanel: React.FC<PropertiesPanelProps> = ({ element, onUpdate, onDelete, onDuplicate, canvasWidth, canvasHeight, pages }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const svgInputRef = useRef<HTMLInputElement>(null);
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);

  // Shadow local state
  const [shadowEnabled, setShadowEnabled] = useState(false);
  const [shadowX, setShadowX] = useState(0);
  const [shadowY, setShadowY] = useState(4);
  const [shadowBlur, setShadowBlur] = useState(6);
  const [shadowColor, setShadowColor] = useState('rgba(0,0,0,0.1)');

  // Initialize shadow state from element
  useEffect(() => {
    if (element) {
        if (element.style.boxShadow) {
            setShadowEnabled(true);
            const parts = element.style.boxShadow.split(' ');
            if (parts.length >= 3) {
                 const x = parseInt(parts[0]) || 0;
                 const y = parseInt(parts[1]) || 0;
                 const blur = parseInt(parts[2]) || 0;
                 const color = parts.slice(3).join(' ') || 'rgba(0,0,0,0.1)';
                 setShadowX(x);
                 setShadowY(y);
                 setShadowBlur(blur);
                 setShadowColor(color);
            }
        } else {
            setShadowEnabled(false);
            setShadowX(0);
            setShadowY(4);
            setShadowBlur(6);
            setShadowColor('rgba(0,0,0,0.1)');
        }
    }
  }, [element?.id]);

  const applyShadow = (enabled: boolean, x: number, y: number, blur: number, color: string) => {
      if (enabled) {
          onUpdate(element!.id, {
              style: {
                  ...element!.style,
                  boxShadow: `${x}px ${y}px ${blur}px ${color}`
              }
          });
      } else {
          onUpdate(element!.id, {
              style: {
                  ...element!.style,
                  boxShadow: undefined
              }
          });
      }
  };

  const handleShadowChange = (key: string, val: any) => {
      let newEnabled = shadowEnabled;
      let newX = shadowX;
      let newY = shadowY;
      let newBlur = shadowBlur;
      let newColor = shadowColor;

      if (key === 'enabled') { newEnabled = val; setShadowEnabled(val); }
      if (key === 'x') { newX = val; setShadowX(val); }
      if (key === 'y') { newY = val; setShadowY(val); }
      if (key === 'blur') { newBlur = val; setShadowBlur(val); }
      if (key === 'color') { newColor = val; setShadowColor(val); }

      applyShadow(newEnabled, newX, newY, newBlur, newColor);
  };


  if (!element) {
    return (
      <div className="w-80 bg-white border-l border-gray-200 p-6 flex flex-col items-center justify-center text-gray-400 z-10 shrink-0">
        <p className="text-sm text-center">要素を選択して<br/>編集してください</p>
      </div>
    );
  }

  const updateStyle = (key: keyof typeof element.style, value: any) => {
    onUpdate(element.id, {
      style: { ...element.style, [key]: value }
    });
  };

  const changeAnchor = (newXAnchor: AnchorX, newYAnchor: AnchorY) => {
    let currentAbsLeft = 0;
    let currentAbsTop = 0;

    if (element.anchorX === 'left') currentAbsLeft = element.x;
    else if (element.anchorX === 'right') currentAbsLeft = canvasWidth - element.width - element.x;
    else if (element.anchorX === 'center') currentAbsLeft = (canvasWidth / 2) + element.x - (element.width / 2);

    if (element.anchorY === 'top') currentAbsTop = element.y;
    else if (element.anchorY === 'bottom') currentAbsTop = canvasHeight - element.height - element.y;
    else if (element.anchorY === 'center') currentAbsTop = (canvasHeight / 2) + element.y - (element.height / 2);

    let newX = 0;
    let newY = 0;

    if (newXAnchor === 'left') newX = currentAbsLeft;
    else if (newXAnchor === 'right') newX = canvasWidth - element.width - currentAbsLeft;
    else if (newXAnchor === 'center') newX = currentAbsLeft - (canvasWidth / 2) + (element.width / 2);

    if (newYAnchor === 'top') newY = currentAbsTop;
    else if (newYAnchor === 'bottom') newY = canvasHeight - element.height - currentAbsTop;
    else if (newYAnchor === 'center') newY = currentAbsTop - (canvasHeight / 2) + (element.height / 2);

    onUpdate(element.id, {
        anchorX: newXAnchor,
        anchorY: newYAnchor,
        x: Math.round(newX),
        y: Math.round(newY)
    });
  };

  const updateMenuItem = (id: string, field: keyof MenuItem, value: string) => {
      if (!element.menuItems) return;
      const newItems = element.menuItems.map(item => 
          item.id === id ? { ...item, [field]: value } : item
      );
      onUpdate(element.id, { menuItems: newItems });
  };
  const addMenuItem = (position: 'left' | 'right' = 'left') => {
      const newItems = [...(element.menuItems || []), { 
          id: Date.now().toString(), 
          label: '新規リンク', 
          link: '#',
          position: position
      }];
      onUpdate(element.id, { menuItems: newItems });
  };
  const removeMenuItem = (id: string) => {
      if (!element.menuItems) return;
      const newItems = element.menuItems.filter(item => item.id !== id);
      onUpdate(element.id, { menuItems: newItems });
  };
  const handleDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.setData('text/plain', id); e.dataTransfer.effectAllowed = 'move'; setDraggedItemId(id);
  };
  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; };
  const handleDrop = (e: React.DragEvent, targetPosition: 'left' | 'right', targetId?: string) => {
      e.preventDefault(); const droppedId = e.dataTransfer.getData('text/plain'); if (!droppedId || !element.menuItems) return;
      if (droppedId === targetId) { setDraggedItemId(null); return; }
      const items = [...element.menuItems]; const draggedIndex = items.findIndex(i => i.id === droppedId); if (draggedIndex === -1) return;
      const draggedItem = { ...items[draggedIndex], position: targetPosition }; items.splice(draggedIndex, 1);
      if (targetId) { const targetIndex = items.findIndex(i => i.id === targetId); if (targetIndex !== -1) items.splice(targetIndex, 0, draggedItem); else items.push(draggedItem); } else { items.push(draggedItem); }
      onUpdate(element.id, { menuItems: items }); setDraggedItemId(null);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          const reader = new FileReader();
          reader.onload = (event) => {
              if (event.target?.result) {
                  onUpdate(element.id, { 
                      src: event.target.result as string,
                      imageName: file.name
                  });
              }
          };
          reader.readAsDataURL(file);
      }
  };

  const handleSvgUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          const reader = new FileReader();
          reader.onload = (event) => {
              if (event.target?.result) {
                  onUpdate(element.id, { 
                      svgContent: event.target.result as string
                  });
              }
          };
          reader.readAsText(file);
      }
  };

  const AnchorGrid = () => (
      <div className="grid grid-cols-3 gap-1 w-20 h-20 bg-gray-100 p-1 rounded">
          {['top', 'center', 'bottom'].map(y => (
              ['left', 'center', 'right'].map(x => {
                  const isActive = element.anchorX === x && element.anchorY === y;
                  return (
                      <button 
                        key={`${x}-${y}`}
                        onClick={() => changeAnchor(x as AnchorX, y as AnchorY)}
                        className={`rounded-sm border ${isActive ? 'bg-indigo-600 border-indigo-600' : 'bg-white border-gray-300 hover:border-gray-400'}`}
                        title={`${y} - ${x}`}
                      />
                  )
              })
          ))}
      </div>
  );

  const renderMenuItemsList = (position: 'left' | 'right') => {
      const items = element.menuItems?.filter(i => (i.position || 'left') === position) || [];
      return (
          <div className="space-y-2 p-2 rounded border border-transparent transition-colors drag-container"
            onDragOver={handleDragOver} onDrop={(e) => handleDrop(e, position)} style={{ minHeight: '50px' }}>
             <div className="flex justify-between items-center"><label className="text-[10px] font-bold text-gray-400 uppercase">{position === 'left' ? '左寄せ項目' : '右寄せ項目'}</label></div>
             {items.map((item) => (
                 <div key={item.id} className={`flex flex-col gap-1 p-2 border border-gray-200 rounded bg-gray-50 transition-opacity ${draggedItemId === item.id ? 'opacity-40' : ''}`} draggable onDragStart={(e) => handleDragStart(e, item.id)} onDragOver={handleDragOver} onDrop={(e) => { e.stopPropagation(); handleDrop(e, position, item.id); }}>
                     <div className="flex gap-1 items-center">
                         <div className="cursor-grab text-gray-400 hover:text-gray-600"><GripVertical size={14} /></div>
                         <input className="flex-1 p-1 border rounded text-xs" placeholder="ラベル" value={item.label} onChange={(e) => updateMenuItem(item.id, 'label', e.target.value)} />
                         <button onClick={() => removeMenuItem(item.id)} className="text-gray-400 hover:text-red-500"><Trash2 size={14}/></button>
                     </div>
                     <input className="w-full p-1 border rounded text-xs text-gray-600 ml-5" style={{ width: 'calc(100% - 1.25rem)' }} placeholder="リンク URL" value={item.link} onChange={(e) => updateMenuItem(item.id, 'link', e.target.value)} />
                 </div>
             ))}
             {items.length === 0 && <div className="text-center py-2 text-xs text-gray-400 border border-dashed border-gray-200 rounded">項目をここにドロップ</div>}
             <button onClick={() => addMenuItem(position)} className="w-full py-1 text-xs border border-dashed border-gray-300 rounded text-gray-500 hover:bg-gray-50 flex items-center justify-center gap-1"><Plus size={12}/> {position === 'left' ? '左' : '右'}に追加</button>
          </div>
      );
  };

  // --- Interaction / Action Section ---
  const renderActionConfig = () => {
    return (
      <div className="space-y-4">
        <label className="text-xs font-semibold text-gray-500 uppercase flex items-center gap-2">
           アクション・動き
        </label>
        
        {/* Link Config */}
        <div className="space-y-2 p-3 bg-indigo-50/50 rounded-lg border border-indigo-100">
             <div className="flex items-center gap-2 mb-1">
                 <LinkIcon size={14} className="text-indigo-600"/>
                 <span className="text-xs font-medium text-gray-700">リンク (クリック時の移動)</span>
             </div>
             <div className="flex gap-2 text-xs bg-white rounded border border-gray-200 p-0.5">
                  <button 
                    className={`flex-1 py-1 px-2 rounded transition-colors ${element.linkType !== 'page' ? 'bg-indigo-100 text-indigo-700 font-bold' : 'text-gray-500 hover:bg-gray-50'}`}
                    onClick={() => onUpdate(element.id, { linkType: 'url' })}
                  >
                      <span className="flex items-center justify-center gap-1"><ExternalLink size={12}/> 外部URL</span>
                  </button>
                  <button 
                    className={`flex-1 py-1 px-2 rounded transition-colors ${element.linkType === 'page' ? 'bg-indigo-100 text-indigo-700 font-bold' : 'text-gray-500 hover:bg-gray-50'}`}
                    onClick={() => onUpdate(element.id, { linkType: 'page' })}
                  >
                      <span className="flex items-center justify-center gap-1"><Layers size={12}/> ページ</span>
                  </button>
              </div>

              {element.linkType === 'page' ? (
                  <select 
                    value={element.link || ''} 
                    onChange={(e) => onUpdate(element.id, { link: e.target.value })}
                    className="w-full p-2 border border-gray-300 rounded text-xs bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                  >
                      <option value="">-- 移動先を選択 --</option>
                      {pages.map(p => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                  </select>
              ) : (
                  <input 
                    type="text" 
                    placeholder="https://google.com" 
                    value={element.link || ''}
                    onChange={(e) => onUpdate(element.id, { link: e.target.value })}
                    className="w-full p-2 border border-gray-300 rounded text-xs focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
              )}
        </div>

        <div className="grid grid-cols-2 gap-3">
             {/* Cursor Config */}
             <div className="space-y-1">
                <label className="text-[10px] font-medium text-gray-500 flex items-center gap-1">
                    <MousePointer2 size={10} /> カーソル
                </label>
                <select 
                    value={element.style.cursor || 'auto'} 
                    onChange={(e) => updateStyle('cursor', e.target.value)}
                    className="w-full p-1.5 border border-gray-300 rounded text-xs bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                >
                    <option value="auto">自動 (Auto)</option>
                    <option value="pointer">指 (Pointer)</option>
                    <option value="default">矢印 (Default)</option>
                    <option value="text">テキスト (Text)</option>
                    <option value="move">移動 (Move)</option>
                </select>
             </div>

             {/* Hover Effect Config */}
             <div className="space-y-1">
                <label className="text-[10px] font-medium text-gray-500 flex items-center gap-1">
                    <Sparkles size={10} /> ホバー時の動き
                </label>
                <select 
                    value={element.hoverEffect || 'none'} 
                    onChange={(e) => onUpdate(element.id, { hoverEffect: e.target.value as any })}
                    className="w-full p-1.5 border border-gray-300 rounded text-xs bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                >
                    <option value="none">なし</option>
                    <option value="opacity">薄くする (Fade)</option>
                    <option value="scale">少し拡大 (Zoom)</option>
                    <option value="lift">浮き上がる (Lift)</option>
                </select>
             </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-80 bg-white border-l border-gray-200 flex flex-col z-10 shrink-0 h-full overflow-y-auto custom-scrollbar">
      <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50 sticky top-0 z-10">
        <span className="font-semibold text-gray-700 text-sm">プロパティ</span>
        <div className="flex gap-2">
           <button onClick={() => onDuplicate(element)} className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition" title="複製"><Copy size={16} /></button>
          <button onClick={() => onDelete(element.id)} className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded transition" title="削除"><Trash2 size={16} /></button>
        </div>
      </div>

      <div className="p-4 space-y-8 pb-10">
        
        {/* Content Section */}
        {element.type === 'text' || element.type === 'button' ? (
          <div className="space-y-2">
            <label className="text-xs font-semibold text-gray-500 uppercase flex items-center gap-1"><TypeIcon size={12}/> テキスト内容</label>
            <textarea
              className="w-full p-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
              rows={3}
              value={element.content}
              onChange={(e) => onUpdate(element.id, { content: e.target.value })}
            />
          </div>
        ) : null}

        {element.type === 'media' && (
          <div className="space-y-4">
            <div className="flex gap-2 text-xs bg-gray-100 rounded p-1">
                <button 
                    className={`flex-1 py-1 rounded transition-colors ${element.mediaType === 'image' ? 'bg-white shadow-sm font-bold' : 'text-gray-500'}`}
                    onClick={() => onUpdate(element.id, { mediaType: 'image' })}
                >画像</button>
                <button 
                    className={`flex-1 py-1 rounded transition-colors ${element.mediaType === 'svg' ? 'bg-white shadow-sm font-bold' : 'text-gray-500'}`}
                    onClick={() => onUpdate(element.id, { mediaType: 'svg' })}
                >SVG</button>
            </div>

            {element.mediaType === 'svg' ? (
              <div className="space-y-2">
                <label className="text-xs font-semibold text-gray-500 uppercase">SVG コード</label>
                <div className="flex flex-col gap-2">
                     <button onClick={() => svgInputRef.current?.click()} className="flex items-center justify-center gap-2 w-full py-2 bg-gray-100 hover:bg-gray-200 rounded border border-gray-300 transition text-sm text-gray-700"> <Upload size={16}/> SVGファイルを選択 </button>
                    <input type="file" ref={svgInputRef} className="hidden" accept=".svg" onChange={handleSvgUpload} />
                    <textarea className="w-full p-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none font-mono text-xs" rows={6} value={element.svgContent || ''} onChange={(e) => onUpdate(element.id, { svgContent: e.target.value })} placeholder="<svg>...</svg>" />
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <label className="text-xs font-semibold text-gray-500 uppercase">画像</label>
                <div className="flex flex-col gap-2">
                    <button onClick={() => fileInputRef.current?.click()} className="flex items-center justify-center gap-2 w-full py-2 bg-gray-100 hover:bg-gray-200 rounded border border-gray-300 transition text-sm text-gray-700"> <Upload size={16}/> PCからアップロード </button>
                    <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileUpload} />
                    <div className="relative">
                        <span className="text-[10px] text-gray-400 absolute -top-2 left-2 bg-white px-1">またはURL</span>
                        <input type="text" className="w-full p-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-indigo-500 outline-none" value={element.src || ''} onChange={(e) => onUpdate(element.id, { src: e.target.value })} placeholder="https://..." />
                    </div>
                </div>
                {element.imageName && <p className="text-xs text-gray-500 truncate">File: {element.imageName}</p>}
              </div>
            )}
          </div>
        )}

        {element.type === 'navigation' && (
            <div className="space-y-4">
                 <div className="flex gap-2 text-xs bg-gray-100 rounded p-1">
                    <button 
                        className={`flex-1 py-1 rounded transition-colors ${element.navType === 'horizontal' ? 'bg-white shadow-sm font-bold' : 'text-gray-500'}`}
                        onClick={() => onUpdate(element.id, { navType: 'horizontal' })}
                    >横並び</button>
                    <button 
                        className={`flex-1 py-1 rounded transition-colors ${element.navType === 'hamburger' ? 'bg-white shadow-sm font-bold' : 'text-gray-500'}`}
                        onClick={() => onUpdate(element.id, { navType: 'hamburger' })}
                    >ハンバーガー</button>
                </div>

                 <label className="text-xs font-semibold text-gray-500 uppercase">メニュー項目</label>
                 {element.navType === 'horizontal' && (
                     <div className="grid grid-cols-2 gap-2 mb-2 p-2 bg-gray-50 border border-gray-200 rounded">
                         <div><label className="text-[10px] text-gray-500 block mb-1">間隔 (Gap px)</label><input type="number" value={element.style.gap ?? 24} onChange={(e) => updateStyle('gap', Number(e.target.value))} className="w-full p-1 border rounded text-xs"/></div>
                         <div><label className="text-[10px] text-gray-500 block mb-1">左右余白 (Pad px)</label><input type="number" value={element.style.padding ?? 24} onChange={(e) => updateStyle('padding', Number(e.target.value))} className="w-full p-1 border rounded text-xs"/></div>
                     </div>
                 )}
                 {element.navType === 'horizontal' ? (<div className="flex flex-col gap-4">{renderMenuItemsList('left')}{renderMenuItemsList('right')}</div>) : 
                 (<div className="space-y-2">{element.menuItems?.map((item) => (<div key={item.id} className="flex flex-col gap-1 p-2 border border-gray-200 rounded bg-gray-50"><div className="flex gap-1"><input className="flex-1 p-1 border rounded text-xs" placeholder="ラベル" value={item.label} onChange={(e) => updateMenuItem(item.id, 'label', e.target.value)} /><button onClick={() => removeMenuItem(item.id)} className="text-gray-400 hover:text-red-500"><Trash2 size={14}/></button></div><input className="w-full p-1 border rounded text-xs text-gray-600" placeholder="リンク URL" value={item.link} onChange={(e) => updateMenuItem(item.id, 'link', e.target.value)} /></div>))}<button onClick={() => addMenuItem()} className="w-full py-1 text-xs border border-dashed border-gray-300 rounded text-gray-500 hover:bg-gray-50 flex items-center justify-center gap-1"><Plus size={12}/> 項目を追加</button></div>)}
            </div>
        )}

        {(element.type !== 'media' && element.type !== 'navigation') && renderActionConfig()}

        <hr className="border-gray-100" />

        {/* Appearance */}
        <div className="space-y-4">
            <label className="text-xs font-semibold text-gray-500 uppercase">見た目</label>
            
            <div className="space-y-2">
                <div className="flex justify-between items-center"><span className="text-xs text-gray-600">背景色</span><input type="color" value={element.style.backgroundColor || '#ffffff'} onChange={(e) => updateStyle('backgroundColor', e.target.value)} className="w-6 h-6 rounded cursor-pointer border-none" /></div>
                <div className="flex flex-wrap gap-1 mt-1">
                    {PRESET_COLORS.map(c => (<button key={c} className="w-5 h-5 rounded-full border border-gray-200 shadow-sm" style={{ backgroundColor: c }} onClick={() => updateStyle('backgroundColor', c)} />))}
                    <button className="w-5 h-5 rounded-full border border-gray-200 bg-transparent text-[8px] flex items-center justify-center text-red-500" onClick={() => updateStyle('backgroundColor', 'transparent')} title="透明">x</button>
                </div>
            </div>

            <div className="mt-4"><span className="text-xs text-gray-600 block mb-1">角丸 ({element.style.borderRadius || 0}px)</span><input type="range" min="0" max="100" value={element.style.borderRadius || 0} onChange={(e) => updateStyle('borderRadius', Number(e.target.value))} className="w-full accent-indigo-600 h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer" /></div>
            <div className="mt-4"><span className="text-xs text-gray-600 block mb-1">不透明度 ({Math.round((element.style.opacity || 1) * 100)}%)</span><input type="range" min="0" max="1" step="0.01" value={element.style.opacity ?? 1} onChange={(e) => updateStyle('opacity', Number(e.target.value))} className="w-full accent-indigo-600 h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer" /></div>
            
            {/* Extended Shadow Controls */}
            <div className="mt-4 pt-4 border-t border-gray-100">
                 <div className="flex items-center justify-between mb-2">
                     <span className="text-xs font-semibold text-gray-500 uppercase">影 (Shadow)</span>
                     <input type="checkbox" checked={shadowEnabled} onChange={(e) => handleShadowChange('enabled', e.target.checked)} className="accent-indigo-600 w-4 h-4" />
                 </div>
                 
                 {shadowEnabled && (
                     <div className="space-y-3 pl-2 border-l-2 border-indigo-100">
                         <div>
                             <span className="text-[10px] text-gray-400 block">X ずれ ({shadowX}px)</span>
                             <input type="range" min="-20" max="20" value={shadowX} onChange={(e) => handleShadowChange('x', Number(e.target.value))} className="w-full accent-indigo-600 h-1" />
                         </div>
                         <div>
                             <span className="text-[10px] text-gray-400 block">Y ずれ ({shadowY}px)</span>
                             <input type="range" min="-20" max="20" value={shadowY} onChange={(e) => handleShadowChange('y', Number(e.target.value))} className="w-full accent-indigo-600 h-1" />
                         </div>
                         <div>
                             <span className="text-[10px] text-gray-400 block">ぼかし ({shadowBlur}px)</span>
                             <input type="range" min="0" max="40" value={shadowBlur} onChange={(e) => handleShadowChange('blur', Number(e.target.value))} className="w-full accent-indigo-600 h-1" />
                         </div>
                         <div className="flex items-center justify-between">
                            <span className="text-[10px] text-gray-400">影の色</span>
                            <input type="color" value={shadowColor.startsWith('rgba') ? '#000000' : shadowColor} onChange={(e) => handleShadowChange('color', e.target.value)} className="w-6 h-6 rounded cursor-pointer border-none" />
                         </div>
                     </div>
                 )}
            </div>
        </div>

        <hr className="border-gray-100" />

        {/* Typography */}
        {(element.type === 'text' || element.type === 'button' || element.type === 'navigation') && (
           <div className="space-y-3">
            <label className="text-xs font-semibold text-gray-500 uppercase">タイポグラフィ</label>
            <select value={element.style.fontFamily || 'sans-serif'} onChange={(e) => updateStyle('fontFamily', e.target.value)} className="w-full p-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-indigo-500 outline-none"> {GOOGLE_FONTS.map(font => ( <option key={font.value} value={font.value}>{font.label}</option> ))} </select>
            <div className="flex gap-2">
                 <input type="number" value={element.style.fontSize || 16} onChange={(e) => updateStyle('fontSize', Number(e.target.value))} className="w-20 p-2 border rounded text-sm" title="フォントサイズ" />
                 <div className="flex border rounded overflow-hidden">
                    <button onClick={() => updateStyle('textAlign', 'left')} className={`p-2 hover:bg-gray-100 ${element.style.textAlign === 'left' ? 'bg-gray-100' : ''}`}><AlignLeft size={16}/></button>
                    <button onClick={() => updateStyle('textAlign', 'center')} className={`p-2 hover:bg-gray-100 ${element.style.textAlign === 'center' ? 'bg-gray-100' : ''}`}><AlignCenter size={16}/></button>
                    <button onClick={() => updateStyle('textAlign', 'right')} className={`p-2 hover:bg-gray-100 ${element.style.textAlign === 'right' ? 'bg-gray-100' : ''}`}><AlignRight size={16}/></button>
                 </div>
            </div>
            <div className="flex gap-2 items-center"><input type="color" value={element.style.color || '#000000'} onChange={(e) => updateStyle('color', e.target.value)} className="w-8 h-8 rounded cursor-pointer border-none" /><span className="text-xs text-gray-600">文字色</span></div>
           </div>
        )}

        <hr className="border-gray-100" />

        {/* CSS Positioning & Anchor */}
        <div className="space-y-3">
          <label className="text-xs font-semibold text-gray-500 uppercase flex items-center justify-between">
              <span>配置・サイズ (CSS)</span>
          </label>
          <div className="flex gap-4">
              <div className="flex flex-col gap-1 items-center"><span className="text-[10px] text-gray-400">基準位置</span><AnchorGrid /></div>
              <div className="flex-1 space-y-2">
                 <div className="grid grid-cols-2 gap-2">
                    <div><label className="text-[10px] text-gray-400 flex items-center gap-1">{element.anchorX === 'left' ? <ArrowRight size={10}/> : element.anchorX === 'right' ? <ArrowRight size={10} className="rotate-180"/> : <ArrowRight size={10} className="text-transparent"/>}{element.anchorX === 'left' ? '左から' : element.anchorX === 'right' ? '右から' : '中央X'}</label><input type="number" value={element.x} onChange={(e) => onUpdate(element.id, { x: Number(e.target.value) })} className="w-full p-1 border rounded text-sm" /></div>
                    <div><label className="text-[10px] text-gray-400 flex items-center gap-1">{element.anchorY === 'top' ? <ArrowDown size={10}/> : element.anchorY === 'bottom' ? <ArrowDown size={10} className="rotate-180"/> : <ArrowDown size={10} className="text-transparent"/>}{element.anchorY === 'top' ? '上から' : element.anchorY === 'bottom' ? '下から' : '中央Y'}</label><input type="number" value={element.y} onChange={(e) => onUpdate(element.id, { y: Number(e.target.value) })} className="w-full p-1 border rounded text-sm" /></div>
                    <div><label className="text-[10px] text-gray-400">幅 (px)</label><input type="number" value={element.width} onChange={(e) => onUpdate(element.id, { width: Number(e.target.value) })} className="w-full p-1 border rounded text-sm" /></div>
                    <div><label className="text-[10px] text-gray-400">高さ (px)</label><input type="number" value={element.height} onChange={(e) => onUpdate(element.id, { height: Number(e.target.value) })} className="w-full p-1 border rounded text-sm" /></div>
                 </div>
              </div>
          </div>
        </div>

        <div className="pt-4 border-t border-gray-100">
             <div className="space-y-2">
                <label className="text-xs font-semibold text-gray-500 uppercase">レイヤー</label>
                <div className="flex gap-2">
                    <button onClick={() => updateStyle('zIndex', (element.style.zIndex || 1) + 1)} className="flex-1 bg-gray-100 hover:bg-gray-200 text-xs py-1 px-2 rounded">前面へ</button>
                    <button onClick={() => updateStyle('zIndex', Math.max(0, (element.style.zIndex || 1) - 1))} className="flex-1 bg-gray-100 hover:bg-gray-200 text-xs py-1 px-2 rounded">背面へ</button>
                </div>
            </div>
        </div>

      </div>
    </div>
  );
};

export default PropertiesPanel;