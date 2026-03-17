import React, { useState } from 'react';
import { Type, Square, Circle, Image as ImageIcon, MousePointer2, MousePointerClick, Menu, AlignJustify, X } from 'lucide-react';
import { ElementType } from '../types';

interface ToolbarProps {
  onAdd: (type: ElementType, subType?: string) => void;
}

const Toolbar: React.FC<ToolbarProps> = ({ onAdd }) => {
  const [showMenuModal, setShowMenuModal] = useState(false);

  const tools = [
    { type: 'text', icon: <Type size={20} />, label: 'テキスト' },
    { type: 'rectangle', icon: <Square size={20} />, label: '四角形' },
    { type: 'circle', icon: <Circle size={20} />, label: '円形' },
    { type: 'button', icon: <MousePointerClick size={20} />, label: 'ボタン' },
    { type: 'media', icon: <ImageIcon size={20} />, label: 'メディア' },
    { type: 'navigation', icon: <Menu size={20} />, label: 'メニュー' },
  ];

  const handleToolClick = (type: string) => {
    if (type === 'navigation') {
      setShowMenuModal(true);
    } else {
      onAdd(type as ElementType);
    }
  };

  const handleMenuSelect = (subType: 'horizontal' | 'hamburger') => {
    onAdd('navigation', subType);
    setShowMenuModal(false);
  };

  return (
    <div className="w-20 bg-white border-r border-gray-200 flex flex-col items-center py-6 shadow-sm z-10 shrink-0 overflow-y-auto custom-scrollbar">
      <div className="mb-6 text-indigo-600">
        <MousePointer2 size={28} />
      </div>
      <div className="flex flex-col gap-4 w-full px-2 pb-4">
        {tools.map((tool) => (
          <button
            key={tool.type}
            onClick={() => handleToolClick(tool.type)}
            className="flex flex-col items-center justify-center p-2 rounded-lg hover:bg-indigo-50 text-gray-600 hover:text-indigo-600 transition-colors group relative"
            title={`${tool.label}を追加`}
          >
            <div className="mb-1">{tool.icon}</div>
            <span className="text-[10px] font-medium text-center leading-tight">{tool.label}</span>
          </button>
        ))}
      </div>

      {/* Menu Selection Modal */}
      {showMenuModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/20 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500"></div>
            
            <button 
              onClick={() => setShowMenuModal(false)}
              className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
            >
              <X size={20} />
            </button>

            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-gray-800 mb-2">メニュー形式を選択</h2>
              <p className="text-gray-500">どちらのメニューをキャンバスに追加しますか？</p>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <button
                onClick={() => handleMenuSelect('horizontal')}
                className="flex flex-col items-center gap-4 p-6 rounded-xl border-2 border-gray-100 hover:border-indigo-500 hover:bg-indigo-50 transition-all group"
              >
                <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 group-hover:scale-110 transition-transform">
                  <Menu size={32} />
                </div>
                <div className="text-center">
                  <span className="block font-bold text-gray-800">メニューバー</span>
                  <span className="text-xs text-gray-400">PC向けの横並びメニュー</span>
                </div>
              </button>

              <button
                onClick={() => handleMenuSelect('hamburger')}
                className="flex flex-col items-center gap-4 p-6 rounded-xl border-2 border-gray-100 hover:border-purple-500 hover:bg-purple-50 transition-all group"
              >
                <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center text-purple-600 group-hover:scale-110 transition-transform">
                  <AlignJustify size={32} />
                </div>
                <div className="text-center">
                  <span className="block font-bold text-gray-800">ハンバーガー</span>
                  <span className="text-xs text-gray-400">スマホ向けの開閉メニュー</span>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Toolbar;