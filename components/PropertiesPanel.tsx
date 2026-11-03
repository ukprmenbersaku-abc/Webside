import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlignCenter,
  AlignCenterVertical,
  AlignEndVertical,
  AlignJustify,
  AlignLeft,
  AlignRight,
  AlignStartVertical,
  ArrowDown,
  ArrowRight,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Copy,
  Eye,
  EyeOff,
  Film,
  GripVertical,
  HelpCircle,
  Image as ImageIcon,
  Lock,
  Maximize2,
  Minimize2,
  Plus,
  Trash2,
  Unlock,
  Upload,
  Volume2,
  X,
  Zap,
} from 'lucide-react';
import {
  AnchorX,
  AnchorY,
  BorderSidesMode,
  EditorElement,
  HtmlTagName,
  JsActionType,
  JsEventType,
  MenuItem,
  PRESET_COLORS,
  Page,
} from '../types';
import {
  getEffectiveBorderWidth,
  getEffectiveTag,
  getElementBoxes,
  getElementHumanSummary,
  getMarginSides,
  getPaddingSides,
  hasAnyMargin,
  isAutoHeightElement,
  isUniformSides,
  sanitizeHtmlId,
} from '../utils/boxModel';
import { generateElementSnippet } from '../utils/codeGenerator';
import {
  extractIframeSrc,
  getSampleAudioDataUri,
  parseVideoEmbed,
} from '../utils/mediaUtils';

interface PropertiesPanelProps {
  elements: EditorElement[];
  allPageElements: EditorElement[];
  activePage: Page;
  onUpdatePage: (updates: Partial<Page>) => void;
  onSelectElement: (id: string | null, isShift?: boolean) => void;
  onReorderElement: (id: string, direction: 'up' | 'down') => void;
  onUpdate: (ids: string[], updates: Partial<EditorElement>) => void;
  onDelete: (ids: string[]) => void;
  onDuplicate: (ids: string[]) => void;
  canvasWidth: number;
  canvasHeight: number;
  pages: Page[];
  onEnterPreview?: () => void;
  onSwitchPage?: (pageId: string) => void;
}

type PageTab = 'page' | 'layers';
type ElementTab = 'basic' | 'design' | 'motion' | 'pro';

interface FieldLabelProps {
  label: string;
  spec?: string;
  helpText?: string;
  rightSlot?: React.ReactNode;
}

const FieldLabel: React.FC<FieldLabelProps> = ({ label, spec, helpText, rightSlot }) => {
  const [open, setOpen] = useState(false);

  return (
    <div className="space-y-1.5 mb-1.5">
      <div className="flex items-center justify-between gap-2 min-w-0">
        <div className="flex items-center gap-1 min-w-0">
          <span className="text-xs font-medium text-slate-700 truncate">{label}</span>
          {helpText && (
            <button
              type="button"
              onClick={() => setOpen((prev) => !prev)}
              className={`p-0.5 rounded transition-colors shrink-0 ${
                open ? 'text-indigo-600 bg-indigo-50' : 'text-slate-400 hover:text-indigo-600'
              }`}
              title="詳しい説明を表示"
            >
              <HelpCircle size={12} />
            </button>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {spec && <span className="text-[10px] font-mono text-slate-400">{spec}</span>}
          {rightSlot}
        </div>
      </div>

      {open && helpText && (
        <div className="rounded-lg bg-slate-100/90 border border-slate-200/80 p-2.5 text-[11px] text-slate-600 leading-relaxed">
          {helpText}
        </div>
      )}
    </div>
  );
};

const GOOGLE_FONTS = [
  { label: '標準ゴシック（読みやすい基本）', value: 'sans-serif' },
  { label: 'Noto Sans JP（定番の日本語ゴシック）', value: "'Noto Sans JP', sans-serif" },
  { label: 'しっぽり明朝（上品な和風・明朝体）', value: "'Shippori Mincho', serif" },
  { label: 'Cormorant Garamond（洗練された欧文セリフ）', value: "'Cormorant Garamond', serif" },
  { label: 'Playfair Display（雑誌風見出しセリフ）', value: "'Playfair Display', serif" },
  { label: 'Outfit（モダン・スタイリッシュ）', value: "'Outfit', sans-serif" },
  { label: 'Plus Jakarta Sans（クリーン欧文）', value: "'Plus Jakarta Sans', sans-serif" },
  { label: 'DM Sans（やわらかい幾何学書体）', value: "'DM Sans', sans-serif" },
  { label: 'Oswald（縦長インパクト見出し）', value: "'Oswald', sans-serif" },
  { label: 'JetBrains Mono（等幅・数値向け）', value: "'JetBrains Mono', monospace" },
];

const GRADIENT_PRESETS = [
  { label: 'なし', value: '' },
  {
    label: '写真下を暗く（文字を読みやすく）',
    value: 'linear-gradient(180deg, rgba(12,14,18,0.18) 0%, rgba(12,14,18,0.92) 100%)',
  },
  {
    label: '和紙ベージュ',
    value: 'linear-gradient(135deg, #F7F4EF 0%, #EAE3D5 100%)',
  },
  {
    label: 'クリアミスト',
    value: 'linear-gradient(180deg, #FFFFFF 0%, #F1F5F9 100%)',
  },
  {
    label: 'ディープネイビー',
    value: 'linear-gradient(135deg, #0F172A 0%, #1E3A8A 100%)',
  },
];

const SHADOW_PRESETS = [
  { label: 'なし', x: 0, y: 0, blur: 0, color: 'rgba(15,23,42,0.12)', enabled: false },
  { label: 'ほんのり', x: 0, y: 2, blur: 8, color: 'rgba(15,23,42,0.08)', enabled: true },
  { label: '標準', x: 0, y: 8, blur: 24, color: 'rgba(15,23,42,0.12)', enabled: true },
  { label: '浮き上がり', x: 0, y: 16, blur: 36, color: 'rgba(15,23,42,0.18)', enabled: true },
] as const;

const TEXT_TAGS: { value: HtmlTagName; label: string }[] = [
  { value: 'h1', label: 'ページの大見出し — <h1>' },
  { value: 'h2', label: 'セクションの中見出し — <h2>' },
  { value: 'h3', label: '項目の小見出し — <h3>' },
  { value: 'h4', label: '補足見出し — <h4>' },
  { value: 'p', label: '通常の文章・段落 — <p>' },
  { value: 'span', label: '短いラベル文字 — <span>' },
  { value: 'blockquote', label: '引用・お客様の声 — <blockquote>' },
  { value: 'div', label: '汎用テキスト枠 — <div>' },
];

const BOX_TAGS: { value: HtmlTagName; label: string }[] = [
  { value: 'div', label: '汎用ボックス枠 — <div>' },
  { value: 'section', label: 'ページの1区画（セクション） — <section>' },
  { value: 'article', label: '独立した記事・商品カード — <article>' },
  { value: 'aside', label: '開閉メニュー・補足パネル — <aside>' },
  { value: 'header', label: 'ページ上部のヘッダー枠 — <header>' },
  { value: 'footer', label: 'ページ下部のフッター枠 — <footer>' },
  { value: 'main', label: 'メイン領域 — <main>' },
];

const BUTTON_TAGS: { value: HtmlTagName; label: string }[] = [
  { value: 'button', label: 'クリック動作ボタン — <button>' },
  { value: 'a', label: 'ページ移動リンクボタン — <a>' },
];

const NAV_TAGS: { value: HtmlTagName; label: string }[] = [
  { value: 'header', label: 'ヘッダー付きナビ — <header> + <nav>' },
  { value: 'nav', label: 'ナビゲーション単体 — <nav>' },
];

const PAGE_BG_PRESETS = [
  { label: '白', color: '#FFFFFF' },
  { label: '薄グレー', color: '#F8FAFC' },
  { label: '和紙', color: '#F7F4EF' },
  { label: 'ストーン', color: '#F3F1EC' },
  { label: '濃紺', color: '#0F172A' },
  { label: '黒曜', color: '#0C0E12' },
];

const PropertiesPanel: React.FC<PropertiesPanelProps> = ({
  elements,
  allPageElements,
  activePage,
  onUpdatePage,
  onSelectElement,
  onReorderElement,
  onUpdate,
  onDelete,
  onDuplicate,
  canvasWidth,
  canvasHeight,
  pages,
  onEnterPreview,
  onSwitchPage,
}) => {
  const element = elements.length > 0 ? elements[0] : null;
  const selectedIds = elements.map((el) => el.id);

  const [pageTab, setPageTab] = useState<PageTab>('page');
  const [elementTab, setElementTab] = useState<ElementTab>('basic');

  const [padSplit, setPadSplit] = useState(false);
  const [marginSplit, setMarginSplit] = useState(false);
  const [showBoxDiagram, setShowBoxDiagram] = useState(false);
  const [showMediaAdvanced, setShowMediaAdvanced] = useState(false);
  const [showTextDetail, setShowTextDetail] = useState(false);
  const [showShadowDetail, setShowShadowDetail] = useState(false);
  const [showVisualEffects, setShowVisualEffects] = useState(false);
  const [showPageUrlSlug, setShowPageUrlSlug] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [explicitLinkTab, setExplicitLinkTab] = useState<'none' | 'page' | 'url'>('none');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const svgInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const posterInputRef = useRef<HTMLInputElement>(null);
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);

  // Shadow local state
  const [shadowEnabled, setShadowEnabled] = useState(false);
  const [shadowX, setShadowX] = useState(0);
  const [shadowY, setShadowY] = useState(4);
  const [shadowBlur, setShadowBlur] = useState(12);
  const [shadowColor, setShadowColor] = useState('rgba(15,23,42,0.12)');

  useEffect(() => {
    if (!element) return;

    const pSides = getPaddingSides(element.style);
    setPadSplit(!isUniformSides(pSides));

    const mSides = getMarginSides(element.style);
    setMarginSplit(!isUniformSides(mSides));

    setShowMediaAdvanced(element.mediaType === 'svg');
    setShowTextDetail(
      element.style.writingMode === 'vertical-rl' ||
        element.style.fontStyle === 'italic' ||
        Boolean(element.style.textTransform && element.style.textTransform !== 'none')
    );
    setShowVisualEffects(
      Boolean(element.style.backgroundImage) ||
        (element.style.backdropFilterBlur ?? 0) > 0 ||
        (element.style.opacity !== undefined && element.style.opacity < 1) ||
        Boolean(element.hoverEffect && element.hoverEffect !== 'none')
    );

    if (element.link) {
      setExplicitLinkTab(element.linkType === 'page' ? 'page' : 'url');
    } else {
      setExplicitLinkTab('none');
    }

    if (element.style.boxShadow) {
      setShadowEnabled(true);
      const parts = element.style.boxShadow.split(' ');
      if (parts.length >= 3) {
        setShadowX(parseInt(parts[0], 10) || 0);
        setShadowY(parseInt(parts[1], 10) || 0);
        setShadowBlur(parseInt(parts[2], 10) || 0);
        setShadowColor(parts.slice(3).join(' ') || 'rgba(15,23,42,0.12)');
      }
    } else {
      setShadowEnabled(false);
      setShadowX(0);
      setShadowY(4);
      setShadowBlur(12);
      setShadowColor('rgba(15,23,42,0.12)');
    }
  }, [element?.id]);

  // Keep valid tab on multi-select
  useEffect(() => {
    if (elements.length > 1 && (elementTab === 'motion' || elementTab === 'pro')) {
      setElementTab('basic');
    }
  }, [elements.length, elementTab]);

  const snippet = useMemo(() => {
    if (!element) return null;
    return generateElementSnippet(element, pages);
  }, [element, pages]);

  // =========================================================================
  // STATE A: No Element Selected -> Calm 2-Tab Page Settings & Parts List
  // =========================================================================
  if (!element) {
    const isIndexPage = pages.length > 0 && pages[0].id === activePage.id;
    const currentBg = activePage.backgroundColor || '#FFFFFF';

    return (
      <aside className="w-[340px] bg-white border-l border-slate-200 flex flex-col z-10 shrink-0 h-full overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 bg-slate-50/80 shrink-0 space-y-2.5">
          <div>
            <span className="text-xs font-semibold text-slate-900 block truncate">
              {activePage.name}
            </span>
            <span className="text-[11px] text-slate-500">
              キャンバス上のパーツをクリックすると個別編集できます
            </span>
          </div>

          <div className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-lg">
            <button
              type="button"
              onClick={() => setPageTab('page')}
              className={`flex-1 py-1.5 px-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                pageTab === 'page'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              ページ全体の設定
            </button>
            <button
              type="button"
              onClick={() => setPageTab('layers')}
              className={`flex-1 py-1.5 px-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 tabular-nums ${
                pageTab === 'layers'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              配置パーツ一覧 ({allPageElements.length})
            </button>
          </div>
        </div>

        {pageTab === 'page' ? (
          <div className="flex-1 overflow-y-auto p-4 space-y-5 pb-12">
            <div>
              <FieldLabel
                label="ページの名前（ブラウザのタブ名）"
                helpText="ブラウザの上部タブや検索結果に表示されるページタイトルです。"
              />
              <input
                type="text"
                value={activePage.name}
                onChange={(e) => onUpdatePage({ name: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>

            <div className="space-y-2">
              <FieldLabel
                label="ページの背景カラー"
                rightSlot={
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={currentBg}
                      onChange={(e) => onUpdatePage({ backgroundColor: e.target.value })}
                      className="w-20 px-1.5 py-0.5 border border-slate-200 rounded text-[11px] font-mono text-slate-700"
                    />
                    <input
                      type="color"
                      value={
                        currentBg.startsWith('#') && currentBg.length === 7 ? currentBg : '#ffffff'
                      }
                      onChange={(e) => onUpdatePage({ backgroundColor: e.target.value })}
                      className="w-5 h-5 rounded cursor-pointer border border-slate-200"
                    />
                  </div>
                }
              />
              <div className="grid grid-cols-6 gap-1.5">
                {PAGE_BG_PRESETS.map((preset) => (
                  <button
                    key={preset.color}
                    type="button"
                    onClick={() => onUpdatePage({ backgroundColor: preset.color })}
                    className={`flex flex-col items-center gap-1 p-1.5 rounded-lg border transition-colors ${
                      currentBg.toUpperCase() === preset.color
                        ? 'border-indigo-500 bg-indigo-50/40'
                        : 'border-slate-200 hover:border-slate-400'
                    }`}
                  >
                    <span
                      className="w-full h-4 rounded-xs border border-slate-200/80"
                      style={{ backgroundColor: preset.color }}
                    />
                    <span className="text-[10px] text-slate-600 truncate max-w-full">
                      {preset.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <FieldLabel
                label="ページの縦の長さ"
                spec={`${canvasHeight}px`}
                helpText="キャンバス下端のバーを上下にドラッグしても自由に変更できます。"
              />
              <div className="grid grid-cols-4 gap-1.5">
                {[
                  { label: '短め', h: 800 },
                  { label: '標準', h: 1200 },
                  { label: '長め', h: 1600 },
                  { label: 'LP', h: 2200 },
                ].map((item) => (
                  <button
                    key={item.h}
                    type="button"
                    onClick={() => onUpdatePage({ height: item.h })}
                    className={`py-1.5 rounded-lg text-xs border transition-colors whitespace-nowrap shrink-0 ${
                      canvasHeight === item.h
                        ? 'bg-indigo-50 border-indigo-300 text-indigo-700 font-semibold'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  min={400}
                  max={6000}
                  step={20}
                  value={canvasHeight}
                  onChange={(e) =>
                    onUpdatePage({
                      height: Math.min(6000, Math.max(400, Number(e.target.value) || 800)),
                    })
                  }
                  className="flex-1 px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-mono tabular-nums"
                />
                <span className="text-xs text-slate-400 font-mono">px</span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/90 space-y-1.5">
              <label className="flex items-center justify-between gap-2 cursor-pointer select-none">
                <span className="text-xs font-medium text-slate-800">
                  文字増減の自動整列・スマホ最適化
                </span>
                <input
                  type="checkbox"
                  checked={activePage.autoFlow !== false}
                  onChange={(e) => onUpdatePage({ autoFlow: e.target.checked })}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                />
              </label>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                文章が増えても下の要素と重ならないよう自動で押し下げ、スマホ画面でも見切れず縦並びに整えます。
              </p>
            </div>

            {!isIndexPage && (
              <div className="pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowPageUrlSlug((v) => !v)}
                  className="w-full flex items-center justify-between py-1 text-xs text-slate-500 hover:text-slate-800"
                >
                  <span>ページのURL英語名を設定（任意）</span>
                  {showPageUrlSlug ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>
                {showPageUrlSlug && (
                  <div className="pt-2">
                    <input
                      type="text"
                      value={activePage.slug || ''}
                      onChange={(e) => onUpdatePage({ slug: e.target.value })}
                      placeholder="例: about, menu, contact"
                      className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-mono"
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          /* Tab 2: Clean Scannable Parts List */
          <div className="flex-1 overflow-y-auto p-4 space-y-2 pb-12">
            {allPageElements.length === 0 ? (
              <div className="py-10 px-4 text-center border border-dashed border-slate-200 rounded-xl space-y-1">
                <p className="text-xs font-medium text-slate-600">まだパーツがありません</p>
                <p className="text-[11px] text-slate-400">
                  左側のバーから「見出し」や「画像」を追加してみましょう
                </p>
              </div>
            ) : (
              allPageElements.map((item, idx) => {
                const summary = getElementHumanSummary(item);
                return (
                  <div
                    key={item.id}
                    onClick={() => onSelectElement(item.id)}
                    className="group flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg border border-slate-200/80 hover:border-indigo-300 hover:bg-indigo-50/40 cursor-pointer transition-colors"
                  >
                    <div className="min-w-0 flex-1 flex items-center gap-1.5">
                      <span className="text-xs font-semibold text-slate-800 shrink-0">
                        {summary.kindLabel}
                      </span>
                      {summary.previewText && (
                        <span className="text-xs text-slate-500 truncate">
                          {summary.previewText}
                        </span>
                      )}
                      {item.hiddenByDefault && (
                        <EyeOff
                          size={12}
                          className="text-amber-500 shrink-0"
                          title="初期状態で非表示"
                        />
                      )}
                    </div>

                    <div
                      className="flex items-center gap-0.5 shrink-0"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        onClick={() => onReorderElement(item.id, 'up')}
                        disabled={idx === 0}
                        className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-25"
                        title="順番を上へ"
                      >
                        <ChevronUp size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() => onReorderElement(item.id, 'down')}
                        disabled={idx === allPageElements.length - 1}
                        className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-25"
                        title="順番を下へ"
                      >
                        <ChevronDown size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() => onUpdate([item.id], { locked: !item.locked })}
                        className={`p-1 rounded transition-colors ${
                          item.locked
                            ? 'text-amber-600 bg-amber-50'
                            : 'text-slate-400 hover:text-slate-700'
                        }`}
                        title={item.locked ? 'ロック解除' : '動かないようロック'}
                      >
                        {item.locked ? <Lock size={12} /> : <Unlock size={12} />}
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </aside>
    );
  }

  // =========================================================================
  // STATE B: Element Selected -> Clean 4-Tab Task-Driven Inspector
  // =========================================================================
  const paddingSides = getPaddingSides(element.style);
  const marginSides = getMarginSides(element.style);
  const borderW = getEffectiveBorderWidth(element.style);
  const marginActive = hasAnyMargin(element.style);
  const effectiveTag = getEffectiveTag(element);
  const effectiveId = sanitizeHtmlId(element.htmlId, element.id);
  const humanSummary = getElementHumanSummary(element);

  const isEmptyOrDivider =
    element.type === 'divider' ||
    ((element.type === 'rectangle' || element.type === 'circle') &&
      !(element.content || '').trim());
  const minDimension = isEmptyOrDivider ? 1 : 20;

  const updateStyle = (patch: Partial<typeof element.style>) => {
    onUpdate(selectedIds, {
      style: { ...element.style, ...patch },
    });
  };

  const setUniformPadding = (val: number) => {
    const clean = Math.max(0, Number.isFinite(val) ? val : 0);
    updateStyle({
      padding: clean,
      paddingTop: clean,
      paddingRight: clean,
      paddingBottom: clean,
      paddingLeft: clean,
    });
  };

  const setSidePadding = (side: 'top' | 'right' | 'bottom' | 'left', val: number) => {
    const clean = Math.max(0, Number.isFinite(val) ? val : 0);
    const next = { ...paddingSides, [side]: clean };
    updateStyle({
      padding: next.top,
      paddingTop: next.top,
      paddingRight: next.right,
      paddingBottom: next.bottom,
      paddingLeft: next.left,
    });
  };

  const setUniformMargin = (val: number) => {
    const clean = Math.max(0, Number.isFinite(val) ? val : 0);
    updateStyle({
      margin: clean,
      marginTop: clean,
      marginRight: clean,
      marginBottom: clean,
      marginLeft: clean,
    });
  };

  const setSideMargin = (side: 'top' | 'right' | 'bottom' | 'left', val: number) => {
    const clean = Math.max(0, Number.isFinite(val) ? val : 0);
    const next = { ...marginSides, [side]: clean };
    updateStyle({
      margin: next.top,
      marginTop: next.top,
      marginRight: next.right,
      marginBottom: next.bottom,
      marginLeft: next.left,
    });
  };

  const applyShadow = (enabled: boolean, x: number, y: number, blur: number, color: string) => {
    if (enabled) {
      updateStyle({ boxShadow: `${x}px ${y}px ${blur}px ${color}` });
    } else {
      updateStyle({ boxShadow: undefined });
    }
  };

  const selectShadowPreset = (preset: (typeof SHADOW_PRESETS)[number]) => {
    setShadowEnabled(preset.enabled);
    if (preset.enabled) {
      setShadowX(preset.x);
      setShadowY(preset.y);
      setShadowBlur(preset.blur);
      setShadowColor(preset.color);
    }
    applyShadow(preset.enabled, preset.x, preset.y, preset.blur, preset.color);
  };

  const handleShadowChange = (
    key: 'enabled' | 'x' | 'y' | 'blur' | 'color',
    val: boolean | number | string
  ) => {
    let nextEnabled = shadowEnabled;
    let nextX = shadowX;
    let nextY = shadowY;
    let nextBlur = shadowBlur;
    let nextColor = shadowColor;

    if (key === 'enabled') {
      nextEnabled = Boolean(val);
      setShadowEnabled(nextEnabled);
    } else if (key === 'x') {
      nextX = Number(val);
      setShadowX(nextX);
    } else if (key === 'y') {
      nextY = Number(val);
      setShadowY(nextY);
    } else if (key === 'blur') {
      nextBlur = Number(val);
      setShadowBlur(nextBlur);
    } else if (key === 'color') {
      nextColor = String(val);
      setShadowColor(nextColor);
    }

    applyShadow(nextEnabled, nextX, nextY, nextBlur, nextColor);
  };

  const placeSingleHorizontally = (pos: 'left' | 'center' | 'right') => {
    if (elements.length !== 1) return;
    const boxes = getElementBoxes(element, canvasWidth, canvasHeight);
    const m = getMarginSides(element.style);
    const edgeGutter = boxes.boxWidth >= canvasWidth - 80 ? 0 : 40;

    let targetBorderLeft = 0;
    if (pos === 'left') {
      targetBorderLeft = edgeGutter + m.left;
    } else if (pos === 'center') {
      targetBorderLeft = Math.round((canvasWidth - boxes.boxWidth) / 2);
    } else {
      targetBorderLeft = canvasWidth - edgeGutter - m.right - boxes.boxWidth;
    }

    let nextX = 0;
    if (element.anchorX === 'left') {
      nextX = Math.round(targetBorderLeft - m.left);
    } else if (element.anchorX === 'right') {
      nextX = Math.round(canvasWidth - targetBorderLeft - boxes.boxWidth - m.right);
    } else {
      nextX = Math.round(targetBorderLeft + boxes.boxWidth / 2 - canvasWidth / 2 - m.left);
    }

    onUpdate([element.id], { x: nextX });
  };

  const changeAnchor = (newXAnchor: AnchorX, newYAnchor: AnchorY) => {
    const currentBoxes = getElementBoxes(element, canvasWidth, canvasHeight);
    const m = getMarginSides(element.style);

    let nextX = 0;
    if (newXAnchor === 'left') {
      nextX = Math.round(currentBoxes.borderBox.left - m.left);
    } else if (newXAnchor === 'right') {
      nextX = Math.round(canvasWidth - currentBoxes.borderBox.right - m.right);
    } else {
      nextX = Math.round(
        currentBoxes.borderBox.left + currentBoxes.boxWidth / 2 - canvasWidth / 2 - m.left
      );
    }

    let nextY = 0;
    if (newYAnchor === 'top') {
      nextY = Math.round(currentBoxes.borderBox.top - m.top);
    } else if (newYAnchor === 'bottom') {
      nextY = Math.round(canvasHeight - currentBoxes.borderBox.bottom - m.bottom);
    } else {
      nextY = Math.round(
        currentBoxes.borderBox.top + currentBoxes.boxHeight / 2 - canvasHeight / 2 - m.top
      );
    }

    if (elements.length === 1) {
      onUpdate([element.id], {
        anchorX: newXAnchor,
        anchorY: newYAnchor,
        x: nextX,
        y: nextY,
      });
    } else {
      onUpdate(selectedIds, {
        anchorX: newXAnchor,
        anchorY: newYAnchor,
      });
    }
  };

  const updateInteraction = (patch: Partial<NonNullable<EditorElement['interaction']>>) => {
    const current = element.interaction || { event: 'click', action: 'none' };
    onUpdate(selectedIds, {
      interaction: { ...current, ...patch },
    });
  };

  const updateMenuItem = (id: string, field: keyof MenuItem, value: string) => {
    if (!element.menuItems) return;
    const newItems = element.menuItems.map((item) =>
      item.id === id ? { ...item, [field]: value } : item
    );
    onUpdate(selectedIds, { menuItems: newItems });
  };

  const addMenuItem = (position: 'left' | 'right' = 'left') => {
    const newItems = [
      ...(element.menuItems || []),
      {
        id: Date.now().toString(),
        label: '新規メニュー',
        link: '#',
        position,
      },
    ];
    onUpdate(selectedIds, { menuItems: newItems });
  };

  const removeMenuItem = (id: string) => {
    if (!element.menuItems) return;
    onUpdate(selectedIds, {
      menuItems: element.menuItems.filter((item) => item.id !== id),
    });
  };

  const handleDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.setData('text/plain', id);
    e.dataTransfer.effectAllowed = 'move';
    setDraggedItemId(id);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, targetPosition: 'left' | 'right', targetId?: string) => {
    e.preventDefault();
    const droppedId = e.dataTransfer.getData('text/plain');
    if (!droppedId || !element.menuItems) return;
    if (droppedId === targetId) {
      setDraggedItemId(null);
      return;
    }
    const items = [...element.menuItems];
    const draggedIndex = items.findIndex((i) => i.id === droppedId);
    if (draggedIndex === -1) return;
    const draggedItem = { ...items[draggedIndex], position: targetPosition };
    items.splice(draggedIndex, 1);
    if (targetId) {
      const targetIndex = items.findIndex((i) => i.id === targetId);
      if (targetIndex !== -1) items.splice(targetIndex, 0, draggedItem);
      else items.push(draggedItem);
    } else {
      items.push(draggedItem);
    }
    onUpdate([element.id], { menuItems: items });
    setDraggedItemId(null);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          onUpdate(selectedIds, {
            src: event.target.result as string,
            imageName: file.name,
            alt: element.alt || file.name.replace(/\.[^.]+$/, ''),
          });
        }
      };
      reader.readAsDataURL(file);
    }
    e.target.value = '';
  };

  const handleVideoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const objectUrl = URL.createObjectURL(file);
      onUpdate(selectedIds, {
        src: objectUrl,
        imageName: file.name,
        alt: element.alt || file.name.replace(/\.[^.]+$/, ''),
      });
    }
    e.target.value = '';
  };

  const handleAudioUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const objectUrl = URL.createObjectURL(file);
      onUpdate(selectedIds, {
        src: objectUrl,
        imageName: file.name,
        alt: file.name.replace(/\.[^.]+$/, ''),
      });
    }
    e.target.value = '';
  };

  const handlePosterUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          onUpdate(selectedIds, {
            poster: event.target.result as string,
            posterName: file.name,
          });
        }
      };
      reader.readAsDataURL(file);
    }
    e.target.value = '';
  };

  const handleSvgUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          onUpdate(selectedIds, {
            svgContent: event.target.result as string,
          });
        }
      };
      reader.readAsText(file);
    }
    e.target.value = '';
  };

  const alignElements = (type: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom') => {
    if (elements.length <= 1) return;
    const minX = Math.min(...elements.map((el) => el.x));
    const maxX = Math.max(...elements.map((el) => el.x + el.width));
    const minY = Math.min(...elements.map((el) => el.y));
    const maxY = Math.max(...elements.map((el) => el.y + el.height));

    switch (type) {
      case 'left':
        onUpdate(selectedIds, { x: minX });
        break;
      case 'right':
        elements.forEach((el) => onUpdate([el.id], { x: maxX - el.width }));
        break;
      case 'center': {
        const centerX = Math.round((minX + maxX) / 2);
        elements.forEach((el) => onUpdate([el.id], { x: Math.round(centerX - el.width / 2) }));
        break;
      }
      case 'top':
        onUpdate(selectedIds, { y: minY });
        break;
      case 'bottom':
        elements.forEach((el) => onUpdate([el.id], { y: maxY - el.height }));
        break;
      case 'middle': {
        const centerY = Math.round((minY + maxY) / 2);
        elements.forEach((el) => onUpdate([el.id], { y: Math.round(centerY - el.height / 2) }));
        break;
      }
    }
  };

  const stackElements = (direction: 'horizontal' | 'vertical') => {
    if (elements.length <= 1) return;
    const sorted = [...elements].sort((a, b) =>
      direction === 'horizontal' ? a.x - b.x : a.y - b.y
    );
    let currentPos = direction === 'horizontal' ? sorted[0].x : sorted[0].y;

    sorted.forEach((el) => {
      const m = getMarginSides(el.style);
      if (direction === 'horizontal') {
        onUpdate([el.id], { x: currentPos });
        currentPos += el.width + m.left + m.right + 16;
      } else {
        onUpdate([el.id], { y: currentPos });
        currentPos += el.height + m.top + m.bottom + 16;
      }
    });
  };

  const copySnippet = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 1500);
    } catch {
      // Ignore
    }
  };

  const renderMenuItemsList = (position: 'left' | 'right') => {
    const items = element.menuItems?.filter((i) => (i.position || 'left') === position) || [];
    return (
      <div
        className="space-y-2 p-2.5 rounded-xl border border-slate-200 bg-slate-50/70"
        onDragOver={handleDragOver}
        onDrop={(e) => handleDrop(e, position)}
      >
        <span className="text-[11px] font-medium text-slate-600 block">
          {position === 'left' ? '左側に並べる項目' : '右側に並べる項目'}
        </span>
        {items.map((item) => (
          <div
            key={item.id}
            className={`flex flex-col gap-1.5 p-2 border border-slate-200 rounded-lg bg-white transition-opacity ${
              draggedItemId === item.id ? 'opacity-40' : ''
            }`}
            draggable
            onDragStart={(e) => handleDragStart(e, item.id)}
            onDragOver={handleDragOver}
            onDrop={(e) => {
              e.stopPropagation();
              handleDrop(e, position, item.id);
            }}
          >
            <div className="flex gap-1.5 items-center">
              <div
                className="cursor-grab text-slate-400 hover:text-slate-600"
                title="ドラッグで並び替え"
              >
                <GripVertical size={13} />
              </div>
              <input
                className="flex-1 px-2 py-1 border border-slate-200 rounded text-xs"
                placeholder="表示する文字（例: メニュー）"
                value={item.label}
                onChange={(e) => updateMenuItem(item.id, 'label', e.target.value)}
              />
              <button
                type="button"
                onClick={() => removeMenuItem(item.id)}
                className="text-slate-400 hover:text-red-500 p-0.5"
                title="削除"
              >
                <Trash2 size={13} />
              </button>
            </div>
            <input
              className="w-full px-2 py-1 border border-slate-200 rounded text-xs text-slate-600"
              placeholder="移動先URL（https://... または #ID）"
              value={item.link}
              onChange={(e) => updateMenuItem(item.id, 'link', e.target.value)}
            />
          </div>
        ))}
        <button
          type="button"
          onClick={() => addMenuItem(position)}
          className="w-full py-1.5 text-xs border border-dashed border-slate-300 rounded-lg text-slate-600 hover:bg-white flex items-center justify-center gap-1 transition-colors"
        >
          <Plus size={12} /> 項目を追加
        </button>
      </div>
    );
  };

  const availableTagOptions =
    element.type === 'text'
      ? TEXT_TAGS
      : element.type === 'rectangle'
        ? BOX_TAGS
        : element.type === 'button'
          ? BUTTON_TAGS
          : element.type === 'navigation' && element.navType === 'horizontal'
            ? NAV_TAGS
            : null;

  const autoHeightActive = isAutoHeightElement(element);
  const currentRadiusUnit =
    element.style.borderRadiusUnit || (element.type === 'circle' ? '%' : 'px');
  const currentRadiusVal = element.style.borderRadius ?? (element.type === 'circle' ? 50 : 0);
  const hasBorder = (element.style.borderWidth ?? 0) > 0 || element.type === 'divider';

  const isLocalDataImage = Boolean(
    element.src && (element.src.startsWith('data:') || element.src.startsWith('blob:'))
  );

  const switchMediaMode = (targetMode: 'image' | 'video' | 'audio' | 'svg') => {
    const curMode = element.mediaType || 'image';
    if (curMode === targetMode) return;

    const maxLockedOverlayZ = allPageElements.reduce((max, item) => {
      if (!item.locked || item.style.position === 'fixed' || item.type === 'navigation') return max;
      return Math.max(max, item.style.zIndex ?? 1);
    }, 1);
    const safeMediaZ = Math.max(element.style.zIndex ?? 1, maxLockedOverlayZ + 1);

    if (targetMode === 'video') {
      onUpdate(selectedIds, {
        mediaType: 'video',
        tagName: 'video',
        src: '',
        imageName: undefined,
        poster: element.poster || undefined,
        alt: element.alt && element.alt !== 'サンプル音声' ? element.alt : '紹介ムービー',
        mediaControls: element.mediaControls ?? true,
        height:
          element.height < 100
            ? Math.max(180, Math.round((element.width * 9) / 16))
            : element.height,
        style: {
          ...element.style,
          backgroundColor: '#0F172A',
          borderRadius: element.style.borderRadius || 6,
          overflow: 'hidden',
          zIndex: safeMediaZ,
        },
      });
    } else if (targetMode === 'audio') {
      onUpdate(selectedIds, {
        mediaType: 'audio',
        tagName: 'audio',
        src: getSampleAudioDataUri(),
        imageName: 'sample-audio.wav',
        alt: 'サンプル音声',
        mediaControls: element.mediaControls ?? true,
        height: 54,
        style: {
          ...element.style,
          backgroundColor: 'transparent',
          borderRadius: 0,
          zIndex: safeMediaZ,
        },
      });
    } else if (targetMode === 'svg') {
      onUpdate(selectedIds, {
        mediaType: 'svg',
        tagName: 'div',
        height: element.height < 80 ? 120 : element.height,
        style: {
          ...element.style,
          zIndex: safeMediaZ,
        },
      });
    } else {
      onUpdate(selectedIds, {
        mediaType: 'image',
        tagName: 'img',
        src: curMode === 'audio' ? '' : element.src,
        imageName: curMode === 'audio' ? undefined : element.imageName,
        height: element.height < 100 ? 220 : element.height,
        style: {
          ...element.style,
          backgroundColor: 'transparent',
          zIndex: safeMediaZ,
        },
      });
    }
  };

  // Determine 3-way link mode cleanly so "リンクなし" hides all extra inputs
  const activeLinkMode = element.link
    ? element.linkType === 'page'
      ? 'page'
      : 'url'
    : explicitLinkTab;

  const hasTypography =
    element.type === 'text' ||
    element.type === 'button' ||
    element.type === 'navigation' ||
    Boolean(element.content);

  return (
    <aside className="w-[340px] bg-white border-l border-slate-200 flex flex-col z-10 shrink-0 h-full overflow-hidden">
      {/* Calm Sticky Header + 4-Step Category Bar */}
      <div className="px-4 py-3 border-b border-slate-200 bg-slate-50/80 shrink-0 space-y-2.5">
        <div className="flex justify-between items-center gap-2">
          <div className="min-w-0 flex-1">
            {elements.length > 1 ? (
              <span className="font-semibold text-slate-900 text-xs block">
                {elements.length}個のパーツを選択中
              </span>
            ) : (
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="font-semibold text-slate-900 text-xs shrink-0">
                  {humanSummary.kindLabel}
                </span>
                {humanSummary.previewText && (
                  <span className="text-xs text-slate-500 truncate">
                    {humanSummary.previewText}
                  </span>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-0.5 shrink-0">
            <button
              type="button"
              onClick={() => onUpdate(selectedIds, { locked: !element.locked })}
              className={`p-1.5 rounded-md transition-colors ${
                element.locked
                  ? 'text-amber-600 bg-amber-50 hover:bg-amber-100'
                  : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200/60'
              }`}
              title={element.locked ? 'ロック解除' : '動かないようロック'}
            >
              {element.locked ? <Lock size={14} /> : <Unlock size={14} />}
            </button>
            <button
              type="button"
              onClick={() => onDuplicate(selectedIds)}
              className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-slate-200/60 rounded-md transition-colors"
              title="複製"
            >
              <Copy size={14} />
            </button>
            <button
              type="button"
              onClick={() => onDelete(selectedIds)}
              className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
              title="削除"
            >
              <Trash2 size={14} />
            </button>
            <button
              type="button"
              onClick={() => onSelectElement(null)}
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-md transition-colors"
              title="選択解除してページ全体設定へ"
            >
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Clean Category Tabs (Eliminates crowding & endless scrolling) */}
        <div className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-lg">
          <button
            type="button"
            onClick={() => setElementTab('basic')}
            className={`flex-1 py-1.5 px-1.5 text-[11px] font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
              elementTab === 'basic'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            内容・余白
          </button>
          <button
            type="button"
            onClick={() => setElementTab('design')}
            className={`flex-1 py-1.5 px-1.5 text-[11px] font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
              elementTab === 'design'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            デザイン
          </button>
          {elements.length === 1 && (
            <>
              <button
                type="button"
                onClick={() => setElementTab('motion')}
                className={`flex-1 py-1.5 px-1.5 text-[11px] font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  elementTab === 'motion'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                動き・リンク
              </button>
              <button
                type="button"
                onClick={() => setElementTab('pro')}
                className={`flex-1 py-1.5 px-1.5 text-[11px] font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  elementTab === 'pro'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                詳細・コード
              </button>
            </>
          )}
        </div>
      </div>

      {/* Scrollable Inspector Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5 pb-12">
        {/* Multi-Select Alignment Bar */}
        {elements.length > 1 && (
          <section className="space-y-2 pb-4 border-b border-slate-200">
            <FieldLabel label="選択したパーツを揃える・並べる" />
            <div className="grid grid-cols-4 gap-1.5">
              <button
                type="button"
                onClick={() => alignElements('left')}
                className="p-2 bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center justify-center text-slate-700"
                title="左揃え"
              >
                <AlignLeft size={15} />
              </button>
              <button
                type="button"
                onClick={() => alignElements('center')}
                className="p-2 bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center justify-center text-slate-700"
                title="左右中央揃え"
              >
                <AlignCenter size={15} />
              </button>
              <button
                type="button"
                onClick={() => alignElements('right')}
                className="p-2 bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center justify-center text-slate-700"
                title="右揃え"
              >
                <AlignRight size={15} />
              </button>
              <button
                type="button"
                onClick={() => alignElements('top')}
                className="p-2 bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center justify-center text-slate-700"
                title="上揃え"
              >
                <AlignStartVertical size={15} />
              </button>
              <button
                type="button"
                onClick={() => alignElements('middle')}
                className="p-2 bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center justify-center text-slate-700"
                title="上下中央揃え"
              >
                <AlignCenterVertical size={15} />
              </button>
              <button
                type="button"
                onClick={() => alignElements('bottom')}
                className="p-2 bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center justify-center text-slate-700"
                title="下揃え"
              >
                <AlignEndVertical size={15} />
              </button>
              <button
                type="button"
                onClick={() => stackElements('horizontal')}
                className="p-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg flex items-center justify-center"
                title="横に等間隔で並べる"
              >
                <ArrowRight size={15} />
              </button>
              <button
                type="button"
                onClick={() => stackElements('vertical')}
                className="p-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg flex items-center justify-center"
                title="縦に等間隔で並べる"
              >
                <ArrowDown size={15} />
              </button>
            </div>
          </section>
        )}

        {/* ================================================================
            TAB 1: 内容・余白 (Content + Padding/Margin directly below + Layout)
           ================================================================ */}
        {elementTab === 'basic' && (
          <>
            {/* 1. Content Section */}
            <section className="space-y-3">
              {/* Quick 4-Choice Role Selector for Text */}
              {element.type === 'text' && (
                <div>
                  <FieldLabel label="文章の種類" />
                  <div className="grid grid-cols-4 gap-1 p-1 bg-slate-100 rounded-lg">
                    {(
                      [
                        ['h1', '大見出し'],
                        ['h2', '中見出し'],
                        ['h3', '小見出し'],
                        ['p', '本文'],
                      ] as const
                    ).map(([tagVal, label]) => (
                      <button
                        key={tagVal}
                        type="button"
                        onClick={() => onUpdate(selectedIds, { tagName: tagVal })}
                        className={`py-1 rounded-md text-[11px] font-medium transition-colors whitespace-nowrap shrink-0 ${
                          effectiveTag === tagVal
                            ? 'bg-white text-indigo-700 shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Textarea for Text / Button / Box / Circle */}
              {(element.type === 'text' ||
                element.type === 'button' ||
                element.type === 'rectangle' ||
                element.type === 'circle') && (
                <div className="space-y-2.5">
                  <div>
                    <FieldLabel
                      label={
                        element.type === 'button'
                          ? 'ボタンの文字'
                          : element.type === 'text'
                            ? 'テキスト内容'
                            : '枠内の文字（空欄でもOK）'
                      }
                    />
                    <textarea
                      className="w-full p-2.5 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 outline-none leading-relaxed"
                      rows={element.type === 'text' ? 3 : 2}
                      value={element.content || ''}
                      placeholder={
                        element.type === 'rectangle'
                          ? '空欄のままにすると背景ボックス・カード枠として使えます'
                          : 'ここに文字を入力（キャンバス上でダブルクリック編集も可）'
                      }
                      onChange={(e) => onUpdate(selectedIds, { content: e.target.value })}
                    />
                  </div>

                  {(element.type === 'text' ||
                    element.type === 'button' ||
                    (element.type === 'rectangle' && Boolean((element.content || '').trim()))) &&
                    element.style.writingMode !== 'vertical-rl' && (
                      <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2">
                        <label className="flex items-center justify-between gap-2 cursor-pointer select-none">
                          <span className="text-xs text-slate-700">
                            文字量に合わせて高さを自動調整
                          </span>
                          <input
                            type="checkbox"
                            checked={autoHeightActive}
                            onChange={(e) =>
                              onUpdate(selectedIds, { autoHeight: e.target.checked })
                            }
                            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                          />
                        </label>
                        {autoHeightActive && (
                          <label className="flex items-center justify-between gap-2 cursor-pointer select-none pt-1.5 border-t border-slate-200/70">
                            <span className="text-[11px] text-slate-500">
                              行が増えたら下のパーツも自動で押し下げる
                            </span>
                            <input
                              type="checkbox"
                              checked={activePage.autoFlow !== false}
                              onChange={(e) => onUpdatePage({ autoFlow: e.target.checked })}
                              className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                            />
                          </label>
                        )}
                      </div>
                    )}
                </div>
              )}

              {/* Media Content (Image / Video / Audio / SVG) */}
              {element.type === 'media' && (
                <div className="space-y-3">
                  {/* 4-Way Media Type Switcher */}
                  <div>
                    <FieldLabel label="メディアの種類" />
                    <div className="grid grid-cols-4 gap-1 p-1 bg-slate-100 rounded-lg text-[11px]">
                      {(
                        [
                          ['image', '画像'],
                          ['video', '動画'],
                          ['audio', '音声'],
                          ['svg', 'SVG'],
                        ] as const
                      ).map(([modeVal, modeLabel]) => {
                        const isCurMode = (element.mediaType || 'image') === modeVal;
                        return (
                          <button
                            key={modeVal}
                            type="button"
                            onClick={() => switchMediaMode(modeVal)}
                            className={`py-1.5 px-1.5 rounded-md font-medium transition-colors whitespace-nowrap shrink-0 ${
                              isCurMode
                                ? 'bg-white text-indigo-700 shadow-xs'
                                : 'text-slate-600 hover:text-slate-900'
                            }`}
                          >
                            {modeLabel}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {element.mediaType === 'svg' ? (
                    <div className="space-y-2.5">
                      <button
                        type="button"
                        onClick={() => svgInputRef.current?.click()}
                        className="flex items-center justify-center gap-1.5 w-full py-2.5 bg-indigo-50 hover:bg-indigo-100/80 rounded-lg border border-indigo-200 transition-colors text-xs font-medium text-indigo-700 whitespace-nowrap shrink-0"
                      >
                        <Upload size={14} />
                        <span>パソコンから SVG ファイルを選ぶ</span>
                      </button>
                      <input
                        type="file"
                        ref={svgInputRef}
                        className="hidden"
                        accept=".svg"
                        onChange={handleSvgUpload}
                      />
                      <FieldLabel label="SVGコード" spec="<svg>" />
                      <textarea
                        className="w-full p-2.5 border border-slate-200 rounded-lg font-mono text-[11px] focus:ring-2 focus:ring-indigo-500 outline-none"
                        rows={4}
                        value={element.svgContent || ''}
                        onChange={(e) => onUpdate(selectedIds, { svgContent: e.target.value })}
                        placeholder="<svg viewBox='0 0 24 24'>...</svg>"
                      />
                    </div>
                  ) : element.mediaType === 'video' ? (
                    (() => {
                      const parsedVideo = parseVideoEmbed(element.src, {
                        controls: element.mediaControls !== false,
                        autoplay: false,
                        loop: Boolean(element.mediaLoop),
                        muted: true,
                      });
                      const isLocalVideo = Boolean(
                        element.src &&
                          (element.src.startsWith('blob:') ||
                            element.src.startsWith('data:') ||
                            element.src.startsWith('/') ||
                            element.src.startsWith('./'))
                      );

                      return (
                        <div className="space-y-3">
                          {/* Video Preview & Upload Card */}
                          <div className="rounded-xl border border-slate-200 bg-slate-50 p-2.5 space-y-2.5">
                            <div className="h-36 rounded-lg bg-slate-950 overflow-hidden flex items-center justify-center relative">
                              {parsedVideo.kind === 'iframe' ? (
                                <iframe
                                  src={parsedVideo.embedUrl}
                                  title={element.alt || '動画プレビュー'}
                                  referrerPolicy="strict-origin-when-cross-origin"
                                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                  className="w-full h-full border-0 block"
                                />
                              ) : parsedVideo.src ? (
                                <video
                                  src={parsedVideo.src}
                                  poster={element.poster || undefined}
                                  controls
                                  muted
                                  playsInline
                                  preload="metadata"
                                  onLoadedMetadata={(ev) => {
                                    const v = ev.currentTarget;
                                    if (!element.poster && v.currentTime === 0) {
                                      try {
                                        v.currentTime = 0.01;
                                      } catch {
                                        // Ignore seek errors on streaming media
                                      }
                                    }
                                  }}
                                  className="w-full h-full object-contain block"
                                />
                              ) : (
                                <div className="flex flex-col items-center gap-1.5 text-slate-400 px-3 text-center">
                                  <Film size={22} />
                                  <span className="text-[11px]">
                                    動画ファイルを選ぶか、YouTube URLを入力してください
                                  </span>
                                </div>
                              )}
                            </div>

                            {isLocalVideo && element.imageName && (
                              <div className="flex items-center justify-between gap-2 px-2 py-1 rounded bg-white border border-slate-200 text-[11px]">
                                <span className="text-slate-700 truncate font-medium">
                                  {element.imageName}
                                </span>
                                <button
                                  type="button"
                                  onClick={() =>
                                    onUpdate(selectedIds, { src: '', imageName: undefined })
                                  }
                                  className="text-slate-400 hover:text-red-600 whitespace-nowrap shrink-0"
                                >
                                  クリア
                                </button>
                              </div>
                            )}

                            <button
                              type="button"
                              onClick={() => videoInputRef.current?.click()}
                              className="flex items-center justify-center gap-1.5 w-full py-2 bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors text-xs font-medium text-white whitespace-nowrap shrink-0"
                            >
                              <Upload size={14} />
                              <span>パソコンから動画を選ぶ (MP4 / WebM)</span>
                            </button>
                            <input
                              type="file"
                              ref={videoInputRef}
                              className="hidden"
                              accept="video/mp4,video/webm,video/ogg,video/quicktime,video/*"
                              onChange={handleVideoUpload}
                            />
                          </div>

                          {/* YouTube / Vimeo / Direct Video URL Input */}
                          <div className="space-y-1.5">
                            <FieldLabel
                              label="YouTube・Vimeo・動画URL"
                              spec="src / iframe"
                              helpText="YouTubeやVimeoの視聴ページURL、共有の埋め込みコード（<iframe>）、またはWeb上の .mp4 アドレスをそのまま貼り付けできます。"
                            />
                            <input
                              type="text"
                              className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs font-mono focus:ring-2 focus:ring-indigo-500 outline-none"
                              value={isLocalVideo ? '' : element.src || ''}
                              onChange={(e) => {
                                const cleanedUrl = extractIframeSrc(e.target.value);
                                onUpdate(selectedIds, {
                                  src: cleanedUrl,
                                  imageName: undefined,
                                });
                              }}
                              placeholder={
                                isLocalVideo
                                  ? '選択中の動画を使用中（URL入力で切り替え）'
                                  : 'https://www.youtube.com/watch?v=... または .mp4 URL'
                              }
                            />
                            {parsedVideo.kind === 'iframe' && (
                              <p className="text-[11px] text-indigo-600">
                                {parsedVideo.providerLabel}の埋め込みプレイヤーとして自動変換されました
                              </p>
                            )}
                          </div>

                          {/* Playback Options */}
                          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/90 space-y-2">
                            <span className="text-[11px] font-semibold text-slate-700 block">
                              再生オプション
                            </span>
                            <label className="flex items-center justify-between gap-2 cursor-pointer select-none">
                              <span className="text-xs text-slate-700">
                                操作バー・音量ボタンを表示
                              </span>
                              <input
                                type="checkbox"
                                checked={element.mediaControls !== false}
                                onChange={(e) =>
                                  onUpdate(selectedIds, { mediaControls: e.target.checked })
                                }
                                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                              />
                            </label>
                            <label className="flex items-center justify-between gap-2 cursor-pointer select-none">
                              <div>
                                <span className="text-xs text-slate-700 block">
                                  ページを開いたら自動再生
                                </span>
                                <span className="text-[10px] text-slate-500">
                                  ブラウザ仕様に合わせて自動で消音になります
                                </span>
                              </div>
                              <input
                                type="checkbox"
                                checked={Boolean(element.mediaAutoplay)}
                                onChange={(e) =>
                                  onUpdate(selectedIds, {
                                    mediaAutoplay: e.target.checked,
                                    ...(e.target.checked ? { mediaMuted: true } : {}),
                                  })
                                }
                                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer shrink-0"
                              />
                            </label>
                            <label className="flex items-center justify-between gap-2 cursor-pointer select-none">
                              <span className="text-xs text-slate-700">繰り返しループ再生</span>
                              <input
                                type="checkbox"
                                checked={Boolean(element.mediaLoop)}
                                onChange={(e) =>
                                  onUpdate(selectedIds, { mediaLoop: e.target.checked })
                                }
                                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                              />
                            </label>
                            <label className="flex items-center justify-between gap-2 cursor-pointer select-none">
                              <span className="text-xs text-slate-700">最初から消音（ミュート）</span>
                              <input
                                type="checkbox"
                                checked={Boolean(element.mediaMuted || element.mediaAutoplay)}
                                onChange={(e) =>
                                  onUpdate(selectedIds, { mediaMuted: e.target.checked })
                                }
                                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                              />
                            </label>
                          </div>

                          {parsedVideo.kind === 'native' && (
                            <div>
                              <FieldLabel label="枠に対する映像の収め方" spec="object-fit" />
                              <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-lg">
                                <button
                                  type="button"
                                  onClick={() => updateStyle({ objectFit: 'cover' })}
                                  className={`py-1.5 px-2 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                                    (element.style.objectFit || 'cover') === 'cover'
                                      ? 'bg-white text-slate-900 shadow-xs'
                                      : 'text-slate-600 hover:text-slate-900'
                                  }`}
                                >
                                  枠いっぱいにフィット
                                </button>
                                <button
                                  type="button"
                                  onClick={() => updateStyle({ objectFit: 'contain' })}
                                  className={`py-1.5 px-2 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                                    element.style.objectFit === 'contain'
                                      ? 'bg-white text-slate-900 shadow-xs'
                                      : 'text-slate-600 hover:text-slate-900'
                                  }`}
                                >
                                  切らずに全体を表示
                                </button>
                              </div>
                            </div>
                          )}

                          {/* Poster & Title Accordion */}
                          <div className="pt-0.5">
                            <button
                              type="button"
                              onClick={() => setShowMediaAdvanced((v) => !v)}
                              className="w-full flex items-center justify-between py-1 text-[11px] text-slate-500 hover:text-slate-800"
                            >
                              <span>動画タイトル・表紙サムネイル（poster）設定</span>
                              {showMediaAdvanced ? (
                                <ChevronUp size={13} />
                              ) : (
                                <ChevronDown size={13} />
                              )}
                            </button>
                            {showMediaAdvanced && (
                              <div className="pt-2 space-y-2.5">
                                <div>
                                  <FieldLabel
                                    label="動画のタイトル・説明"
                                    spec={parsedVideo.kind === 'iframe' ? 'title' : 'aria-label'}
                                  />
                                  <input
                                    type="text"
                                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 outline-none"
                                    value={element.alt || ''}
                                    onChange={(e) =>
                                      onUpdate(selectedIds, { alt: e.target.value })
                                    }
                                    placeholder="例: 客室露天風呂のご案内ムービー"
                                  />
                                </div>
                                {parsedVideo.kind === 'native' && (
                                  <div className="space-y-1.5">
                                    <FieldLabel
                                      label="再生前の表紙サムネイル画像"
                                      spec="poster"
                                    />
                                    <div className="flex items-center gap-1.5">
                                      <button
                                        type="button"
                                        onClick={() => posterInputRef.current?.click()}
                                        className="flex-1 py-1.5 px-2.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-medium text-slate-700 flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
                                      >
                                        <ImageIcon size={13} />
                                        <span>表紙画像を選ぶ</span>
                                      </button>
                                      {element.poster && (
                                        <button
                                          type="button"
                                          onClick={() =>
                                            onUpdate(selectedIds, {
                                              poster: undefined,
                                              posterName: undefined,
                                            })
                                          }
                                          className="py-1.5 px-2.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs text-slate-500 hover:text-red-600 whitespace-nowrap shrink-0"
                                        >
                                          解除
                                        </button>
                                      )}
                                    </div>
                                    <input
                                      type="file"
                                      ref={posterInputRef}
                                      className="hidden"
                                      accept="image/*"
                                      onChange={handlePosterUpload}
                                    />
                                  </div>
                                )}
                              </div>
                            )}
                          </div>

                          {onEnterPreview && (
                            <button
                              type="button"
                              onClick={onEnterPreview}
                              className="w-full py-2 px-3 rounded-xl bg-indigo-50 hover:bg-indigo-100/80 border border-indigo-200 text-indigo-700 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
                            >
                              <Eye size={13} />
                              <span>実画面プレビューで再生を確認</span>
                            </button>
                          )}
                        </div>
                      );
                    })()
                  ) : element.mediaType === 'audio' ? (
                    (() => {
                      const isLocalAudio = Boolean(
                        element.src &&
                          (element.src.startsWith('blob:') ||
                            element.src.startsWith('data:') ||
                            element.src.startsWith('/') ||
                            element.src.startsWith('./'))
                      );

                      return (
                        <div className="space-y-3">
                          {/* Live Audio Test Player & Upload Card */}
                          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2.5">
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <Volume2 size={14} className="text-indigo-600 shrink-0" />
                                <span className="text-xs font-medium text-slate-800 truncate">
                                  {element.imageName || element.alt || '音声プレイヤー'}
                                </span>
                              </div>
                              {element.imageName !== 'sample-audio.wav' && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    onUpdate(selectedIds, {
                                      src: getSampleAudioDataUri(),
                                      imageName: 'sample-audio.wav',
                                      alt: 'サンプル音声',
                                    })
                                  }
                                  className="text-[11px] text-slate-400 hover:text-indigo-600 whitespace-nowrap shrink-0"
                                >
                                  サンプル音に戻す
                                </button>
                              )}
                            </div>

                            {element.src && (
                              <audio
                                src={element.src}
                                controls
                                preload="metadata"
                                className="w-full h-9 block"
                              />
                            )}

                            <button
                              type="button"
                              onClick={() => audioInputRef.current?.click()}
                              className="flex items-center justify-center gap-1.5 w-full py-2 bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors text-xs font-medium text-white whitespace-nowrap shrink-0"
                            >
                              <Upload size={14} />
                              <span>パソコンから音声を選ぶ (MP3 / WAV / M4A)</span>
                            </button>
                            <input
                              type="file"
                              ref={audioInputRef}
                              className="hidden"
                              accept="audio/mpeg,audio/wav,audio/ogg,audio/mp4,audio/aac,audio/*"
                              onChange={handleAudioUpload}
                            />
                          </div>

                          {/* Direct Audio URL Input */}
                          <div>
                            <FieldLabel
                              label="Web上の音声アドレス (URL)"
                              spec="src"
                              helpText="外部サーバーにある .mp3 / .wav / .ogg ファイルのURLを直接指定することもできます。"
                            />
                            <input
                              type="text"
                              className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs font-mono focus:ring-2 focus:ring-indigo-500 outline-none"
                              value={isLocalAudio ? '' : element.src || ''}
                              onChange={(e) =>
                                onUpdate(selectedIds, {
                                  src: e.target.value.trim(),
                                  imageName: undefined,
                                })
                              }
                              placeholder={
                                isLocalAudio
                                  ? '選択中の音源を使用中（URL入力で切り替え）'
                                  : 'https://example.com/bgm.mp3'
                              }
                            />
                          </div>

                          {/* Audio Playback Options */}
                          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/90 space-y-2">
                            <span className="text-[11px] font-semibold text-slate-700 block">
                              再生オプション
                            </span>
                            <label className="flex items-center justify-between gap-2 cursor-pointer select-none">
                              <div>
                                <span className="text-xs text-slate-700 block">
                                  再生プレイヤーバーを表示
                                </span>
                                <span className="text-[10px] text-slate-500">
                                  オフにすると画面にバーを出さないBGM設定になります
                                </span>
                              </div>
                              <input
                                type="checkbox"
                                checked={element.mediaControls !== false}
                                onChange={(e) =>
                                  onUpdate(selectedIds, { mediaControls: e.target.checked })
                                }
                                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer shrink-0"
                              />
                            </label>
                            <label className="flex items-center justify-between gap-2 cursor-pointer select-none">
                              <span className="text-xs text-slate-700">
                                繰り返しループ再生（BGM向け）
                              </span>
                              <input
                                type="checkbox"
                                checked={Boolean(element.mediaLoop)}
                                onChange={(e) =>
                                  onUpdate(selectedIds, { mediaLoop: e.target.checked })
                                }
                                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                              />
                            </label>
                            <label className="flex items-center justify-between gap-2 cursor-pointer select-none">
                              <span className="text-xs text-slate-700">
                                ページを開いたら自動再生を試みる
                              </span>
                              <input
                                type="checkbox"
                                checked={Boolean(element.mediaAutoplay)}
                                onChange={(e) =>
                                  onUpdate(selectedIds, { mediaAutoplay: e.target.checked })
                                }
                                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                              />
                            </label>
                            <label className="flex items-center justify-between gap-2 cursor-pointer select-none">
                              <span className="text-xs text-slate-700">初期状態で消音にする</span>
                              <input
                                type="checkbox"
                                checked={Boolean(element.mediaMuted)}
                                onChange={(e) =>
                                  onUpdate(selectedIds, { mediaMuted: e.target.checked })
                                }
                                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                              />
                            </label>
                          </div>

                          <div>
                            <FieldLabel label="音声のタイトル・説明" spec="aria-label" />
                            <input
                              type="text"
                              className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 outline-none"
                              value={element.alt || ''}
                              onChange={(e) => onUpdate(selectedIds, { alt: e.target.value })}
                              placeholder="例: 渓谷のせせらぎ環境音"
                            />
                          </div>

                          {onEnterPreview && (
                            <button
                              type="button"
                              onClick={onEnterPreview}
                              className="w-full py-2 px-3 rounded-xl bg-indigo-50 hover:bg-indigo-100/80 border border-indigo-200 text-indigo-700 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
                            >
                              <Eye size={13} />
                              <span>実画面プレビューで再生を確認</span>
                            </button>
                          )}
                        </div>
                      );
                    })()
                  ) : (
                    <div className="space-y-3">
                      {/* Visual Thumbnail Preview Card */}
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-2.5 space-y-2.5">
                        <div className="h-28 rounded-lg bg-slate-200/60 overflow-hidden flex items-center justify-center relative">
                          {element.src ? (
                            <img
                              src={element.src}
                              alt={element.alt || 'プレビュー'}
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-contain"
                            />
                          ) : (
                            <ImageIcon size={24} className="text-slate-400" />
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="flex items-center justify-center gap-1.5 w-full py-2 bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors text-xs font-medium text-white whitespace-nowrap shrink-0"
                        >
                          <Upload size={14} />
                          <span>パソコンから画像を選んで変更</span>
                        </button>
                        <input
                          type="file"
                          ref={fileInputRef}
                          className="hidden"
                          accept="image/*"
                          onChange={handleFileUpload}
                        />
                      </div>

                      <div>
                        <FieldLabel label="枠に対する写真の収め方" spec="object-fit" />
                        <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-lg">
                          <button
                            type="button"
                            onClick={() => updateStyle({ objectFit: 'cover' })}
                            className={`py-1.5 px-2 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                              (element.style.objectFit || 'cover') === 'cover'
                                ? 'bg-white text-slate-900 shadow-xs'
                                : 'text-slate-600 hover:text-slate-900'
                            }`}
                          >
                            枠いっぱいにフィット
                          </button>
                          <button
                            type="button"
                            onClick={() => updateStyle({ objectFit: 'contain' })}
                            className={`py-1.5 px-2 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                              element.style.objectFit === 'contain'
                                ? 'bg-white text-slate-900 shadow-xs'
                                : 'text-slate-600 hover:text-slate-900'
                            }`}
                          >
                            切らずに全体を表示
                          </button>
                        </div>
                      </div>

                      <div>
                        <FieldLabel
                          label="画像の説明（検索・読み上げ用）"
                          spec="alt"
                          helpText="何の写真かを短い言葉で書いておくと、目の不自由な方の音声読み上げやGoogle検索に役立ちます。"
                        />
                        <input
                          type="text"
                          className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 outline-none"
                          value={element.alt || ''}
                          onChange={(e) => onUpdate(selectedIds, { alt: e.target.value })}
                          placeholder="例: 淹れたてのハンドドリップ珈琲"
                        />
                      </div>

                      {/* Quiet Accordion for Web Image URL */}
                      <div className="pt-0.5">
                        <button
                          type="button"
                          onClick={() => setShowMediaAdvanced((v) => !v)}
                          className="w-full flex items-center justify-between py-1 text-[11px] text-slate-500 hover:text-slate-800"
                        >
                          <span>Web上の画像アドレス (URL) を直接入力</span>
                          {showMediaAdvanced ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                        </button>
                        {showMediaAdvanced && (
                          <div className="pt-2">
                            <input
                              type="text"
                              className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs font-mono"
                              value={isLocalDataImage ? '' : element.src || ''}
                              onChange={(e) =>
                                onUpdate(selectedIds, {
                                  src: e.target.value,
                                  imageName: undefined,
                                })
                              }
                              placeholder={
                                isLocalDataImage
                                  ? 'アップロード画像を使用中（URLで上書き可）'
                                  : 'https://example.com/photo.jpg'
                              }
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Navigation Content */}
              {element.type === 'navigation' && (
                <div className="space-y-3">
                  <div className="flex gap-1 p-1 bg-slate-100 rounded-lg text-xs">
                    <button
                      type="button"
                      className={`flex-1 py-1.5 px-2 rounded-md font-medium transition-colors whitespace-nowrap shrink-0 ${
                        element.navType === 'horizontal'
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-500'
                      }`}
                      onClick={() => onUpdate(selectedIds, { navType: 'horizontal' })}
                    >
                      上部メニューバー
                    </button>
                    <button
                      type="button"
                      className={`flex-1 py-1.5 px-2 rounded-md font-medium transition-colors whitespace-nowrap shrink-0 ${
                        element.navType === 'hamburger'
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-500'
                      }`}
                      onClick={() => onUpdate(selectedIds, { navType: 'hamburger' })}
                    >
                      開閉メニューボタン
                    </button>
                  </div>

                  {element.navType === 'horizontal' && (
                    <div>
                      <FieldLabel label="メニュー項目どうしの間隔" spec="gap" />
                      <div className="flex items-center gap-1.5">
                        {[16, 24, 32, 48].map((g) => (
                          <button
                            key={g}
                            type="button"
                            onClick={() => updateStyle({ gap: g })}
                            className={`px-2.5 py-1 rounded-md text-xs tabular-nums border transition-colors whitespace-nowrap shrink-0 ${
                              (element.style.gap ?? 24) === g
                                ? 'bg-indigo-50 border-indigo-300 text-indigo-700 font-semibold'
                                : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                            }`}
                          >
                            {g}
                          </button>
                        ))}
                        <input
                          type="number"
                          min={0}
                          value={element.style.gap ?? 24}
                          onChange={(e) =>
                            updateStyle({ gap: Math.max(0, Number(e.target.value)) })
                          }
                          className="flex-1 min-w-0 px-2 py-1 border border-slate-200 rounded-md text-xs font-mono tabular-nums"
                        />
                      </div>
                    </div>
                  )}

                  {element.navType === 'horizontal' ? (
                    <div className="space-y-2.5">
                      {renderMenuItemsList('left')}
                      {renderMenuItemsList('right')}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {element.menuItems?.map((item) => (
                        <div
                          key={item.id}
                          className="flex flex-col gap-1.5 p-2 border border-slate-200 rounded-lg bg-slate-50"
                        >
                          <div className="flex gap-1.5">
                            <input
                              className="flex-1 px-2 py-1 border border-slate-200 rounded bg-white text-xs"
                              placeholder="表示する文字"
                              value={item.label}
                              onChange={(e) => updateMenuItem(item.id, 'label', e.target.value)}
                            />
                            <button
                              type="button"
                              onClick={() => removeMenuItem(item.id)}
                              className="text-slate-400 hover:text-red-500 p-0.5"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                          <input
                            className="w-full px-2 py-1 border border-slate-200 rounded bg-white text-xs text-slate-600"
                            placeholder="移動先URL（https://... または #ID）"
                            value={item.link}
                            onChange={(e) => updateMenuItem(item.id, 'link', e.target.value)}
                          />
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => addMenuItem()}
                        className="w-full py-1.5 text-xs border border-dashed border-slate-300 rounded-lg text-slate-600 hover:bg-slate-50 flex items-center justify-center gap-1"
                      >
                        <Plus size={12} /> 項目を追加
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Divider quick link */}
              {element.type === 'divider' && (
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-2">
                  <span className="text-xs text-slate-600">セクションを分ける区切り線です</span>
                  <button
                    type="button"
                    onClick={() => setElementTab('design')}
                    className="text-xs font-medium text-indigo-600 hover:text-indigo-800 flex items-center gap-0.5 whitespace-nowrap shrink-0"
                  >
                    <span>色・太さを変更</span>
                    <ChevronRight size={13} />
                  </button>
                </div>
              )}
            </section>

            {/* ==============================================================
                2. 余白・間隔 (Directly below Content! Clean 1-row presets + px)
               ============================================================== */}
            <section className="pt-4 border-t border-slate-200 space-y-3.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-900">余白・間隔</span>
                <button
                  type="button"
                  onClick={() => setShowBoxDiagram((v) => !v)}
                  className="text-[11px] text-slate-500 hover:text-indigo-600 transition-colors"
                >
                  {showBoxDiagram ? '余白の図を閉じる' : '余白の図を見る'}
                </button>
              </div>

              {showBoxDiagram && (
                <div className="p-2.5 rounded-xl border border-dashed border-orange-300 bg-orange-50/40 font-mono text-[10px] tabular-nums select-none">
                  <div className="flex justify-between items-center text-orange-700 mb-1 px-1">
                    <span className="font-sans font-medium">外側 (margin)</span>
                    <span>{marginSides.top}</span>
                    <span className="opacity-0">margin</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-6 text-center text-orange-700">{marginSides.left}</span>
                    <div className="flex-1 p-2 rounded border border-indigo-400 bg-emerald-50/60">
                      <div className="flex justify-between items-center text-emerald-700 mb-1 px-1">
                        <span className="font-sans font-medium">内側 (padding)</span>
                        <span>{paddingSides.top}</span>
                        <span className="text-slate-400">
                          {borderW > 0 ? `線:${borderW}` : ''}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="w-5 text-center text-emerald-700">
                          {paddingSides.left}
                        </span>
                        <div className="flex-1 py-1 px-2 rounded bg-white border border-dashed border-emerald-400 text-center text-slate-700 font-medium">
                          {element.width}×{element.height}
                        </div>
                        <span className="w-5 text-center text-emerald-700">
                          {paddingSides.right}
                        </span>
                      </div>
                      <div className="text-center text-emerald-700 mt-1">
                        {paddingSides.bottom}
                      </div>
                    </div>
                    <span className="w-6 text-center text-orange-700">{marginSides.right}</span>
                  </div>
                  <div className="text-center text-orange-700 mt-1">{marginSides.bottom}</div>
                </div>
              )}

              {/* Padding (Inner Spacing) */}
              <div>
                <FieldLabel
                  label="内側のゆとり"
                  spec="padding"
                  helpText="枠線の内側にできる余白です。ボタンや背景つきの枠で、文字が端にくっつかないようにします。"
                  rightSlot={
                    <button
                      type="button"
                      onClick={() => setPadSplit(!padSplit)}
                      className="text-[10px] text-indigo-600 hover:text-indigo-800 flex items-center gap-0.5 whitespace-nowrap shrink-0"
                    >
                      {padSplit ? <Minimize2 size={11} /> : <Maximize2 size={11} />}
                      <span>{padSplit ? '一括' : '上下左右別'}</span>
                    </button>
                  }
                />
                {!padSplit ? (
                  <div className="flex items-center gap-1">
                    {[0, 8, 16, 24, 32].map((v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setUniformPadding(v)}
                        className={`flex-1 py-1.5 rounded-md text-xs tabular-nums border transition-colors whitespace-nowrap shrink-0 ${
                          paddingSides.top === v
                            ? 'bg-emerald-50 border-emerald-400 text-emerald-800 font-semibold'
                            : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        {v}
                      </button>
                    ))}
                    <div className="flex items-center border border-slate-200 rounded-md px-1.5 py-1 bg-white w-[70px] shrink-0">
                      <input
                        type="number"
                        min={0}
                        value={paddingSides.top}
                        onChange={(e) => setUniformPadding(Number(e.target.value))}
                        className="w-full text-xs font-mono tabular-nums text-right outline-none"
                      />
                      <span className="text-[10px] font-mono text-slate-400 ml-0.5">px</span>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-4 gap-1.5">
                    {(
                      [
                        ['top', '上'],
                        ['right', '右'],
                        ['bottom', '下'],
                        ['left', '左'],
                      ] as const
                    ).map(([side, label]) => (
                      <div key={side}>
                        <span className="text-[10px] text-slate-400 block text-center mb-0.5">
                          {label}
                        </span>
                        <input
                          type="number"
                          min={0}
                          value={paddingSides[side]}
                          onChange={(e) => setSidePadding(side, Number(e.target.value))}
                          className="w-full px-1.5 py-1 border border-slate-200 rounded-md text-xs font-mono tabular-nums text-center"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Margin (Outer Barrier Spacing) */}
              <div className="space-y-1.5">
                <FieldLabel
                  label="外側の間隔バリア"
                  spec="margin"
                  helpText="パーツの外側に確保する間隔です。1px以上設定するとオレンジ色の二重線が表示され、他のパーツが重ならないよう保護されます。"
                  rightSlot={
                    <button
                      type="button"
                      onClick={() => setMarginSplit(!marginSplit)}
                      className="text-[10px] text-indigo-600 hover:text-indigo-800 flex items-center gap-0.5 whitespace-nowrap shrink-0"
                    >
                      {marginSplit ? <Minimize2 size={11} /> : <Maximize2 size={11} />}
                      <span>{marginSplit ? '一括' : '上下左右別'}</span>
                    </button>
                  }
                />
                {!marginSplit ? (
                  <div className="flex items-center gap-1">
                    {[0, 8, 16, 24, 40].map((v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setUniformMargin(v)}
                        className={`flex-1 py-1.5 rounded-md text-xs tabular-nums border transition-colors whitespace-nowrap shrink-0 ${
                          marginSides.top === v
                            ? 'bg-orange-50 border-orange-400 text-orange-800 font-semibold'
                            : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        {v}
                      </button>
                    ))}
                    <div className="flex items-center border border-slate-200 rounded-md px-1.5 py-1 bg-white w-[70px] shrink-0">
                      <input
                        type="number"
                        min={0}
                        value={marginSides.top}
                        onChange={(e) => setUniformMargin(Number(e.target.value))}
                        className="w-full text-xs font-mono tabular-nums text-right outline-none"
                      />
                      <span className="text-[10px] font-mono text-slate-400 ml-0.5">px</span>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-4 gap-1.5">
                    {(
                      [
                        ['top', '上'],
                        ['right', '右'],
                        ['bottom', '下'],
                        ['left', '左'],
                      ] as const
                    ).map(([side, label]) => (
                      <div key={side}>
                        <span className="text-[10px] text-slate-400 block text-center mb-0.5">
                          {label}
                        </span>
                        <input
                          type="number"
                          min={0}
                          value={marginSides[side]}
                          onChange={(e) => setSideMargin(side, Number(e.target.value))}
                          className="w-full px-1.5 py-1 border border-slate-200 rounded-md text-xs font-mono tabular-nums text-center"
                        />
                      </div>
                    ))}
                  </div>
                )}

                {marginActive && (
                  <p className="text-[11px] text-orange-700 bg-orange-50/80 border border-orange-200/80 rounded-lg px-2.5 py-1.5">
                    二重線バリア有効中（他パーツとの重なりを自動防止）
                  </p>
                )}
              </div>
            </section>

            {/* ==============================================================
                3. 配置とサイズ (Quick Placement + Layer Order + Clean 2x2 W/H/X/Y)
               ============================================================== */}
            <section className="pt-4 border-t border-slate-200 space-y-3">
              <span className="text-xs font-semibold text-slate-900 block">配置とサイズ</span>

              {elements.length === 1 && (
                <div className="grid grid-cols-3 gap-1.5">
                  <button
                    type="button"
                    onClick={() => placeSingleHorizontally('left')}
                    className="py-1.5 px-2 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs text-slate-700 flex items-center justify-center gap-1 whitespace-nowrap shrink-0 transition-colors"
                  >
                    <AlignLeft size={13} />
                    <span>左寄せ</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => placeSingleHorizontally('center')}
                    className="py-1.5 px-2 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs text-slate-700 flex items-center justify-center gap-1 whitespace-nowrap shrink-0 transition-colors"
                  >
                    <AlignCenter size={13} />
                    <span>中央へ</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => placeSingleHorizontally('right')}
                    className="py-1.5 px-2 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs text-slate-700 flex items-center justify-center gap-1 whitespace-nowrap shrink-0 transition-colors"
                  >
                    <AlignRight size={13} />
                    <span>右寄せ</span>
                  </button>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-[11px] text-slate-500 block mb-1">横幅 (width)</span>
                  <div className="flex items-center border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white">
                    <input
                      type="number"
                      min={minDimension}
                      value={element.width}
                      onChange={(e) =>
                        onUpdate(selectedIds, {
                          width: Math.max(minDimension, Number(e.target.value)),
                        })
                      }
                      className="w-full text-xs font-mono tabular-nums outline-none"
                    />
                    <span className="text-[10px] font-mono text-slate-400">px</span>
                  </div>
                </div>
                <div>
                  <span className="text-[11px] text-slate-500 block mb-1">
                    高さ {autoHeightActive ? '(自動)' : '(height)'}
                  </span>
                  <div className="flex items-center border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white">
                    <input
                      type="number"
                      min={minDimension}
                      value={element.height}
                      onChange={(e) =>
                        onUpdate(selectedIds, {
                          height: Math.max(minDimension, Number(e.target.value)),
                          ...(autoHeightActive ? { autoHeight: false } : {}),
                        })
                      }
                      className="w-full text-xs font-mono tabular-nums outline-none"
                    />
                    <span className="text-[10px] font-mono text-slate-400">px</span>
                  </div>
                </div>
                <div>
                  <span className="text-[11px] text-slate-500 block mb-1">横位置 (X)</span>
                  <div className="flex items-center border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white">
                    <input
                      type="number"
                      value={element.x}
                      onChange={(e) => onUpdate(selectedIds, { x: Number(e.target.value) })}
                      className="w-full text-xs font-mono tabular-nums outline-none"
                    />
                    <span className="text-[10px] font-mono text-slate-400">px</span>
                  </div>
                </div>
                <div>
                  <span className="text-[11px] text-slate-500 block mb-1">縦位置 (Y)</span>
                  <div className="flex items-center border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white">
                    <input
                      type="number"
                      value={element.y}
                      onChange={(e) => onUpdate(selectedIds, { y: Number(e.target.value) })}
                      className="w-full text-xs font-mono tabular-nums outline-none"
                    />
                    <span className="text-[10px] font-mono text-slate-400">px</span>
                  </div>
                </div>
              </div>

              <div>
                <FieldLabel label="前後の重なり順" spec="z-index" />
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => updateStyle({ zIndex: (element.style.zIndex ?? 1) - 1 })}
                    className="flex-1 py-1.5 px-2.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs text-slate-700 whitespace-nowrap shrink-0 transition-colors"
                  >
                    背面へ送る (-1)
                  </button>
                  <span className="w-10 text-center text-xs font-mono tabular-nums text-slate-500">
                    {element.style.zIndex ?? 1}
                  </span>
                  <button
                    type="button"
                    onClick={() => updateStyle({ zIndex: (element.style.zIndex ?? 1) + 1 })}
                    className="flex-1 py-1.5 px-2.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs text-slate-700 whitespace-nowrap shrink-0 transition-colors"
                  >
                    手前へ出す (+1)
                  </button>
                </div>
              </div>
            </section>
          </>
        )}

        {/* ================================================================
            TAB 2: デザイン (Typography + Colors + Radius + Border/Shadow)
           ================================================================ */}
        {elementTab === 'design' && (
          <>
            {/* Typography Block */}
            {hasTypography && (
              <section className="space-y-3.5 pb-4 border-b border-slate-200">
                <span className="text-xs font-semibold text-slate-900 block">文字のスタイル</span>

                <div>
                  <FieldLabel label="フォント（書体）" spec="font-family" />
                  <select
                    value={element.style.fontFamily || 'sans-serif'}
                    onChange={(e) => updateStyle({ fontFamily: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white"
                  >
                    {GOOGLE_FONTS.map((font) => (
                      <option key={font.value} value={font.value}>
                        {font.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <FieldLabel label="文字サイズ" spec="font-size" />
                  <div className="flex items-center gap-1">
                    {[13, 16, 22, 32, 48].map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => updateStyle({ fontSize: s })}
                        className={`flex-1 py-1.5 rounded-md text-xs tabular-nums border transition-colors whitespace-nowrap shrink-0 ${
                          (element.style.fontSize || 16) === s
                            ? 'bg-indigo-50 border-indigo-300 text-indigo-700 font-semibold'
                            : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                    <div className="flex items-center border border-slate-200 rounded-md px-1.5 py-1 bg-white w-[70px] shrink-0">
                      <input
                        type="number"
                        min={8}
                        value={element.style.fontSize || 16}
                        onChange={(e) =>
                          updateStyle({ fontSize: Math.max(8, Number(e.target.value)) })
                        }
                        className="w-full text-xs font-mono tabular-nums text-right outline-none"
                      />
                      <span className="text-[10px] font-mono text-slate-400 ml-0.5">px</span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <FieldLabel label="太さ" />
                    <select
                      value={element.style.fontWeight || '400'}
                      onChange={(e) => updateStyle({ fontWeight: e.target.value })}
                      className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs bg-white h-[34px]"
                    >
                      <option value="400">標準</option>
                      <option value="500">やや太め</option>
                      <option value="600">中太</option>
                      <option value="700">太字</option>
                    </select>
                  </div>

                  <div>
                    <FieldLabel label="文字の色" />
                    <div className="flex items-center gap-1.5 border border-slate-200 rounded-lg px-2.5 py-1 h-[34px]">
                      <input
                        type="color"
                        value={
                          element.style.color && element.style.color.startsWith('#')
                            ? element.style.color
                            : '#0f172a'
                        }
                        onChange={(e) => updateStyle({ color: e.target.value })}
                        className="w-5 h-5 rounded cursor-pointer border-none bg-transparent shrink-0"
                      />
                      <input
                        type="text"
                        value={element.style.color || '#0f172a'}
                        onChange={(e) => updateStyle({ color: e.target.value })}
                        className="w-full text-xs font-mono text-slate-700 outline-none"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <FieldLabel label="文字の揃え方" />
                  <div className="flex border border-slate-200 rounded-lg overflow-hidden h-[34px]">
                    {(
                      [
                        ['left', '左揃え', <AlignLeft key="l" size={14} />],
                        ['center', '中央揃え', <AlignCenter key="c" size={14} />],
                        ['right', '右揃え', <AlignRight key="r" size={14} />],
                        ['justify', '両端揃え', <AlignJustify key="j" size={14} />],
                      ] as const
                    ).map(([alignVal, tip, icon]) => (
                      <button
                        type="button"
                        key={alignVal}
                        onClick={() => updateStyle({ textAlign: alignVal })}
                        className={`flex-1 flex items-center justify-center transition-colors ${
                          (element.style.textAlign || 'left') === alignVal
                            ? 'bg-indigo-50 text-indigo-700'
                            : 'bg-white text-slate-600 hover:bg-slate-50'
                        }`}
                        title={tip}
                      >
                        {icon}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Collapsible Typography Details (Line Height, Letter Spacing, Vertical Text) */}
                <div>
                  <button
                    type="button"
                    onClick={() => setShowTextDetail((v) => !v)}
                    className="w-full flex items-center justify-between py-1 text-xs text-slate-500 hover:text-slate-800"
                  >
                    <span>行間・文字間隔・縦書きなどの調整</span>
                    {showTextDetail ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>

                  {showTextDetail && (
                    <div className="pt-2.5 space-y-3">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <FieldLabel label="行間" spec="line-height" />
                          <input
                            type="number"
                            step="0.05"
                            min={0.8}
                            max={4}
                            value={element.style.lineHeight ?? 1.5}
                            onChange={(e) => updateStyle({ lineHeight: Number(e.target.value) })}
                            className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs font-mono tabular-nums"
                          />
                        </div>
                        <div>
                          <FieldLabel label="文字間隔 (px)" spec="letter-spacing" />
                          <input
                            type="number"
                            step="0.2"
                            value={element.style.letterSpacing ?? 0}
                            onChange={(e) =>
                              updateStyle({ letterSpacing: Number(e.target.value) })
                            }
                            className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs font-mono tabular-nums"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <span className="text-[11px] text-slate-500 block mb-1">文字の向き</span>
                          <select
                            value={element.style.writingMode || 'horizontal-tb'}
                            onChange={(e) =>
                              updateStyle({
                                writingMode: e.target.value as 'horizontal-tb' | 'vertical-rl',
                              })
                            }
                            className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-xs bg-white"
                          >
                            <option value="horizontal-tb">横書き</option>
                            <option value="vertical-rl">縦書き</option>
                          </select>
                        </div>
                        <div>
                          <span className="text-[11px] text-slate-500 block mb-1">斜体</span>
                          <select
                            value={element.style.fontStyle || 'normal'}
                            onChange={(e) =>
                              updateStyle({ fontStyle: e.target.value as 'normal' | 'italic' })
                            }
                            className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-xs bg-white"
                          >
                            <option value="normal">通常</option>
                            <option value="italic">斜体</option>
                          </select>
                        </div>
                        <div>
                          <span className="text-[11px] text-slate-500 block mb-1">英字変換</span>
                          <select
                            value={element.style.textTransform || 'none'}
                            onChange={(e) =>
                              updateStyle({
                                textTransform: e.target.value as
                                  | 'none'
                                  | 'uppercase'
                                  | 'lowercase',
                              })
                            }
                            className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-xs bg-white"
                          >
                            <option value="none">そのまま</option>
                            <option value="uppercase">大文字</option>
                            <option value="lowercase">小文字</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* Background & Corner Radius Block */}
            <section className="space-y-4 pb-4 border-b border-slate-200">
              <span className="text-xs font-semibold text-slate-900 block">背景と角の丸み</span>

              <div className="space-y-2">
                <FieldLabel
                  label="塗りつぶし背景色"
                  rightSlot={
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        value={element.style.backgroundColor || 'transparent'}
                        onChange={(e) => updateStyle({ backgroundColor: e.target.value })}
                        className="w-24 px-1.5 py-0.5 border border-slate-200 rounded text-[11px] font-mono text-slate-700"
                      />
                      <input
                        type="color"
                        value={
                          element.style.backgroundColor &&
                          element.style.backgroundColor.startsWith('#') &&
                          element.style.backgroundColor.length === 7
                            ? element.style.backgroundColor
                            : '#ffffff'
                        }
                        onChange={(e) => updateStyle({ backgroundColor: e.target.value })}
                        className="w-5 h-5 rounded cursor-pointer border border-slate-200 shrink-0"
                      />
                    </div>
                  }
                />
                <div className="flex flex-wrap gap-1.5 items-center">
                  {PRESET_COLORS.map((c) => (
                    <button
                      type="button"
                      key={c}
                      className="w-5 h-5 rounded-sm border border-slate-200"
                      style={{ backgroundColor: c }}
                      onClick={() => updateStyle({ backgroundColor: c })}
                      title={c}
                    />
                  ))}
                  <button
                    type="button"
                    className="px-2.5 h-5 rounded-sm border border-slate-200 bg-white text-[10px] text-slate-600 hover:text-red-600 whitespace-nowrap shrink-0"
                    onClick={() => updateStyle({ backgroundColor: 'transparent' })}
                  >
                    透明にする
                  </button>
                </div>
              </div>

              {element.type !== 'divider' && (
                <div>
                  <FieldLabel label="角の丸み" spec="border-radius" />
                  <div className="flex items-center gap-1">
                    {[
                      { label: '0', v: 0 },
                      { label: '6', v: 6 },
                      { label: '12', v: 12 },
                      { label: '24', v: 24 },
                      { label: '丸', v: 999 },
                    ].map((r) => (
                      <button
                        key={r.label}
                        type="button"
                        onClick={() =>
                          updateStyle({ borderRadius: r.v, borderRadiusUnit: 'px' })
                        }
                        className={`flex-1 py-1.5 rounded-md text-xs tabular-nums border transition-colors whitespace-nowrap shrink-0 ${
                          currentRadiusUnit === 'px' && currentRadiusVal === r.v
                            ? 'bg-indigo-50 border-indigo-300 text-indigo-700 font-semibold'
                            : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        {r.label}
                      </button>
                    ))}
                    <div className="flex items-center border border-slate-200 rounded-md px-1.5 py-1 bg-white w-[70px] shrink-0">
                      <input
                        type="number"
                        min={0}
                        value={currentRadiusVal}
                        onChange={(e) =>
                          updateStyle({ borderRadius: Math.max(0, Number(e.target.value)) })
                        }
                        className="w-full text-xs font-mono tabular-nums text-right outline-none"
                      />
                      <span className="text-[10px] font-mono text-slate-400 ml-0.5">
                        {currentRadiusUnit}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </section>

            {/* Border, Shadow & Effects Block */}
            <section className="space-y-4">
              <span className="text-xs font-semibold text-slate-900 block">影・枠線・エフェクト</span>

              {/* Shadow Presets */}
              <div className="space-y-2">
                <FieldLabel
                  label="影（カードの立体感）"
                  spec="box-shadow"
                  rightSlot={
                    shadowEnabled ? (
                      <button
                        type="button"
                        onClick={() => setShowShadowDetail((v) => !v)}
                        className="text-[10px] text-indigo-600 hover:text-indigo-800 whitespace-nowrap shrink-0"
                      >
                        {showShadowDetail ? '閉じる' : '細かく調整'}
                      </button>
                    ) : undefined
                  }
                />
                <div className="grid grid-cols-4 gap-1.5">
                  {SHADOW_PRESETS.map((preset) => {
                    const isCurrent =
                      (!preset.enabled && !shadowEnabled) ||
                      (preset.enabled &&
                        shadowEnabled &&
                        shadowX === preset.x &&
                        shadowY === preset.y &&
                        shadowBlur === preset.blur);
                    return (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => selectShadowPreset(preset)}
                        className={`py-1.5 rounded-lg text-xs border transition-colors whitespace-nowrap shrink-0 ${
                          isCurrent
                            ? 'bg-indigo-50 border-indigo-300 text-indigo-700 font-semibold'
                            : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        {preset.label}
                      </button>
                    );
                  })}
                </div>

                {shadowEnabled && showShadowDetail && (
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                    <div className="grid grid-cols-3 gap-1.5">
                      <div>
                        <span className="text-[10px] text-slate-500 block">横ズレ X</span>
                        <input
                          type="number"
                          value={shadowX}
                          onChange={(e) => handleShadowChange('x', Number(e.target.value))}
                          className="w-full px-1.5 py-1 border border-slate-200 rounded bg-white text-xs font-mono tabular-nums"
                        />
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 block">縦ズレ Y</span>
                        <input
                          type="number"
                          value={shadowY}
                          onChange={(e) => handleShadowChange('y', Number(e.target.value))}
                          className="w-full px-1.5 py-1 border border-slate-200 rounded bg-white text-xs font-mono tabular-nums"
                        />
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 block">ぼかし</span>
                        <input
                          type="number"
                          min={0}
                          value={shadowBlur}
                          onChange={(e) =>
                            handleShadowChange('blur', Math.max(0, Number(e.target.value)))
                          }
                          className="w-full px-1.5 py-1 border border-slate-200 rounded bg-white text-xs font-mono tabular-nums"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Clean Progressive Border Control */}
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/90 space-y-2.5">
                <label className="flex items-center justify-between gap-2 cursor-pointer select-none">
                  <span className="text-xs font-medium text-slate-800">
                    {element.type === 'divider' ? '区切り線の太さ・色' : '枠線・アンダーラインを引く'}
                  </span>
                  {element.type !== 'divider' && (
                    <input
                      type="checkbox"
                      checked={hasBorder}
                      onChange={(e) => {
                        if (e.target.checked) {
                          updateStyle({
                            borderWidth: Math.max(1, element.style.borderWidth || 1),
                            borderStyle:
                              element.style.borderStyle && element.style.borderStyle !== 'none'
                                ? element.style.borderStyle
                                : 'solid',
                            borderColor: element.style.borderColor || '#cbd5e1',
                          });
                        } else {
                          updateStyle({ borderWidth: 0, borderStyle: 'none' });
                        }
                      }}
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    />
                  )}
                </label>

                {hasBorder && (
                  <div className="space-y-2 pt-1 border-t border-slate-200/70">
                    {element.type !== 'divider' && (
                      <div>
                        <span className="text-[11px] text-slate-500 block mb-1">線を引く場所</span>
                        <select
                          value={element.style.borderSides || 'all'}
                          onChange={(e) =>
                            updateStyle({ borderSides: e.target.value as BorderSidesMode })
                          }
                          className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs bg-white"
                        >
                          <option value="all">四方すべて（囲み枠）</option>
                          <option value="bottom">下線のみ（アンダーライン）</option>
                          <option value="top">上線のみ</option>
                          <option value="y">上下の線</option>
                          <option value="left">左線のみ（見出しアクセント等）</option>
                          <option value="right">右線のみ</option>
                        </select>
                      </div>
                    )}

                    <div className="grid grid-cols-3 gap-1.5">
                      <div>
                        <span className="text-[10px] text-slate-500 block mb-0.5">太さ (px)</span>
                        <input
                          type="number"
                          min={0}
                          value={element.style.borderWidth ?? 1}
                          onChange={(e) => {
                            const w = Math.max(0, Number(e.target.value));
                            updateStyle({
                              borderWidth: w,
                              borderStyle: w > 0 ? element.style.borderStyle || 'solid' : 'none',
                            });
                          }}
                          className="w-full px-2 py-1 border border-slate-200 rounded-md bg-white text-xs font-mono tabular-nums"
                        />
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 block mb-0.5">線の種類</span>
                        <select
                          value={element.style.borderStyle || 'solid'}
                          onChange={(e) =>
                            updateStyle({
                              borderStyle: e.target.value as
                                | 'none'
                                | 'solid'
                                | 'dashed'
                                | 'dotted'
                                | 'double',
                            })
                          }
                          className="w-full px-1.5 py-1 border border-slate-200 rounded-md bg-white text-xs"
                        >
                          <option value="solid">実線</option>
                          <option value="dashed">破線</option>
                          <option value="dotted">点線</option>
                          <option value="double">二重線</option>
                        </select>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 block mb-0.5">色</span>
                        <div className="flex items-center gap-1 border border-slate-200 rounded-md bg-white px-1.5 py-0.5 h-[26px]">
                          <input
                            type="color"
                            value={
                              element.style.borderColor &&
                              element.style.borderColor.startsWith('#')
                                ? element.style.borderColor
                                : '#cbd5e1'
                            }
                            onChange={(e) => updateStyle({ borderColor: e.target.value })}
                            className="w-4 h-4 cursor-pointer border-none bg-transparent shrink-0"
                          />
                          <input
                            type="text"
                            value={element.style.borderColor || '#cbd5e1'}
                            onChange={(e) => updateStyle({ borderColor: e.target.value })}
                            className="w-full text-[10px] font-mono text-slate-600 outline-none"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Media Photo/Video Tone Filter */}
              {element.type === 'media' && element.mediaType !== 'audio' && (
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/90 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-800">
                      {element.mediaType === 'video' ? '映像の明るさ・色味' : '写真の明るさ・色味'}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        updateStyle({
                          filterBrightness: 100,
                          filterContrast: 100,
                          filterGrayscale: 0,
                        })
                      }
                      className="text-[11px] text-slate-400 hover:text-indigo-600"
                    >
                      リセット
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-[11px] text-slate-600">
                    <div>
                      <span className="block truncate tabular-nums">
                        明るさ {element.style.filterBrightness ?? 100}%
                      </span>
                      <input
                        type="range"
                        min={40}
                        max={150}
                        value={element.style.filterBrightness ?? 100}
                        onChange={(e) =>
                          updateStyle({ filterBrightness: Number(e.target.value) })
                        }
                        className="w-full accent-indigo-600"
                      />
                    </div>
                    <div>
                      <span className="block truncate tabular-nums">
                        メリハリ {element.style.filterContrast ?? 100}%
                      </span>
                      <input
                        type="range"
                        min={50}
                        max={160}
                        value={element.style.filterContrast ?? 100}
                        onChange={(e) => updateStyle({ filterContrast: Number(e.target.value) })}
                        className="w-full accent-indigo-600"
                      />
                    </div>
                    <div>
                      <span className="block truncate tabular-nums">
                        モノクロ {element.style.filterGrayscale ?? 0}%
                      </span>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={element.style.filterGrayscale ?? 0}
                        onChange={(e) =>
                          updateStyle({ filterGrayscale: Number(e.target.value) })
                        }
                        className="w-full accent-indigo-600"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Collapsible Advanced Visual Effects */}
              <div>
                <button
                  type="button"
                  onClick={() => setShowVisualEffects((v) => !v)}
                  className="w-full flex items-center justify-between py-1 text-xs text-slate-500 hover:text-slate-800"
                >
                  <span>透け感・ホバー動き・すりガラス・グラデーション</span>
                  {showVisualEffects ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>

                {showVisualEffects && (
                  <div className="pt-3 space-y-3.5">
                    <div>
                      <FieldLabel
                        label={`全体の透け感（${Math.round((element.style.opacity ?? 1) * 100)}%）`}
                        spec="opacity"
                      />
                      <input
                        type="range"
                        min={0}
                        max={1}
                        step={0.05}
                        value={element.style.opacity ?? 1}
                        onChange={(e) => updateStyle({ opacity: Number(e.target.value) })}
                        className="w-full accent-indigo-600 cursor-pointer"
                      />
                    </div>

                    <div>
                      <FieldLabel label="マウスを乗せた時の動き" spec=":hover" />
                      <select
                        value={element.hoverEffect || 'none'}
                        onChange={(e) =>
                          onUpdate(selectedIds, {
                            hoverEffect: e.target.value as 'none' | 'opacity' | 'scale' | 'lift',
                          })
                        }
                        className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-white"
                      >
                        <option value="none">変化なし</option>
                        <option value="opacity">少し透ける</option>
                        <option value="scale">少し大きくなる</option>
                        <option value="lift">ふわっと浮き上がる</option>
                      </select>
                    </div>

                    <div>
                      <FieldLabel
                        label={`すりガラス背景ぼかし（${element.style.backdropFilterBlur ?? 0}px）`}
                        spec="backdrop-filter"
                      />
                      <input
                        type="range"
                        min={0}
                        max={32}
                        step={1}
                        value={element.style.backdropFilterBlur ?? 0}
                        onChange={(e) =>
                          updateStyle({ backdropFilterBlur: Number(e.target.value) })
                        }
                        className="w-full accent-indigo-600 cursor-pointer"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <FieldLabel label="グラデーション背景" />
                      <div className="flex flex-wrap gap-1">
                        {GRADIENT_PRESETS.map((g) => (
                          <button
                            key={g.label}
                            type="button"
                            onClick={() => updateStyle({ backgroundImage: g.value || undefined })}
                            className={`px-2 py-1 rounded-md text-[11px] border transition-colors ${
                              (element.style.backgroundImage || '') === g.value
                                ? 'bg-indigo-50 border-indigo-300 text-indigo-700 font-medium'
                                : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                            }`}
                          >
                            {g.label}
                          </button>
                        ))}
                      </div>
                      <input
                        type="text"
                        value={element.style.backgroundImage || ''}
                        onChange={(e) =>
                          updateStyle({ backgroundImage: e.target.value || undefined })
                        }
                        placeholder="linear-gradient(180deg, ...)"
                        className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-[11px] font-mono text-slate-600"
                      />
                    </div>
                  </div>
                )}
              </div>
            </section>
          </>
        )}

        {/* ================================================================
            TAB 3: 動き・リンク (Links, Click Open/Scroll, Sticky Header)
           ================================================================ */}
        {elementTab === 'motion' && elements.length === 1 && (
          <>
            {element.type === 'navigation' ? (
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <p className="text-xs text-slate-600 leading-relaxed">
                  メニューの各リンク先は「内容・余白」タブの項目リストで設定できます。
                </p>
                <button
                  type="button"
                  onClick={() => setElementTab('basic')}
                  className="text-xs font-medium text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                >
                  <span>メニュー項目を編集する</span>
                  <ChevronRight size={13} />
                </button>
              </div>
            ) : element.type !== 'divider' ? (
              <>
                {/* 1. Link Navigation (Skipped on interactive video/audio players to preserve play controls) */}
                {element.type === 'media' &&
                (element.mediaType === 'video' || element.mediaType === 'audio') ? (
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                    <p className="text-xs text-slate-600 leading-relaxed">
                      動画・音声の自動再生やループ再生などの動作は「内容・余白」タブで設定できます。
                    </p>
                    <button
                      type="button"
                      onClick={() => setElementTab('basic')}
                      className="text-xs font-medium text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                    >
                      <span>再生オプションを開く</span>
                      <ChevronRight size={13} />
                    </button>
                  </div>
                ) : (
                  <section className="space-y-3 pb-4 border-b border-slate-200">
                    <FieldLabel
                      label="クリックでページ・URLへ移動"
                      helpText="ボタンや画像をクリックしたときに、作成中の別ページや外部Webサイトへ移動させます。"
                    />

                  <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 rounded-lg text-xs">
                    <button
                      type="button"
                      onClick={() => {
                        setExplicitLinkTab('none');
                        onUpdate(selectedIds, { link: undefined });
                      }}
                      className={`py-1.5 px-2 rounded-md font-medium transition-colors whitespace-nowrap shrink-0 ${
                        activeLinkMode === 'none'
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      リンクなし
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setExplicitLinkTab('page');
                        const defaultPage =
                          pages.find((p) => p.id !== activePage.id)?.id || pages[0]?.id || '';
                        onUpdate(selectedIds, {
                          linkType: 'page',
                          link: element.linkType === 'page' && element.link ? element.link : defaultPage,
                        });
                      }}
                      className={`py-1.5 px-2 rounded-md font-medium transition-colors whitespace-nowrap shrink-0 ${
                        activeLinkMode === 'page'
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      サイト内ページ
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setExplicitLinkTab('url');
                        onUpdate(selectedIds, {
                          linkType: 'url',
                          link: element.linkType === 'url' ? element.link || '' : '',
                        });
                      }}
                      className={`py-1.5 px-2 rounded-md font-medium transition-colors whitespace-nowrap shrink-0 ${
                        activeLinkMode === 'url'
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      WebのURL
                    </button>
                  </div>

                  {activeLinkMode === 'page' && (
                    <div className="space-y-2">
                      <div>
                        <span className="text-[11px] text-slate-500 block mb-1">移動先のページ</span>
                        <select
                          value={element.link || ''}
                          onChange={(e) =>
                            onUpdate(selectedIds, { linkType: 'page', link: e.target.value })
                          }
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white"
                        >
                          {pages.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      {onSwitchPage && element.link && (
                        <button
                          type="button"
                          onClick={() => onSwitchPage(element.link!)}
                          className="w-full py-1.5 px-3 rounded-lg bg-indigo-50 hover:bg-indigo-100/80 border border-indigo-200 text-indigo-700 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
                        >
                          <span>移動先のページを開いて編集する</span>
                          <ArrowRight size={12} />
                        </button>
                      )}
                    </div>
                  )}

                  {activeLinkMode === 'url' && (
                    <div className="space-y-2">
                      <input
                        type="text"
                        placeholder="https://example.com または #要素ID"
                        value={element.link || ''}
                        onChange={(e) =>
                          onUpdate(selectedIds, { linkType: 'url', link: e.target.value })
                        }
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-mono"
                      />
                      <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-slate-600">
                        <input
                          type="checkbox"
                          checked={element.linkTarget === '_blank'}
                          onChange={(e) =>
                            onUpdate(selectedIds, {
                              linkTarget: e.target.checked ? '_blank' : '_self',
                            })
                          }
                          className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                        />
                        <span>新しいタブ（別ウィンドウ）で開く</span>
                      </label>
                    </div>
                  )}
                  </section>
                )}

                {/* 2. Click Interaction (Open/Close Drawer, Smooth Scroll, etc.) */}
                <section className="space-y-3 pb-4 border-b border-slate-200">
                  <FieldLabel
                    label="クリックした時の仕掛け（開閉・スクロール）"
                    spec="JavaScript"
                    helpText="ボタンを押したら隠れていた詳細枠が開く、指定の場所までスムーズにスクロールするなどの動作を設定できます。"
                  />

                  <select
                    value={element.interaction?.action || 'none'}
                    onChange={(e) =>
                      updateInteraction({ action: e.target.value as JsActionType })
                    }
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white"
                  >
                    <option value="none">仕掛けなし</option>
                    <option value="toggle-element">別のパーツを表示・非表示にする（開閉）</option>
                    <option value="scroll-to">指定したパーツの場所までスクロール</option>
                    <option value="alert">ポップアップメッセージを表示</option>
                    <option value="toggle-class">CSSクラスを付け外しする（上級者）</option>
                    <option value="custom">JavaScriptを直接書く（上級者）</option>
                  </select>

                  {element.interaction?.action && element.interaction.action !== 'none' && (
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
                      <div>
                        <span className="text-[11px] text-slate-500 block mb-1">
                          いつ動かす？（きっかけ）
                        </span>
                        <select
                          value={element.interaction.event || 'click'}
                          onChange={(e) =>
                            updateInteraction({ event: e.target.value as JsEventType })
                          }
                          className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs bg-white"
                        >
                          <option value="click">クリックした時</option>
                          <option value="dblclick">ダブルクリックした時</option>
                          <option value="mouseenter">マウスを乗せた時</option>
                        </select>
                      </div>

                      {(element.interaction.action === 'toggle-element' ||
                        element.interaction.action === 'scroll-to' ||
                        element.interaction.action === 'toggle-class') && (
                        <div>
                          <span className="text-[11px] text-slate-500 block mb-1">
                            どのパーツを動かす？
                          </span>
                          <select
                            value={element.interaction.targetId || ''}
                            onChange={(e) => updateInteraction({ targetId: e.target.value })}
                            className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs bg-white"
                          >
                            <option value="">
                              {element.interaction.action === 'toggle-class'
                                ? '-- このパーツ自身 --'
                                : '-- 対象のパーツを選択してください --'}
                            </option>
                            {allPageElements.map((targetEl) => {
                              const tid = sanitizeHtmlId(targetEl.htmlId, targetEl.id);
                              const tSummary = getElementHumanSummary(targetEl);
                              return (
                                <option key={targetEl.id} value={tid}>
                                  {tSummary.kindLabel}
                                  {tSummary.previewText}
                                </option>
                              );
                            })}
                          </select>
                        </div>
                      )}

                      {element.interaction.action === 'toggle-class' && (
                        <div>
                          <span className="text-[11px] text-slate-500 block mb-1">
                            切り替えるクラス名
                          </span>
                          <input
                            type="text"
                            value={element.interaction.className || 'is-active'}
                            onChange={(e) => updateInteraction({ className: e.target.value })}
                            className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs font-mono bg-white"
                          />
                        </div>
                      )}

                      {element.interaction.action === 'alert' && (
                        <div>
                          <span className="text-[11px] text-slate-500 block mb-1">
                            表示するメッセージ
                          </span>
                          <input
                            type="text"
                            value={element.interaction.message || ''}
                            onChange={(e) => updateInteraction({ message: e.target.value })}
                            placeholder="お問い合わせありがとうございます！"
                            className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs bg-white"
                          />
                        </div>
                      )}

                      {element.interaction.action === 'custom' && (
                        <div>
                          <span className="text-[11px] text-slate-500 block mb-1">
                            JavaScript コード
                          </span>
                          <textarea
                            rows={4}
                            value={element.interaction.customCode || ''}
                            onChange={(e) => updateInteraction({ customCode: e.target.value })}
                            placeholder="console.log('Clicked!');"
                            className="w-full p-2.5 border border-slate-200 rounded-lg text-[11px] font-mono bg-slate-950 text-slate-100 outline-none"
                          />
                        </div>
                      )}
                    </div>
                  )}
                </section>
              </>
            ) : null}

            {/* 3. Sticky & Initial Visibility Toggles */}
            <section className="space-y-2.5">
              <span className="text-xs font-semibold text-slate-900 block">表示・スクロール設定</span>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/90 space-y-2.5">
                <label className="flex items-center justify-between gap-2 cursor-pointer select-none">
                  <div>
                    <span className="text-xs font-medium text-slate-800 block">
                      スクロールしても画面に固定する
                    </span>
                    <span className="text-[10px] text-slate-500">
                      上部メニューバーや追従ボタンに最適 (position: fixed)
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={element.style.position === 'fixed'}
                    onChange={(e) =>
                      updateStyle({ position: e.target.checked ? 'fixed' : 'absolute' })
                    }
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer shrink-0"
                  />
                </label>

                <div className="pt-2 border-t border-slate-200/70">
                  <label className="flex items-center justify-between gap-2 cursor-pointer select-none">
                    <div>
                      <span className="text-xs font-medium text-slate-800 block">
                        最初は隠しておく（開閉パネル用）
                      </span>
                      <span className="text-[10px] text-slate-500">
                        ボタンを押した時だけ開くメニュー・詳細枠に使います
                      </span>
                    </div>
                    <input
                      type="checkbox"
                      checked={Boolean(element.hiddenByDefault)}
                      onChange={(e) =>
                        onUpdate(selectedIds, { hiddenByDefault: e.target.checked })
                      }
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer shrink-0"
                    />
                  </label>
                </div>
              </div>

              {/* Direct Workflow CTA: Jump Straight to Live Preview! */}
              {onEnterPreview &&
                (Boolean(element.link) ||
                  (element.interaction?.action && element.interaction.action !== 'none') ||
                  element.style.position === 'fixed' ||
                  (element.type === 'media' &&
                    (element.mediaType === 'video' || element.mediaType === 'audio'))) && (
                  <button
                    type="button"
                    onClick={onEnterPreview}
                    className="w-full py-2.5 px-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium flex items-center justify-center gap-2 transition-colors mt-2"
                  >
                    <Eye size={14} />
                    <span>実画面プレビューで動きを試す</span>
                    <Zap size={13} className="text-amber-300" />
                  </button>
                )}
            </section>
          </>
        )}

        {/* ================================================================
            TAB 4: 詳細・コード (Semantic HTML, ID/Class, CSS Anchor & Live Code)
           ================================================================ */}
        {elementTab === 'pro' && elements.length === 1 && (
          <>
            {/* 1. HTML Semantics & ID/Class */}
            <section className="space-y-3 pb-4 border-b border-slate-200">
              <span className="text-xs font-semibold text-slate-900 block">
                HTMLタグ・名前設定（上級者向け）
              </span>

              {availableTagOptions && (
                <div>
                  <FieldLabel label="HTMLタグ" spec="tagName" />
                  <select
                    value={element.tagName || getEffectiveTag(element)}
                    onChange={(e) =>
                      onUpdate(selectedIds, { tagName: e.target.value as HtmlTagName })
                    }
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-white"
                  >
                    {availableTagOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <FieldLabel
                    label="要素ID"
                    spec="#id"
                    helpText="ページ内リンク（#名前）の移動先や、CSS・JavaScriptの指定名として使われます。"
                  />
                  <input
                    type="text"
                    value={element.htmlId ?? effectiveId}
                    onChange={(e) => onUpdate([element.id], { htmlId: e.target.value })}
                    onBlur={(e) =>
                      onUpdate([element.id], {
                        htmlId: sanitizeHtmlId(e.target.value, element.id),
                      })
                    }
                    className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs font-mono"
                  />
                </div>
                <div>
                  <FieldLabel label="CSSクラス" spec=".class" />
                  <input
                    type="text"
                    value={element.className || ''}
                    onChange={(e) => onUpdate(selectedIds, { className: e.target.value })}
                    placeholder="card featured"
                    className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs font-mono"
                  />
                </div>
              </div>

              {element.type === 'button' && effectiveTag === 'button' && (
                <div>
                  <FieldLabel label="ボタン属性" spec="type" />
                  <select
                    value={element.buttonType || 'button'}
                    onChange={(e) =>
                      onUpdate(selectedIds, {
                        buttonType: e.target.value as 'button' | 'submit' | 'reset',
                      })
                    }
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-white"
                  >
                    <option value="button">通常ボタン — type="button"</option>
                    <option value="submit">フォーム送信 — type="submit"</option>
                    <option value="reset">入力リセット — type="reset"</option>
                  </select>
                </div>
              )}
            </section>

            {/* 2. Advanced CSS Layout Specs */}
            <section className="space-y-3 pb-4 border-b border-slate-200">
              <span className="text-xs font-semibold text-slate-900 block">CSS 詳細配置ルール</span>

              <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200">
                <div className="grid grid-cols-3 gap-1 w-14 h-14 bg-white p-1.5 rounded-lg border border-slate-200 shrink-0">
                  {(['top', 'center', 'bottom'] as const).map((y) =>
                    (['left', 'center', 'right'] as const).map((x) => {
                      const isActive = element.anchorX === x && element.anchorY === y;
                      return (
                        <button
                          type="button"
                          key={`${x}-${y}`}
                          onClick={() => changeAnchor(x, y)}
                          className={`rounded-xs border transition-colors ${
                            isActive
                              ? 'bg-indigo-600 border-indigo-600'
                              : 'bg-slate-100 border-slate-300 hover:border-slate-400'
                          }`}
                          title={`${y} / ${x}`}
                        />
                      );
                    })
                  )}
                </div>
                <div className="text-[11px] text-slate-600 leading-relaxed">
                  <span className="font-semibold text-slate-800 block mb-0.5">
                    配置の基準点（{element.anchorY} / {element.anchorX}）
                  </span>
                  CSSで left / right / 中央 のどこを基準に配置するかを切り替えます。
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <FieldLabel label="サイズ計算" spec="box-sizing" />
                  <select
                    value={element.style.boxSizing || 'border-box'}
                    onChange={(e) =>
                      updateStyle({ boxSizing: e.target.value as 'border-box' | 'content-box' })
                    }
                    className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs bg-white"
                  >
                    <option value="border-box">余白込み (border-box)</option>
                    <option value="content-box">外足し (content-box)</option>
                  </select>
                </div>
                <div>
                  <FieldLabel label="はみ出し表示" spec="overflow" />
                  <select
                    value={element.style.overflow || 'visible'}
                    onChange={(e) =>
                      updateStyle({
                        overflow: e.target.value as 'visible' | 'hidden' | 'auto',
                      })
                    }
                    className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs bg-white"
                  >
                    <option value="visible">表示 (visible)</option>
                    <option value="hidden">切り抜き (hidden)</option>
                    <option value="auto">スクロール (auto)</option>
                  </select>
                </div>
                <div>
                  <FieldLabel label="回転角度" spec="rotate (deg)" />
                  <input
                    type="number"
                    min={-180}
                    max={180}
                    value={element.style.rotate ?? 0}
                    onChange={(e) => updateStyle({ rotate: Number(e.target.value) })}
                    className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs font-mono tabular-nums"
                  />
                </div>
                <div>
                  <FieldLabel label="カーソル形状" spec="cursor" />
                  <select
                    value={element.style.cursor || 'auto'}
                    onChange={(e) =>
                      updateStyle({
                        cursor: e.target.value as
                          | 'auto'
                          | 'pointer'
                          | 'text'
                          | 'move'
                          | 'default',
                      })
                    }
                    className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs bg-white"
                  >
                    <option value="auto">自動 (auto)</option>
                    <option value="pointer">指マーク (pointer)</option>
                    <option value="default">矢印 (default)</option>
                    <option value="text">文字選択 (text)</option>
                  </select>
                </div>
              </div>
            </section>

            {/* 3. Live Element Code Output */}
            {snippet && (
              <section className="space-y-3">
                <span className="text-xs font-semibold text-slate-900 block">
                  このパーツの出力コード
                </span>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-medium text-slate-600">HTML</span>
                    <button
                      type="button"
                      onClick={() => copySnippet('html', snippet.html)}
                      className="text-[11px] text-slate-500 hover:text-slate-900 flex items-center gap-1"
                    >
                      {copiedKey === 'html' ? (
                        <Check size={12} className="text-emerald-600" />
                      ) : (
                        <Copy size={12} />
                      )}
                      <span>{copiedKey === 'html' ? 'コピー済' : 'コピー'}</span>
                    </button>
                  </div>
                  <pre className="p-2.5 rounded-lg bg-slate-950 text-slate-100 text-[11px] font-mono overflow-x-auto leading-relaxed">
                    {snippet.html}
                  </pre>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-medium text-slate-600">CSS</span>
                    <button
                      type="button"
                      onClick={() => copySnippet('css', snippet.css)}
                      className="text-[11px] text-slate-500 hover:text-slate-900 flex items-center gap-1"
                    >
                      {copiedKey === 'css' ? (
                        <Check size={12} className="text-emerald-600" />
                      ) : (
                        <Copy size={12} />
                      )}
                      <span>{copiedKey === 'css' ? 'コピー済' : 'コピー'}</span>
                    </button>
                  </div>
                  <pre className="p-2.5 rounded-lg bg-slate-950 text-slate-100 text-[11px] font-mono overflow-x-auto leading-relaxed">
                    {snippet.css}
                  </pre>
                </div>

                {snippet.js && (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-medium text-slate-600">JavaScript</span>
                      <button
                        type="button"
                        onClick={() => copySnippet('js', snippet.js)}
                        className="text-[11px] text-slate-500 hover:text-slate-900 flex items-center gap-1"
                      >
                        {copiedKey === 'js' ? (
                          <Check size={12} className="text-emerald-600" />
                        ) : (
                          <Copy size={12} />
                        )}
                        <span>{copiedKey === 'js' ? 'コピー済' : 'コピー'}</span>
                      </button>
                    </div>
                    <pre className="p-2.5 rounded-lg bg-slate-950 text-slate-100 text-[11px] font-mono overflow-x-auto leading-relaxed">
                      {snippet.js}
                    </pre>
                  </div>
                )}
              </section>
            )}
          </>
        )}
      </div>
    </aside>
  );
};

export default PropertiesPanel;