import React, { useMemo, useState } from 'react';
import { Check, FilePlus2, LayoutTemplate, RefreshCw, Search, X } from 'lucide-react';
import { SiteTemplate } from '../types';
import { SITE_TEMPLATES } from '../utils/templates';

interface TemplateModalProps {
  onApplyTemplate: (template: SiteTemplate, mode: 'replace' | 'append') => void;
  onClose: () => void;
}

type FilterGroup = 'all' | 'hospitality' | 'retail' | 'space' | 'tech' | 'editorial';

const FILTER_TABS: { id: FilterGroup; label: string; templateIds?: string[] }[] = [
  { id: 'all', label: `すべて (${SITE_TEMPLATES.length})` },
  {
    id: 'hospitality',
    label: '飲食・宿泊',
    templateIds: ['tsukikage-ryokan', 'kissa-roast', 'maison-eclat'],
  },
  {
    id: 'retail',
    label: 'EC・ブランド',
    templateIds: ['lumiere-botanica', 'nordic-form', 'chronographe-geneve'],
  },
  {
    id: 'space',
    label: '建築・アート・庭',
    templateIds: ['atelier-noir', 'moca-archive', 'verdant-landscape'],
  },
  {
    id: 'tech',
    label: 'IT・EV・ジム',
    templateIds: ['modula-studio', 'aether-mobility', 'kinetic-lab'],
  },
  {
    id: 'editorial',
    label: '出版・士業・白紙',
    templateIds: ['kotonoha-books', 'harbor-legal', 'minimal-blank'],
  },
];

const TemplateModal: React.FC<TemplateModalProps> = ({ onApplyTemplate, onClose }) => {
  const [selectedId, setSelectedId] = useState<string>(SITE_TEMPLATES[0].id);
  const [activeFilter, setActiveFilter] = useState<FilterGroup>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});

  const filteredTemplates = useMemo(() => {
    const activeTab = FILTER_TABS.find((t) => t.id === activeFilter);
    const q = searchQuery.trim().toLowerCase();

    return SITE_TEMPLATES.filter((tpl) => {
      if (activeTab?.templateIds && !activeTab.templateIds.includes(tpl.id)) {
        return false;
      }
      if (!q) return true;
      return (
        tpl.name.toLowerCase().includes(q) ||
        tpl.category.toLowerCase().includes(q) ||
        tpl.description.toLowerCase().includes(q)
      );
    });
  }, [activeFilter, searchQuery]);

  const selectedTemplate =
    SITE_TEMPLATES.find((t) => t.id === selectedId) ||
    filteredTemplates[0] ||
    SITE_TEMPLATES[0];

  const totalElementsCount = selectedTemplate.pages.reduce(
    (sum, p) => sum + p.elements.length,
    0
  );

  return (
    <div
      className="fixed inset-0 z-[130] flex items-center justify-center p-5 bg-slate-950/55 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        className="bg-white border border-slate-200 rounded-xl shadow-2xl w-full max-w-6xl h-[88vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-3.5 border-b border-slate-200 flex items-center justify-between gap-4 shrink-0 bg-slate-50/80">
          <div className="flex items-center gap-2.5 min-w-0">
            <LayoutTemplate size={18} className="text-indigo-600 shrink-0" />
            <h2 className="text-sm font-semibold text-slate-900 whitespace-nowrap shrink-0">
              デザインテンプレートを選択
            </h2>
            <span className="text-slate-300 select-none">·</span>
            <span className="text-xs text-slate-500 truncate">
              全{SITE_TEMPLATES.length}種 — すべて標準 HTML5 / CSS3 / JavaScript として自由編集・ZIP書き出し可能
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-lg transition-colors shrink-0"
            aria-label="閉じる"
          >
            <X size={18} />
          </button>
        </div>

        {/* Interactive Category Filter Bar & Search */}
        <div className="px-6 py-2.5 border-b border-slate-200 bg-white flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg overflow-x-auto">
            {FILTER_TABS.map((tab) => {
              const isTabActive = activeFilter === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveFilter(tab.id)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                    isTabActive
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          <div className="relative w-56 shrink-0">
            <Search
              size={14}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="業種・キーワードで検索"
              className="w-full pl-8 pr-7 py-1.5 text-xs border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                aria-label="検索をクリア"
              >
                <X size={12} />
              </button>
            )}
          </div>
        </div>

        {/* Body: Left Grid + Right Inspector */}
        <div className="flex flex-1 min-h-0 overflow-hidden">
          {/* Template Grid */}
          <div className="flex-1 overflow-y-auto p-6 bg-slate-50/40">
            {filteredTemplates.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center py-16 space-y-3">
                <p className="text-sm font-medium text-slate-700">
                  一致するテンプレートが見つかりませんでした
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setActiveFilter('all');
                    setSearchQuery('');
                  }}
                  className="px-3.5 py-1.5 text-xs font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors whitespace-nowrap shrink-0"
                >
                  絞り込みをリセット
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 content-start">
                {filteredTemplates.map((tpl) => {
                  const isSelected = tpl.id === selectedTemplate.id;
                  const pageHeight = tpl.pages[0]?.height || 800;
                  const elemCount = tpl.pages.reduce((s, p) => s + p.elements.length, 0);
                  const imgFailed = Boolean(failedImages[tpl.id]);

                  return (
                    <button
                      key={tpl.id}
                      type="button"
                      onClick={() => setSelectedId(tpl.id)}
                      onDoubleClick={() => onApplyTemplate(tpl, 'replace')}
                      className={`group text-left rounded-lg border transition-all overflow-hidden flex flex-col bg-white ${
                        isSelected
                          ? 'border-indigo-600 ring-2 ring-indigo-600/15 shadow-xs'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      {/* Visual Preview Header */}
                      <div
                        className="h-36 w-full relative overflow-hidden border-b border-slate-100 flex items-center justify-center"
                        style={{ backgroundColor: tpl.canvasBg }}
                      >
                        {tpl.previewImage && !imgFailed ? (
                          <img
                            src={tpl.previewImage}
                            alt={tpl.name}
                            referrerPolicy="no-referrer"
                            onError={() =>
                              setFailedImages((prev) => ({ ...prev, [tpl.id]: true }))
                            }
                            className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-200"
                          />
                        ) : (
                          <div className="flex flex-col items-center gap-1.5 px-4 text-center">
                            <div
                              className="w-24 h-2.5 rounded-xs"
                              style={{ backgroundColor: tpl.accentColor }}
                            />
                            <div className="w-36 h-2 bg-slate-300/80 rounded-xs" />
                            <div className="w-16 h-4 bg-slate-800/80 rounded-xs mt-1" />
                          </div>
                        )}

                        {isSelected && (
                          <div className="absolute top-2.5 right-2.5 w-6 h-6 rounded-md bg-indigo-600 text-white flex items-center justify-center shadow-xs">
                            <Check size={14} />
                          </div>
                        )}
                      </div>

                      {/* Card Copy (Clean unboxed metadata with middle-dot separators) */}
                      <div className="p-3.5 space-y-1.5 flex-1 flex flex-col justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500">
                            <span className="font-medium truncate">{tpl.category}</span>
                            <span className="font-mono text-slate-400 tabular-nums whitespace-nowrap shrink-0">
                              {tpl.pages.length > 1 ? `${tpl.pages.length}P · ` : ''}1280×
                              {pageHeight} · {elemCount}要素
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
                        </div>
                        <p className="text-xs text-slate-600 leading-relaxed line-clamp-2">
                          {tpl.description}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right Detail Sidebar */}
          <div className="w-80 border-l border-slate-200 bg-white p-5 flex flex-col justify-between shrink-0 overflow-y-auto">
            <div className="space-y-4">
              {selectedTemplate.previewImage && !failedImages[selectedTemplate.id] && (
                <div
                  className="h-36 w-full rounded-lg overflow-hidden border border-slate-200"
                  style={{ backgroundColor: selectedTemplate.canvasBg }}
                >
                  <img
                    src={selectedTemplate.previewImage}
                    alt={selectedTemplate.name}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                </div>
              )}

              <div>
                <div className="flex items-center gap-1.5 text-[11px] font-medium text-indigo-600 mb-1">
                  <span>{selectedTemplate.category}</span>
                  {selectedTemplate.pages.length > 1 && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span>全{selectedTemplate.pages.length}ページ構成</span>
                    </>
                  )}
                </div>
                <h3 className="text-lg font-bold text-slate-900 tracking-tight">
                  {selectedTemplate.name}
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed mt-1.5">
                  {selectedTemplate.description}
                </p>
              </div>

              <div className="pt-3.5 border-t border-slate-200 space-y-2">
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
                    <span className="text-slate-500">収録パーツ総数</span>
                    <span className="font-mono text-slate-800 tabular-nums">
                      {totalElementsCount} 要素（{selectedTemplate.pages.length}ページ）
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

              {selectedTemplate.pages.length > 1 && (
                <div className="pt-3.5 border-t border-slate-200 space-y-2">
                  <div className="text-xs font-semibold text-slate-800">
                    収録ページ構成（全{selectedTemplate.pages.length}ページ）
                  </div>
                  <ol className="space-y-1 text-xs text-slate-600">
                    {selectedTemplate.pages.map((p, idx) => (
                      <li
                        key={p.id}
                        className="flex items-center justify-between gap-2 py-0.5 tabular-nums"
                      >
                        <span className="truncate">
                          <span className="font-mono text-slate-400 mr-1.5">
                            {String(idx + 1).padStart(2, '0')}.
                          </span>
                          {p.name}
                        </span>
                        <span className="font-mono text-[11px] text-slate-400 shrink-0">
                          {p.height || 800}px
                        </span>
                      </li>
                    ))}
                  </ol>
                </div>
              )}

              <div className="pt-3.5 border-t border-slate-200 space-y-2">
                <div className="text-xs font-semibold text-slate-800">
                  使用されている HTML / CSS / JS 機能
                </div>
                <ul className="space-y-1.5 text-xs text-slate-600">
                  {selectedTemplate.featuresUsed.map((feat, idx) => (
                    <li key={idx} className="flex items-start gap-2 leading-snug">
                      <span className="text-slate-400 select-none shrink-0">-</span>
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="pt-4 border-t border-slate-200 space-y-2 mt-5">
              <button
                type="button"
                onClick={() => onApplyTemplate(selectedTemplate, 'replace')}
                className="w-full py-2.5 px-4 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold flex items-center justify-center gap-2 transition-colors whitespace-nowrap shrink-0"
              >
                <RefreshCw size={14} />
                <span>このテンプレートで新規作成</span>
              </button>
              <button
                type="button"
                onClick={() => onApplyTemplate(selectedTemplate, 'append')}
                className="w-full py-2 px-4 rounded-lg bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-medium flex items-center justify-center gap-2 transition-colors whitespace-nowrap shrink-0"
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
