import React, { useState } from 'react';
import { Check, FilePlus2, LayoutTemplate, RefreshCw, X } from 'lucide-react';
import { SiteTemplate } from '../types';
import { SITE_TEMPLATES } from '../utils/templates';

interface TemplateModalProps {
  onApplyTemplate: (template: SiteTemplate, mode: 'replace' | 'append') => void;
  onClose: () => void;
}

const TemplateModal: React.FC<TemplateModalProps> = ({ onApplyTemplate, onClose }) => {
  const [selectedId, setSelectedId] = useState<string>(SITE_TEMPLATES[0].id);
  const selectedTemplate =
    SITE_TEMPLATES.find((t) => t.id === selectedId) || SITE_TEMPLATES[0];

  return (
    <div
      className="fixed inset-0 z-[130] flex items-center justify-center p-6 bg-slate-950/55 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        className="bg-white border border-slate-200 rounded-xl shadow-2xl w-full max-w-5xl max-h-[86vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="h-14 px-6 border-b border-slate-200 flex items-center justify-between shrink-0 bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <LayoutTemplate size={18} className="text-indigo-600 shrink-0" />
            <h2 className="text-sm font-semibold text-slate-900">
              デザインテンプレートを選択
            </h2>
            <span className="text-slate-300 select-none">·</span>
            <span className="text-xs text-slate-500">
              すべて標準 HTML5 / CSS3 / JavaScript コードとして編集・書き出し可能
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-lg transition-colors"
            aria-label="閉じる"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body: Left Grid + Right Inspector */}
        <div className="flex flex-1 min-h-0 overflow-hidden">
          {/* Template List */}
          <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 md:grid-cols-2 gap-4 content-start bg-slate-50/40">
            {SITE_TEMPLATES.map((tpl) => {
              const isSelected = tpl.id === selectedTemplate.id;
              const pageHeight = tpl.pages[0]?.height || 800;
              const elemCount = tpl.pages[0]?.elements.length || 0;

              return (
                <button
                  key={tpl.id}
                  type="button"
                  onClick={() => setSelectedId(tpl.id)}
                  onDoubleClick={() => onApplyTemplate(tpl, 'replace')}
                  className={`group text-left rounded-lg border transition-all overflow-hidden flex flex-col bg-white ${
                    isSelected
                      ? 'border-indigo-600 ring-2 ring-indigo-600/15 shadow-sm'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  {/* Visual Preview Header */}
                  <div
                    className="h-40 w-full relative overflow-hidden border-b border-slate-100 flex items-center justify-center"
                    style={{ backgroundColor: tpl.canvasBg }}
                  >
                    {tpl.previewImage ? (
                      <img
                        src={tpl.previewImage}
                        alt={tpl.name}
                        className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300"
                      />
                    ) : (
                      <div className="flex flex-col items-center gap-1.5 text-slate-400">
                        <div className="w-28 h-3 bg-slate-800 rounded-xs" />
                        <div className="w-40 h-2 bg-slate-300 rounded-xs" />
                        <div className="w-16 h-5 bg-slate-900 rounded-xs mt-1" />
                      </div>
                    )}

                    {/* Selected Check */}
                    {isSelected && (
                      <div className="absolute top-2.5 right-2.5 w-6 h-6 rounded-md bg-indigo-600 text-white flex items-center justify-center shadow-sm">
                        <Check size={14} />
                      </div>
                    )}
                  </div>

                  {/* Card Copy (Zero pill badges — clean typographic metadata) */}
                  <div className="p-4 space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-medium text-slate-500">
                        {tpl.category}
                      </span>
                      <span className="text-[11px] font-mono text-slate-400 tabular-nums">
                        1280×{pageHeight}px · {elemCount}要素
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2.5 h-2.5 rounded-xs border border-slate-300 shrink-0"
                        style={{ backgroundColor: tpl.canvasBg }}
                        title={`背景色 ${tpl.canvasBg}`}
                      />
                      <span
                        className="w-2.5 h-2.5 rounded-xs shrink-0"
                        style={{ backgroundColor: tpl.accentColor }}
                        title={`アクセント ${tpl.accentColor}`}
                      />
                      <h3 className="text-sm font-semibold text-slate-900 truncate">
                        {tpl.name}
                      </h3>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed line-clamp-2">
                      {tpl.description}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Right Detail Sidebar */}
          <div className="w-80 border-l border-slate-200 bg-white p-6 flex flex-col justify-between shrink-0 overflow-y-auto">
            <div className="space-y-5">
              <div>
                <div className="text-[11px] font-medium text-indigo-600 mb-1">
                  {selectedTemplate.category}
                </div>
                <h3 className="text-lg font-bold text-slate-900 tracking-tight">
                  {selectedTemplate.name}
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed mt-2">
                  {selectedTemplate.description}
                </p>
              </div>

              <div className="pt-4 border-t border-slate-200 space-y-2.5">
                <div className="text-xs font-semibold text-slate-800">
                  ページ仕様・カラー設計
                </div>
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">キャンバス寸法</span>
                    <span className="font-mono text-slate-800 tabular-nums">
                      1280 × {selectedTemplate.pages[0]?.height || 800} px
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">ページ背景 (body)</span>
                    <span className="flex items-center gap-1.5 font-mono text-slate-800">
                      <span
                        className="w-3 h-3 rounded-xs border border-slate-300"
                        style={{ backgroundColor: selectedTemplate.canvasBg }}
                      />
                      {selectedTemplate.canvasBg}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">アクセントカラー</span>
                    <span className="flex items-center gap-1.5 font-mono text-slate-800">
                      <span
                        className="w-3 h-3 rounded-xs border border-slate-300"
                        style={{ backgroundColor: selectedTemplate.accentColor }}
                      />
                      {selectedTemplate.accentColor}
                    </span>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-200 space-y-2">
                <div className="text-xs font-semibold text-slate-800">
                  使用されている HTML / CSS / JS 機能
                </div>
                <ul className="space-y-1.5 text-xs text-slate-600">
                  {selectedTemplate.featuresUsed.map((feat, idx) => (
                    <li key={idx} className="flex items-center gap-2">
                      <span className="w-1 h-1 rounded-full bg-slate-400 shrink-0" />
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="pt-5 border-t border-slate-200 space-y-2.5 mt-6">
              <button
                type="button"
                onClick={() => onApplyTemplate(selectedTemplate, 'replace')}
                className="w-full py-2.5 px-4 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold flex items-center justify-center gap-2 transition-colors whitespace-nowrap"
              >
                <RefreshCw size={14} />
                <span>このテンプレートで新規作成</span>
              </button>
              <button
                type="button"
                onClick={() => onApplyTemplate(selectedTemplate, 'append')}
                className="w-full py-2 px-4 rounded-lg bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-medium flex items-center justify-center gap-2 transition-colors whitespace-nowrap"
              >
                <FilePlus2 size={14} />
                <span>現在のプロジェクトにページ追加</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TemplateModal;
