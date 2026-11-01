import React, { useState } from 'react';
import {
  AlignJustify,
  Circle,
  Heading1,
  Image as ImageIcon,
  Menu,
  Minus,
  MousePointerClick,
  Square,
  Type,
  X,
} from 'lucide-react';
import { ElementType } from '../types';

interface ToolbarProps {
  onAdd: (type: ElementType, subType?: string) => void;
  disabled?: boolean;
}

const Toolbar: React.FC<ToolbarProps> = ({ onAdd, disabled = false }) => {
  const [showMenuModal, setShowMenuModal] = useState(false);

  const toolGroups = [
    {
      groupLabel: '文字',
      items: [
        {
          key: 'heading',
          type: 'text' as ElementType,
          subType: 'heading',
          icon: <Heading1 size={18} />,
          label: '見出し',
          hint: 'タイトルや見出し文字を追加します (<h2> / <h1>)',
        },
        {
          key: 'text',
          type: 'text' as ElementType,
          subType: 'paragraph',
          icon: <Type size={18} />,
          label: '文章',
          hint: '説明文や本文テキストを追加します (<p>)',
        },
      ],
    },
    {
      groupLabel: 'パーツ',
      items: [
        {
          key: 'button',
          type: 'button' as ElementType,
          icon: <MousePointerClick size={18} />,
          label: 'ボタン',
          hint: 'リンク移動やクリック開閉用のボタンを追加します (<button> / <a>)',
        },
        {
          key: 'media',
          type: 'media' as ElementType,
          icon: <ImageIcon size={18} />,
          label: '画像',
          hint: '写真やイラスト・SVG図形を配置します (<img> / <svg>)',
        },
        {
          key: 'navigation',
          type: 'navigation' as ElementType,
          icon: <Menu size={18} />,
          label: 'メニュー',
          hint: '上部メニューバーや開閉式メニューボタンを追加します (<nav>)',
        },
      ],
    },
    {
      groupLabel: '枠・線',
      items: [
        {
          key: 'rectangle',
          type: 'rectangle' as ElementType,
          icon: <Square size={18} />,
          label: 'ボックス',
          hint: '背景カードやエリア枠を追加します (<div> / <section>)',
        },
        {
          key: 'divider',
          type: 'divider' as ElementType,
          icon: <Minus size={18} />,
          label: '区切り線',
          hint: 'セクションや項目を分ける水平ラインを追加します (<hr>)',
        },
        {
          key: 'circle',
          type: 'circle' as ElementType,
          icon: <Circle size={18} />,
          label: '丸バッジ',
          hint: '円形の装飾バッジやアイコン枠を追加します',
        },
      ],
    },
  ];

  const handleToolClick = (type: ElementType, subType?: string) => {
    if (disabled) return;
    if (type === 'navigation') {
      setShowMenuModal(true);
    } else {
      onAdd(type, subType);
    }
  };

  const handleMenuSelect = (subType: 'horizontal' | 'hamburger') => {
    onAdd('navigation', subType);
    setShowMenuModal(false);
  };

  return (
    <aside className="w-[84px] bg-white border-r border-slate-200 flex flex-col items-center py-3 z-10 shrink-0 overflow-y-auto select-none">
      <div className="w-full px-2 space-y-3 pb-4">
        {toolGroups.map((group, groupIdx) => (
          <div
            key={group.groupLabel}
            className={groupIdx > 0 ? 'pt-2.5 border-t border-slate-100' : ''}
          >
            <span className="block text-[10px] font-medium text-slate-400 text-center mb-1.5">
              {group.groupLabel}
            </span>
            <div className="flex flex-col gap-1">
              {group.items.map((tool) => (
                <button
                  key={tool.key}
                  type="button"
                  disabled={disabled}
                  onClick={() => handleToolClick(tool.type, tool.subType)}
                  className="flex flex-col items-center justify-center py-2 px-1 rounded-lg hover:bg-indigo-50/70 text-slate-700 hover:text-indigo-700 disabled:opacity-40 disabled:pointer-events-none transition-colors group"
                  title={tool.hint}
                >
                  <div className="mb-1 text-slate-500 group-hover:text-indigo-600 transition-colors">
                    {tool.icon}
                  </div>
                  <span className="text-[11px] font-medium text-center leading-tight whitespace-nowrap">
                    {tool.label}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {showMenuModal && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-xs"
          onClick={() => setShowMenuModal(false)}
        >
          <div
            className="bg-white border border-slate-200 rounded-xl shadow-xl p-6 max-w-md w-full relative"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setShowMenuModal(false)}
              className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
              aria-label="閉じる"
            >
              <X size={18} />
            </button>

            <div className="mb-5">
              <h2 className="text-base font-semibold text-slate-900 mb-1">
                追加するメニューを選んでください
              </h2>
              <p className="text-xs text-slate-500 leading-relaxed">
                ページ上部に並べるメニューバーか、ボタンを押して開くメニューかを選べます。
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3.5">
              <button
                type="button"
                onClick={() => handleMenuSelect('horizontal')}
                className="flex flex-col items-center gap-3 p-4 rounded-xl border border-slate-200 hover:border-indigo-500 hover:bg-indigo-50/40 transition-colors text-center"
              >
                <div className="w-11 h-11 bg-slate-100 rounded-lg flex items-center justify-center text-slate-700">
                  <Menu size={22} />
                </div>
                <div className="space-y-1">
                  <span className="block text-sm font-semibold text-slate-900">
                    上部メニューバー
                  </span>
                  <span className="block text-[11px] text-slate-500">
                    横にリンクを並べて表示
                  </span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleMenuSelect('hamburger')}
                className="flex flex-col items-center gap-3 p-4 rounded-xl border border-slate-200 hover:border-indigo-500 hover:bg-indigo-50/40 transition-colors text-center"
              >
                <div className="w-11 h-11 bg-slate-100 rounded-lg flex items-center justify-center text-slate-700">
                  <AlignJustify size={22} />
                </div>
                <div className="space-y-1">
                  <span className="block text-sm font-semibold text-slate-900">
                    開閉メニューボタン
                  </span>
                  <span className="block text-[11px] text-slate-500">
                    押すと一覧が開く三本線
                  </span>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
};

export default Toolbar;
