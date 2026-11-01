import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  Code2,
  Download,
  Edit2,
  Eye,
  GripHorizontal,
  Hand,
  LayoutTemplate,
  Maximize,
  Monitor,
  PenTool,
  Plus,
  Redo,
  RotateCcw,
  Smartphone,
  Tablet,
  Trash2,
  Undo,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import CanvasElement from './components/CanvasElement';
import CodeModal from './components/CodeModal';
import PropertiesPanel from './components/PropertiesPanel';
import TemplateModal from './components/TemplateModal';
import Toolbar from './components/Toolbar';
import { EditorElement, ElementType, Page, SiteTemplate, SmartGuide } from './types';
import {
  applyVerticalReflow,
  boxesOverlap,
  findMarginCollisions,
  findNonOverlappingPosition,
  getElementBoxes,
  getPageFilename,
  hasAnyMargin,
  resolveDragCollision,
  sanitizeHtmlId,
  shouldPreventOverlap,
} from './utils/boxModel';
import { downloadBundle, generateSiteFiles } from './utils/codeGenerator';
import { SITE_TEMPLATES, cloneTemplatePages } from './utils/templates';

const CANVAS_WIDTH = 1280;
const DEFAULT_CANVAS_HEIGHT = 800;
const MIN_ZOOM = 0.15;
const MAX_ZOOM = 3.2;

const DEFAULT_SVG_PLACEHOLDER =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400" viewBox="0 0 600 400">
      <rect width="600" height="400" fill="#f1f5f9"/>
      <rect x="40" y="40" width="520" height="320" rx="12" fill="#e2e8f0"/>
      <circle cx="190" cy="150" r="34" fill="#94a3b8"/>
      <path d="M90 320 L230 195 L335 285 L415 215 L510 320 Z" fill="#cbd5e1"/>
    </svg>`
  );

function isDarkHexColor(color?: string): boolean {
  if (!color || !color.startsWith('#')) return false;
  const hex = color.slice(1);
  if (hex.length !== 6) return false;
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance < 0.35;
}

const App: React.FC = () => {
  const initialPages = useRef<Page[]>(cloneTemplatePages(SITE_TEMPLATES[0])).current;

  const [pages, setPages] = useState<Page[]>(initialPages);
  const [activePageId, setActivePageId] = useState<string>(initialPages[0].id);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [collidingIds, setCollidingIds] = useState<string[]>([]);
  const activeGuides = useRef<SmartGuide[]>([]);
  const [, forceUpdate] = useState({});

  // Modes & Modals
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [previewViewport, setPreviewViewport] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const [previewReloadKey, setPreviewReloadKey] = useState(0);
  const [showCodeModal, setShowCodeModal] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [showZoomMenu, setShowZoomMenu] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [confirmDeletePageId, setConfirmDeletePageId] = useState<string | null>(null);

  // Viewport State (Edit Mode)
  const [zoom, setZoom] = useState(0.6);
  const [pan, setPan] = useState({ x: 40, y: 32 });
  const [isPanning, setIsPanning] = useState(false);
  const [isSpacePressed, setIsSpacePressed] = useState(false);

  // Page Height Drag State
  const [isResizingPageHeight, setIsResizingPageHeight] = useState(false);
  const pageResizeStartRef = useRef<{ startY: number; startHeight: number } | null>(null);

  // Page Tab Context Menu & Renaming
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; pageId: string } | null>(
    null
  );
  const [editingPageId, setEditingPageId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const editInputRef = useRef<HTMLInputElement>(null);

  const lastMousePos = useRef<{ x: number; y: number } | null>(null);
  const hasPanned = useRef(false);
  const idCounterRef = useRef(10);

  // History
  const [history, setHistory] = useState<Page[][]>([initialPages]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const isRestoringHistoryRef = useRef(false);

  const canvasWrapperRef = useRef<HTMLDivElement>(null);

  const activePage = pages.find((p) => p.id === activePageId) || pages[0];
  const elements = activePage.elements;
  const pageHeight = activePage.height || DEFAULT_CANVAS_HEIGHT;
  const pageBg = activePage.backgroundColor || '#FFFFFF';
  const isDarkCanvas = isDarkHexColor(pageBg);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
  }, []);

  useEffect(() => {
    if (!toastMessage) return;
    const timer = setTimeout(() => setToastMessage(null), 2600);
    return () => clearTimeout(timer);
  }, [toastMessage]);

  // Build exact exported HTML/CSS/JS document for Preview Mode (100% export parity)
  const previewSrcDoc = useMemo(() => {
    if (!isPreviewMode) return '';
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const generated = generateSiteFiles(pages, CANVAS_WIDTH, DEFAULT_CANVAS_HEIGHT, {
      previewMode: true,
      origin,
    });
    const activeHtml =
      generated.htmlFiles.find((f) => f.pageId === activePage.id) || generated.htmlFiles[0];
    return activeHtml ? activeHtml.content : '';
  }, [isPreviewMode, pages, activePage.id, previewReloadKey]);

  // Listen to navigation / alert bridge messages from the exact-HTML Preview iframe
  useEffect(() => {
    if (!isPreviewMode) return;
    const handleMessage = (event: MessageEvent) => {
      const data = event.data;
      if (!data || typeof data !== 'object') return;

      if (data.type === 'WEBSIDE_TOAST' && typeof data.message === 'string') {
        showToast(data.message);
      } else if (data.type === 'WEBSIDE_NAVIGATE_FILE' && typeof data.filename === 'string') {
        const matched = pages.find((p) => getPageFilename(p, pages) === data.filename);
        if (matched) {
          setActivePageId(matched.id);
          showToast(`「${matched.name}」へ移動しました`);
        }
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [isPreviewMode, pages, showToast]);

  const constrainPan = useCallback((x: number, y: number, z: number, currentHeight: number) => {
    if (!canvasWrapperRef.current) return { x, y };
    const { clientWidth, clientHeight } = canvasWrapperRef.current;
    const marginX = Math.max(180, Math.round(clientWidth * 0.55));
    const marginY = Math.max(180, Math.round(clientHeight * 0.55));
    const canvasScreenW = CANVAS_WIDTH * z;
    const canvasScreenH = currentHeight * z;
    const minX = marginX - canvasScreenW;
    const maxX = clientWidth - marginX;
    const minY = marginY - canvasScreenH;
    const maxY = clientHeight - marginY;
    return {
      x: Math.round(Math.min(Math.max(x, minX), maxX)),
      y: Math.round(Math.min(Math.max(y, minY), maxY)),
    };
  }, []);

  const fitCanvasToViewport = useCallback(
    (targetPageHeight?: number, alignTopForTallPages: boolean = true) => {
      if (!canvasWrapperRef.current) return;
      const { clientWidth, clientHeight } = canvasWrapperRef.current;
      const h = targetPageHeight ?? pageHeight;
      const pad = 64;

      const fitW = (clientWidth - pad) / CANVAS_WIDTH;
      const fitH = (clientHeight - pad) / h;

      const idealZoom =
        alignTopForTallPages && h > 1050
          ? Math.min(0.88, Math.max(0.42, Math.min(fitW, Math.max(fitH, fitW * 0.78))))
          : Math.min(0.95, Math.max(MIN_ZOOM, Math.min(fitW, fitH)));

      const clampedZoom = Number(Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, idealZoom)).toFixed(2));
      const nextX = Math.round((clientWidth - CANVAS_WIDTH * clampedZoom) / 2);
      const nextY =
        h * clampedZoom > clientHeight - pad
          ? 28
          : Math.round((clientHeight - h * clampedZoom) / 2);

      setZoom(clampedZoom);
      setPan(constrainPan(nextX, nextY, clampedZoom, h));
    },
    [pageHeight, constrainPan]
  );

  const fitEntirePageInView = useCallback(() => {
    if (!canvasWrapperRef.current) return;
    const { clientWidth, clientHeight } = canvasWrapperRef.current;
    const pad = 56;
    const fitZoom = Number(
      Math.min(
        1.2,
        Math.max(
          MIN_ZOOM,
          Math.min((clientWidth - pad) / CANVAS_WIDTH, (clientHeight - pad) / pageHeight)
        )
      ).toFixed(2)
    );
    const nextX = Math.round((clientWidth - CANVAS_WIDTH * fitZoom) / 2);
    const nextY = Math.round((clientHeight - pageHeight * fitZoom) / 2);
    setZoom(fitZoom);
    setPan(constrainPan(nextX, nextY, fitZoom, pageHeight));
  }, [pageHeight, constrainPan]);

  const setZoomAroundViewportPoint = useCallback(
    (targetZoom: number, focalX?: number, focalY?: number) => {
      if (!canvasWrapperRef.current) return;
      const { clientWidth, clientHeight } = canvasWrapperRef.current;
      const clampedZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, targetZoom));
      const fx = focalX ?? clientWidth / 2;
      const fy = focalY ?? clientHeight / 2;
      const worldX = (fx - pan.x) / zoom;
      const worldY = (fy - pan.y) / zoom;
      const nextPanX = fx - worldX * clampedZoom;
      const nextPanY = fy - worldY * clampedZoom;
      setZoom(clampedZoom);
      setPan(constrainPan(nextPanX, nextPanY, clampedZoom, pageHeight));
    },
    [pan.x, pan.y, zoom, pageHeight, constrainPan]
  );

  // Initial viewport fit on mount
  useEffect(() => {
    fitCanvasToViewport(initialPages[0].height || DEFAULT_CANVAS_HEIGHT, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const handleClick = () => {
      setContextMenu(null);
      setConfirmDeletePageId(null);
      setShowZoomMenu(false);
    };
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, []);

  useEffect(() => {
    if (editingPageId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingPageId]);

  // --- History Management ---
  const saveHistory = useCallback(
    (newPages: Page[]) => {
      setHistory((prev) => {
        const sliced = prev.slice(0, historyIndex + 1);
        sliced.push(newPages);
        return sliced;
      });
      setHistoryIndex((prev) => prev + 1);
    },
    [historyIndex]
  );

  const handleUndo = () => {
    if (historyIndex > 0) {
      const nextIdx = historyIndex - 1;
      isRestoringHistoryRef.current = true;
      setHistoryIndex(nextIdx);
      setPages(history[nextIdx]);
      requestAnimationFrame(() => {
        isRestoringHistoryRef.current = false;
      });
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const nextIdx = historyIndex + 1;
      isRestoringHistoryRef.current = true;
      setHistoryIndex(nextIdx);
      setPages(history[nextIdx]);
      requestAnimationFrame(() => {
        isRestoringHistoryRef.current = false;
      });
    }
  };

  // --- Auto-Height Sync & Vertical Push-Down / Pull-Up Reflow ---
  const handleAutoHeightSync = useCallback(
    (elementId: string, nextHeight: number, isLiveInlineEdit?: boolean) => {
      if (isRestoringHistoryRef.current) return;

      let didChange = false;
      let latestPagesSnapshot: Page[] | null = null;

      setPages((prevPages) => {
        const nextPages = prevPages.map((p) => {
          if (p.id !== activePageId) return p;
          const target = p.elements.find((el) => el.id === elementId);
          if (!target || Math.abs(target.height - nextHeight) < 1) return p;

          didChange = true;
          const currentPageH = p.height || DEFAULT_CANVAS_HEIGHT;
          const reflowed = applyVerticalReflow(
            p.elements,
            currentPageH,
            elementId,
            nextHeight,
            CANVAS_WIDTH,
            p.autoFlow !== false
          );
          return {
            ...p,
            elements: reflowed.elements,
            height: reflowed.pageHeight,
          };
        });

        if (!didChange) return prevPages;
        latestPagesSnapshot = nextPages;
        return nextPages;
      });

      // Keep current history snapshot in sync when triggered by PropertiesPanel edits or resize completion
      if (!isLiveInlineEdit) {
        setHistory((prevHistory) => {
          if (!latestPagesSnapshot || prevHistory.length === 0) return prevHistory;
          const copy = [...prevHistory];
          const idx = Math.min(historyIndex, copy.length - 1);
          copy[idx] = latestPagesSnapshot;
          return copy;
        });
      }
    },
    [activePageId, historyIndex]
  );

  const handleCancelInlineEdit = useCallback(() => {
    const snapshot = history[historyIndex];
    if (!snapshot) return;
    isRestoringHistoryRef.current = true;
    setPages(snapshot);
    requestAnimationFrame(() => {
      isRestoringHistoryRef.current = false;
    });
  }, [history, historyIndex]);

  const updateElements = (newElements: EditorElement[]) => {
    const newPages = pages.map((p) => (p.id === activePageId ? { ...p, elements: newElements } : p));
    setPages(newPages);
    saveHistory(newPages);
  };

  const handleUpdatePage = (updates: Partial<Page>) => {
    const newPages = pages.map((p) => (p.id === activePageId ? { ...p, ...updates } : p));
    setPages(newPages);
    saveHistory(newPages);
  };

  const handleReorderElement = (id: string, direction: 'up' | 'down') => {
    const idx = elements.findIndex((el) => el.id === id);
    if (idx === -1) return;
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= elements.length) return;
    const next = [...elements];
    const [item] = next.splice(idx, 1);
    next.splice(swapIdx, 0, item);
    updateElements(next);
  };

  // --- Apply Template ---
  const handleApplyTemplate = (template: SiteTemplate, mode: 'replace' | 'append') => {
    if (mode === 'replace') {
      const cloned = cloneTemplatePages(template);
      setPages(cloned);
      saveHistory(cloned);
      setActivePageId(cloned[0].id);
      setSelectedIds([]);
      setShowTemplateModal(false);
      showToast(`テンプレート「${template.name}」を適用しました`);
      requestAnimationFrame(() => {
        fitCanvasToViewport(cloned[0].height || DEFAULT_CANVAS_HEIGHT, true);
      });
    } else {
      const suffix = `${pages.length + 1}`;
      const cloned = cloneTemplatePages(template, suffix);
      const firstAdded = cloned[0];
      const nextPages = [...pages, ...cloned];
      setPages(nextPages);
      saveHistory(nextPages);
      setActivePageId(firstAdded.id);
      setSelectedIds([]);
      setShowTemplateModal(false);
      showToast(`「${template.name}」を新しいページとして追加しました`);
      requestAnimationFrame(() => {
        fitCanvasToViewport(firstAdded.height || DEFAULT_CANVAS_HEIGHT, true);
      });
    }
  };

  // --- Add Element (HTML-Grounded Defaults) ---
  const handleAddElement = (type: ElementType, subType?: string) => {
    const num = idCounterRef.current++;
    const rawId = `el-${Date.now().toString(36)}-${num}`;
    const isHeading = type === 'text' && subType === 'heading';

    const prefixMap: Record<ElementType, string> = {
      text: isHeading ? 'heading' : 'text',
      rectangle: 'box',
      circle: 'circle',
      divider: 'divider',
      button: 'button',
      media: 'image',
      navigation: 'navbar',
    };
    const htmlId = `${prefixMap[type]}-${num}`;

    let spawnY = 120;
    if (canvasWrapperRef.current) {
      const viewportCenterY = (canvasWrapperRef.current.clientHeight / 2 - pan.y) / zoom;
      spawnY = Math.max(60, Math.min(pageHeight - 140, Math.round(viewportCenterY - 40)));
    }

    const defaultInk = isDarkCanvas ? '#F4F4F0' : '#0F172A';

    const newElement: EditorElement = {
      id: rawId,
      htmlId,
      tagName: isHeading
        ? 'h2'
        : type === 'text'
          ? 'p'
          : type === 'divider'
            ? 'hr'
            : type === 'button'
              ? 'button'
              : type === 'navigation'
                ? 'nav'
                : type === 'media'
                  ? 'img'
                  : 'div',
      type,
      x: 120,
      y: spawnY,
      anchorX: 'left',
      anchorY: 'top',
      width:
        type === 'divider'
          ? 480
          : isHeading
            ? 340
            : type === 'text'
              ? 280
              : type === 'button'
                ? 172
                : 180,
      height:
        type === 'divider'
          ? 1
          : isHeading
            ? 56
            : type === 'text'
              ? 64
              : type === 'button'
                ? 46
                : 120,
      content: isHeading
        ? 'セクション見出し'
        : type === 'text'
          ? 'テキストを入力してください'
          : type === 'button'
            ? 'ボタン'
            : '',
      buttonType: type === 'button' ? 'button' : undefined,
      style: {
        backgroundColor:
          type === 'divider'
            ? isDarkCanvas
              ? '#334155'
              : '#CBD5E1'
            : type === 'rectangle' || type === 'circle'
              ? isDarkCanvas
                ? '#1E293B'
                : '#E2E8F0'
              : type === 'button'
                ? isDarkCanvas
                  ? '#F4F4F0'
                  : '#0F172A'
                : 'transparent',
        borderRadius: type === 'circle' ? 50 : type === 'button' ? 6 : 0,
        borderRadiusUnit: type === 'circle' ? '%' : 'px',
        color: type === 'button' ? (isDarkCanvas ? '#0C0E12' : '#FFFFFF') : defaultInk,
        fontSize: isHeading ? 26 : 15,
        fontWeight: isHeading ? '700' : type === 'button' ? '600' : '400',
        lineHeight: isHeading ? 1.3 : 1.6,
        textAlign: type === 'button' ? 'center' : 'left',
        boxSizing: 'border-box',
      },
    };

    if (type === 'circle') {
      newElement.width = 120;
      newElement.height = 120;
    } else if (type === 'media') {
      newElement.mediaType = 'image';
      newElement.src = DEFAULT_SVG_PLACEHOLDER;
      newElement.alt = 'サンプル画像';
      newElement.width = 320;
      newElement.height = 220;
      newElement.style.objectFit = 'cover';
      newElement.style.borderRadius = 4;
    } else if (type === 'navigation') {
      newElement.navType = (subType as 'horizontal' | 'hamburger') || 'horizontal';
      newElement.tagName = newElement.navType === 'horizontal' ? 'header' : 'nav';
      newElement.width = newElement.navType === 'hamburger' ? 52 : CANVAS_WIDTH;
      newElement.height = newElement.navType === 'hamburger' ? 52 : 68;
      newElement.x = newElement.navType === 'hamburger' ? 24 : 0;
      newElement.y = newElement.navType === 'hamburger' ? 20 : 0;
      newElement.anchorX = newElement.navType === 'hamburger' ? 'right' : 'left';
      newElement.anchorY = 'top';
      newElement.style.backgroundColor = isDarkCanvas
        ? 'rgba(12, 14, 18, 0.85)'
        : 'rgba(255, 255, 255, 0.88)';
      newElement.style.backdropFilterBlur = 12;
      newElement.style.borderWidth = 1;
      newElement.style.borderStyle = 'solid';
      newElement.style.borderColor = isDarkCanvas ? '#232732' : '#E2E8F0';
      newElement.style.borderSides = 'bottom';
      newElement.style.gap = 28;
      newElement.style.padding = newElement.navType === 'horizontal' ? 24 : 0;
      newElement.style.paddingLeft = newElement.navType === 'horizontal' ? 64 : 0;
      newElement.style.paddingRight = newElement.navType === 'horizontal' ? 64 : 0;
      newElement.style.zIndex = 30;
      newElement.menuItems = [
        { id: '1', label: 'BRAND', link: '#home', position: 'left' },
        { id: '2', label: 'ABOUT', link: '#about', position: 'right' },
      ];
    }

    const safePos = findNonOverlappingPosition(newElement, elements, CANVAS_WIDTH, pageHeight);
    newElement.x = safePos.x;
    newElement.y = safePos.y;

    updateElements([...elements, newElement]);
    setSelectedIds([rawId]);
  };

  // --- Update Elements with Margin Non-Overlap & Vertical Reflow Enforcement ---
  const handleUpdateElementsWithHistory = (ids: string[], updates: Partial<EditorElement>) => {
    const isSingleHeightOnlyEdit =
      ids.length === 1 &&
      updates.height !== undefined &&
      updates.width === undefined &&
      updates.x === undefined &&
      updates.y === undefined;

    const newPages = pages.map((p) => {
      if (p.id !== activePageId) return p;
      const pHeight = p.height || DEFAULT_CANVAS_HEIGHT;

      if (isSingleHeightOnlyEdit && updates.height !== undefined) {
        const targetId = ids[0];
        const baseElements = p.elements.map((el) => {
          if (el.id !== targetId) return el;
          return {
            ...el,
            ...updates,
            height: el.height,
            style: updates.style ? { ...el.style, ...updates.style } : el.style,
          };
        });
        const reflowed = applyVerticalReflow(
          baseElements,
          pHeight,
          targetId,
          updates.height,
          CANVAS_WIDTH,
          p.autoFlow !== false
        );
        return {
          ...p,
          elements: reflowed.elements,
          height: reflowed.pageHeight,
        };
      }

      let nextElements = p.elements.map((el) => {
        if (!ids.includes(el.id)) return el;
        return {
          ...el,
          ...updates,
          style: updates.style ? { ...el.style, ...updates.style } : el.style,
        };
      });

      const geometryChanged =
        updates.x !== undefined ||
        updates.y !== undefined ||
        updates.width !== undefined ||
        updates.height !== undefined ||
        (updates.style &&
          (updates.style.margin !== undefined ||
            updates.style.marginTop !== undefined ||
            updates.style.marginRight !== undefined ||
            updates.style.marginBottom !== undefined ||
            updates.style.marginLeft !== undefined ||
            updates.style.padding !== undefined ||
            updates.style.paddingTop !== undefined ||
            updates.style.paddingRight !== undefined ||
            updates.style.paddingBottom !== undefined ||
            updates.style.paddingLeft !== undefined ||
            updates.style.boxSizing !== undefined));

      if (geometryChanged) {
        nextElements = nextElements.map((el) => {
          if (!ids.includes(el.id)) return el;
          const collisions = findMarginCollisions(el, nextElements, CANVAS_WIDTH, pHeight);
          if (collisions.length === 0) return el;

          const resolved = resolveDragCollision(
            el,
            el.x,
            el.y,
            nextElements,
            [el.id],
            CANVAS_WIDTH,
            pHeight
          );
          return { ...el, x: resolved.x, y: resolved.y };
        });
      }

      return { ...p, elements: nextElements };
    });

    setPages(newPages);
    saveHistory(newPages);
  };

  // --- Constrain Resize against Margin Boxes ---
  const handleConstrainResize = useCallback(
    (
      el: EditorElement,
      patch: { x: number; y: number; width: number; height: number },
      handle: string
    ) => {
      const candidate: EditorElement = { ...el, ...patch };
      const obstacles = elements.filter((o) => o.id !== el.id && shouldPreventOverlap(candidate, o));
      if (obstacles.length === 0) {
        if (collidingIds.length > 0) setCollidingIds([]);
        return patch;
      }

      const prevBoxes = getElementBoxes(el, CANVAS_WIDTH, pageHeight);
      let candBoxes = getElementBoxes(candidate, CANVAS_WIDTH, pageHeight);

      let widthDelta = 0;
      let heightDelta = 0;
      const hitIds: string[] = [];
      const EPS = 0.5;

      for (const obs of obstacles) {
        const obsMargin = getElementBoxes(obs, CANVAS_WIDTH, pageHeight).marginBox;
        if (!boxesOverlap(candBoxes.marginBox, obsMargin, EPS)) continue;

        hitIds.push(obs.id, el.id);

        if (handle.includes('e') && prevBoxes.marginBox.right <= obsMargin.left + EPS) {
          const overflow = candBoxes.marginBox.right - obsMargin.left;
          if (overflow > 0) widthDelta = Math.max(widthDelta, overflow);
        }
        if (handle.includes('w') && prevBoxes.marginBox.left >= obsMargin.right - EPS) {
          const overflow = obsMargin.right - candBoxes.marginBox.left;
          if (overflow > 0) widthDelta = Math.max(widthDelta, overflow);
        }
        if (handle.includes('s') && prevBoxes.marginBox.bottom <= obsMargin.top + EPS) {
          const overflow = candBoxes.marginBox.bottom - obsMargin.top;
          if (overflow > 0) heightDelta = Math.max(heightDelta, overflow);
        }
        if (handle.includes('n') && prevBoxes.marginBox.top >= obsMargin.bottom - EPS) {
          const overflow = obsMargin.bottom - candBoxes.marginBox.top;
          if (overflow > 0) heightDelta = Math.max(heightDelta, overflow);
        }
      }

      setCollidingIds(hitIds);

      if (widthDelta === 0 && heightDelta === 0) {
        if (hitIds.length > 0) {
          return { x: el.x, y: el.y, width: el.width, height: el.height };
        }
        return patch;
      }

      const minDim = el.type === 'divider' || !(el.content || '').trim() ? 1 : 20;
      const clampedWidth = Math.max(minDim, Math.round(patch.width - widthDelta));
      const clampedHeight = Math.max(minDim, Math.round(patch.height - heightDelta));

      let clampedX = patch.x;
      let clampedY = patch.y;

      const actualWChange = clampedWidth - el.width;
      const actualHChange = clampedHeight - el.height;

      if (handle.includes('w')) {
        if (el.anchorX === 'left') clampedX = Math.round(el.x - actualWChange);
        else if (el.anchorX === 'center') clampedX = Math.round(el.x - actualWChange / 2);
      } else if (handle.includes('e')) {
        if (el.anchorX === 'right') clampedX = Math.round(el.x - actualWChange);
        else if (el.anchorX === 'center') clampedX = Math.round(el.x + actualWChange / 2);
      }

      if (handle.includes('n')) {
        if (el.anchorY === 'top') clampedY = Math.round(el.y - actualHChange);
        else if (el.anchorY === 'center') clampedY = Math.round(el.y - actualHChange / 2);
      } else if (handle.includes('s')) {
        if (el.anchorY === 'bottom') clampedY = Math.round(el.y - actualHChange);
        else if (el.anchorY === 'center') clampedY = Math.round(el.y + actualHChange / 2);
      }

      candBoxes = getElementBoxes(el, CANVAS_WIDTH, pageHeight, {
        x: clampedX,
        y: clampedY,
        width: clampedWidth,
        height: clampedHeight,
      });

      const stillOverlaps = obstacles.some((o) =>
        boxesOverlap(candBoxes.marginBox, getElementBoxes(o, CANVAS_WIDTH, pageHeight).marginBox, EPS)
      );

      if (stillOverlaps) {
        return { x: el.x, y: el.y, width: el.width, height: el.height };
      }

      return {
        x: clampedX,
        y: clampedY,
        width: clampedWidth,
        height: clampedHeight,
      };
    },
    [elements, collidingIds.length, pageHeight]
  );

  // --- Dragging with Smart Guides & Margin Non-Overlap ---
  const handleDragMove = useCallback(
    (id: string, x: number, y: number) => {
      const el = elements.find((e) => e.id === id);
      if (!el || el.locked) return { x, y };

      const SNAP_THRESHOLD = 5;
      const guides: SmartGuide[] = [];
      let snappedX = x;
      let snappedY = y;

      const currentGeo = getElementBoxes(el, CANVAS_WIDTH, pageHeight, { x, y });
      const elHasMargin = hasAnyMargin(el.style);

      const xTargets: { pos: number; variant: 'align' | 'margin' }[] = [
        { pos: 0, variant: 'align' },
        { pos: CANVAS_WIDTH / 2, variant: 'align' },
        { pos: CANVAS_WIDTH, variant: 'align' },
      ];
      const yTargets: { pos: number; variant: 'align' | 'margin' }[] = [
        { pos: 0, variant: 'align' },
        { pos: pageHeight / 2, variant: 'align' },
        { pos: pageHeight, variant: 'align' },
      ];

      elements.forEach((other) => {
        if (selectedIds.includes(other.id)) return;
        const otherGeo = getElementBoxes(other, CANVAS_WIDTH, pageHeight);
        xTargets.push(
          { pos: otherGeo.borderBox.left, variant: 'align' },
          { pos: otherGeo.borderBox.centerX, variant: 'align' },
          { pos: otherGeo.borderBox.right, variant: 'align' }
        );
        yTargets.push(
          { pos: otherGeo.borderBox.top, variant: 'align' },
          { pos: otherGeo.borderBox.centerY, variant: 'align' },
          { pos: otherGeo.borderBox.bottom, variant: 'align' }
        );

        if (hasAnyMargin(other.style)) {
          xTargets.push(
            { pos: otherGeo.marginBox.left, variant: 'margin' },
            { pos: otherGeo.marginBox.right, variant: 'margin' }
          );
          yTargets.push(
            { pos: otherGeo.marginBox.top, variant: 'margin' },
            { pos: otherGeo.marginBox.bottom, variant: 'margin' }
          );
        }
      });

      const xCandidateEdges = [
        currentGeo.borderBox.left,
        currentGeo.borderBox.centerX,
        currentGeo.borderBox.right,
        ...(elHasMargin ? [currentGeo.marginBox.left, currentGeo.marginBox.right] : []),
      ];

      let xSnapped = false;
      for (const target of xTargets) {
        for (const val of xCandidateEdges) {
          if (Math.abs(val - target.pos) < SNAP_THRESHOLD) {
            const offset = target.pos - val;
            snappedX += el.anchorX === 'right' ? -offset : offset;
            guides.push({ type: 'x', pos: target.pos, variant: target.variant });
            xSnapped = true;
            break;
          }
        }
        if (xSnapped) break;
      }

      const yCandidateEdges = [
        currentGeo.borderBox.top,
        currentGeo.borderBox.centerY,
        currentGeo.borderBox.bottom,
        ...(elHasMargin ? [currentGeo.marginBox.top, currentGeo.marginBox.bottom] : []),
      ];

      let ySnapped = false;
      for (const target of yTargets) {
        for (const val of yCandidateEdges) {
          if (Math.abs(val - target.pos) < SNAP_THRESHOLD) {
            const offset = target.pos - val;
            snappedY += el.anchorY === 'bottom' ? -offset : offset;
            guides.push({ type: 'y', pos: target.pos, variant: target.variant });
            ySnapped = true;
            break;
          }
        }
        if (ySnapped) break;
      }

      const resolved = resolveDragCollision(
        el,
        snappedX,
        snappedY,
        elements,
        selectedIds.length > 0 ? selectedIds : [el.id],
        CANVAS_WIDTH,
        pageHeight
      );

      setCollidingIds(resolved.collidingIds);
      activeGuides.current = guides;

      const finalDx = resolved.x - el.x;
      const finalDy = resolved.y - el.y;

      setPages((currentPages) =>
        currentPages.map((page) => {
          if (page.id !== activePageId) return page;
          return {
            ...page,
            elements: page.elements.map((e) => {
              if ((selectedIds.includes(e.id) || e.id === el.id) && !e.locked) {
                return { ...e, x: e.x + finalDx, y: e.y + finalDy };
              }
              return e;
            }),
          };
        })
      );
      forceUpdate({});
      return { x: resolved.x, y: resolved.y };
    },
    [elements, activePageId, selectedIds, pageHeight]
  );

  const handleDragEnd = useCallback(() => {
    activeGuides.current = [];
    setCollidingIds([]);
    saveHistory(pages);
  }, [pages, saveHistory]);

  const handleResizeEnd = useCallback(() => {
    setCollidingIds([]);
  }, []);

  const handleDeleteElements = useCallback(
    (ids: string[]) => {
      setPages((currentPages) => {
        const newPages = currentPages.map((p) => {
          if (p.id !== activePageId) return p;
          return { ...p, elements: p.elements.filter((el) => !ids.includes(el.id)) };
        });
        saveHistory(newPages);
        return newPages;
      });
      setSelectedIds([]);
    },
    [activePageId, saveHistory]
  );

  // --- Keyboard Shortcuts (Delete, Space-Pan, Ctrl/Cmd + Zoom / Fit) ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable;
      if (isInput) return;

      if (e.code === 'Space' && !e.repeat && !isPreviewMode) {
        e.preventDefault();
        setIsSpacePressed(true);
      }

      if (!isPreviewMode) {
        if ((e.metaKey || e.ctrlKey) && (e.key === '=' || e.key === '+')) {
          e.preventDefault();
          setZoomAroundViewportPoint(zoom * 1.18);
        } else if ((e.metaKey || e.ctrlKey) && e.key === '-') {
          e.preventDefault();
          setZoomAroundViewportPoint(zoom / 1.18);
        } else if ((e.metaKey || e.ctrlKey) && e.key === '0') {
          e.preventDefault();
          fitEntirePageInView();
        } else if ((e.metaKey || e.ctrlKey) && e.key === '1') {
          e.preventDefault();
          setZoomAroundViewportPoint(1);
        }
      }

      if ((e.key === 'Backspace' || e.key === 'Delete') && !isPreviewMode) {
        if (selectedIds.length > 0) {
          e.preventDefault();
          handleDeleteElements(selectedIds);
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
  }, [
    selectedIds,
    handleDeleteElements,
    isPreviewMode,
    zoom,
    setZoomAroundViewportPoint,
    fitEntirePageInView,
  ]);

  const handleDuplicateElements = (ids: string[]) => {
    const selectedElements = elements.filter((el) => ids.includes(el.id));
    const currentList = [...elements];
    const duplicated: EditorElement[] = [];

    for (const el of selectedElements) {
      const num = idCounterRef.current++;
      const copyId = `el-${Date.now().toString(36)}-${num}`;
      const baseHtmlId = sanitizeHtmlId(el.htmlId, el.id);
      const candidate: EditorElement = {
        ...el,
        id: copyId,
        htmlId: `${baseHtmlId}-copy`,
        locked: false,
        x: el.x + 24,
        y: el.y + 24,
        style: { ...el.style },
        menuItems: el.menuItems ? el.menuItems.map((m) => ({ ...m })) : undefined,
        interaction: el.interaction ? { ...el.interaction } : undefined,
      };
      const safePos = findNonOverlappingPosition(candidate, currentList, CANVAS_WIDTH, pageHeight);
      candidate.x = safePos.x;
      candidate.y = safePos.y;
      currentList.push(candidate);
      duplicated.push(candidate);
    }

    updateElements(currentList);
    setSelectedIds(duplicated.map((d) => d.id));
  };

  // --- Page Management ---
  const handleAddPage = () => {
    const pageNum = pages.length + 1;
    const id = `page-${pageNum}-${Date.now().toString(36).slice(-3)}`;
    const newPage: Page = {
      id,
      slug: `page-${pageNum}`,
      name: `ページ ${pageNum}`,
      height: DEFAULT_CANVAS_HEIGHT,
      backgroundColor: '#FFFFFF',
      elements: [],
    };
    const newPages = [...pages, newPage];
    setPages(newPages);
    saveHistory(newPages);
    setActivePageId(id);
    setSelectedIds([]);
  };

  const executeDeletePage = (pageId: string) => {
    if (pages.length <= 1) {
      showToast('最後の1ページは削除できません');
      setConfirmDeletePageId(null);
      return;
    }
    const newPages = pages.filter((p) => p.id !== pageId);
    setPages(newPages);
    saveHistory(newPages);
    if (activePageId === pageId) {
      setActivePageId(newPages[0].id);
    }
    setConfirmDeletePageId(null);
    setContextMenu(null);
  };

  const handleRenamePage = (pageId: string, newName: string) => {
    const newPages = pages.map((p) => (p.id === pageId ? { ...p, name: newName } : p));
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
        handleRenamePage(editingPageId, editingName.trim());
      }
      setEditingPageId(null);
    }
  };

  const handleSelectElement = (id: string | null, isShift: boolean = false) => {
    if (!id) {
      setSelectedIds([]);
      return;
    }
    if (isShift) {
      setSelectedIds((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]));
    } else {
      setSelectedIds([id]);
    }
  };

  const handleExport = async () => {
    try {
      await downloadBundle(pages, CANVAS_WIDTH, DEFAULT_CANVAS_HEIGHT);
      showToast('サイト一式（ZIP）を書き出しました');
    } catch (err) {
      console.error('Export failed:', err);
      showToast('書き出し中にエラーが発生しました');
    }
  };

  // =========================================================================
  // Fully Automatic Mouse Wheel vs Trackpad Classifier (Gesture-Locking)
  // =========================================================================
  const viewportRef = useRef({ zoom, pan, pageHeight });
  viewportRef.current = { zoom, pan, pageHeight };

  const wheelGestureRef = useRef<{
    device: 'mouse' | 'trackpad';
    lastEventTime: number;
  }>({
    device: 'trackpad',
    lastEventTime: 0,
  });
  const safariGestureStartZoomRef = useRef(1);

  useEffect(() => {
    if (isPreviewMode) return;
    const wrapper = canvasWrapperRef.current;
    if (!wrapper) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const { zoom: curZoom, pan: curPan, pageHeight: curH } = viewportRef.current;
      const rect = wrapper.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const unitScale = e.deltaMode === 1 ? 28 : e.deltaMode === 2 ? 280 : 1;
      const normX = e.deltaX * unitScale;
      const normY = e.deltaY * unitScale;

      const isExplicitZoomModifier = e.ctrlKey || e.metaKey || e.altKey;

      let detectedDevice = wheelGestureRef.current.device;

      if (!isExplicitZoomModifier) {
        const now = performance.now();
        const dt = now - wheelGestureRef.current.lastEventTime;
        const isNewGesture = dt > 220;
        wheelGestureRef.current.lastEventTime = now;

        const wheelDeltaY = (e as WheelEvent & { wheelDeltaY?: number }).wheelDeltaY;
        const absX = Math.abs(e.deltaX);
        const absY = Math.abs(e.deltaY);

        // 1. Line/page deltaMode is strictly emitted by physical mouse wheels (e.g. Firefox)
        const isLineOrPageMouse = e.deltaMode === 1 || e.deltaMode === 2;

        // 2. Chromium/WebKit notched mouse wheel signature: exact multiple of 120, zero X delta,
        //    and not WebKit's synthetic -3 * deltaY for small trackpad steps
        const isWheelDelta120Mouse =
          typeof wheelDeltaY === 'number' &&
          wheelDeltaY !== 0 &&
          Math.abs(wheelDeltaY) % 120 === 0 &&
          absX === 0 &&
          (absY >= 40 || Math.abs(wheelDeltaY + e.deltaY * 3) > 1);

        if (isNewGesture) {
          if (
            isLineOrPageMouse ||
            isWheelDelta120Mouse ||
            (e.deltaMode === 0 && absX === 0 && absY >= 42)
          ) {
            detectedDevice = 'mouse';
          } else {
            detectedDevice = 'trackpad';
          }
        } else if (detectedDevice === 'mouse') {
          // If subsequent high-frequency frames exhibit diagonal motion or fine pixel steps,
          // upgrade immediately to trackpad and keep locked for the rest of the swipe/momentum
          if (absX > 0 || (e.deltaMode === 0 && !isWheelDelta120Mouse && dt < 24 && absY < 38)) {
            detectedDevice = 'trackpad';
          }
        }

        wheelGestureRef.current.device = detectedDevice;
      }

      const shouldZoom = isExplicitZoomModifier || (detectedDevice === 'mouse' && !e.shiftKey);

      if (shouldZoom) {
        const isTrackpadPinch =
          (e.ctrlKey || e.metaKey) && e.deltaMode === 0 && Math.abs(e.deltaY) < 36;
        const effectiveDelta = isTrackpadPinch
          ? e.deltaY * 2.5
          : Math.max(-75, Math.min(75, normY * 0.65));

        const zoomFactor = Math.exp(-effectiveDelta * 0.0042);
        const nextZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, curZoom * zoomFactor));

        const worldX = (mouseX - curPan.x) / curZoom;
        const worldY = (mouseY - curPan.y) / curZoom;
        const nextPanX = mouseX - worldX * nextZoom;
        const nextPanY = mouseY - worldY * nextZoom;
        const boundedPan = constrainPan(nextPanX, nextPanY, nextZoom, curH);

        viewportRef.current.zoom = nextZoom;
        viewportRef.current.pan = boundedPan;
        setZoom(nextZoom);
        setPan(boundedPan);
      } else {
        const panDx = e.shiftKey && normX === 0 ? -normY : -normX;
        const panDy = e.shiftKey && normX === 0 ? 0 : -normY;
        const boundedPan = constrainPan(curPan.x + panDx, curPan.y + panDy, curZoom, curH);

        viewportRef.current.pan = boundedPan;
        setPan(boundedPan);
      }
    };

    const handleGestureStart = (ev: Event) => {
      ev.preventDefault();
      safariGestureStartZoomRef.current = viewportRef.current.zoom;
    };

    const handleGestureChange = (ev: Event) => {
      ev.preventDefault();
      const gEvent = ev as Event & { scale?: number; clientX?: number; clientY?: number };
      if (typeof gEvent.scale !== 'number') return;

      const { zoom: curZoom, pan: curPan, pageHeight: curH } = viewportRef.current;
      const rect = wrapper.getBoundingClientRect();
      const mouseX = (gEvent.clientX ?? rect.left + rect.width / 2) - rect.left;
      const mouseY = (gEvent.clientY ?? rect.top + rect.height / 2) - rect.top;

      const nextZoom = Math.min(
        MAX_ZOOM,
        Math.max(MIN_ZOOM, safariGestureStartZoomRef.current * gEvent.scale)
      );
      const worldX = (mouseX - curPan.x) / curZoom;
      const worldY = (mouseY - curPan.y) / curZoom;
      const boundedPan = constrainPan(
        mouseX - worldX * nextZoom,
        mouseY - worldY * nextZoom,
        nextZoom,
        curH
      );

      viewportRef.current.zoom = nextZoom;
      viewportRef.current.pan = boundedPan;
      setZoom(nextZoom);
      setPan(boundedPan);
    };

    wrapper.addEventListener('wheel', handleWheel, { passive: false });
    wrapper.addEventListener('gesturestart', handleGestureStart, { passive: false });
    wrapper.addEventListener('gesturechange', handleGestureChange, { passive: false });
    return () => {
      wrapper.removeEventListener('wheel', handleWheel);
      wrapper.removeEventListener('gesturestart', handleGestureStart);
      wrapper.removeEventListener('gesturechange', handleGestureChange);
    };
  }, [constrainPan, isPreviewMode]);

  const handleWrapperPointerDown = (e: React.PointerEvent) => {
    const isCanvasSheet = (e.target as HTMLElement).dataset?.canvasSurface === 'true';
    if (
      e.button === 1 ||
      (e.button === 0 && (isSpacePressed || e.target === e.currentTarget || isCanvasSheet))
    ) {
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
      setPan((prev) => constrainPan(prev.x + dx, prev.y + dy, zoom, pageHeight));
      lastMousePos.current = { x: e.clientX, y: e.clientY };
    }
  };

  const handleWrapperPointerUp = (e: React.PointerEvent) => {
    if (isPanning) {
      setIsPanning(false);
      lastMousePos.current = null;
      try {
        (e.currentTarget as HTMLDivElement).releasePointerCapture(e.pointerId);
      } catch {
        // Ignore
      }
    }
  };

  // --- Bottom Canvas Page Height Resize Handle ---
  const handlePageHeightResizeDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setIsResizingPageHeight(true);
    pageResizeStartRef.current = { startY: e.clientY, startHeight: pageHeight };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePageHeightResizeMove = (e: React.PointerEvent) => {
    if (!isResizingPageHeight || !pageResizeStartRef.current) return;
    e.stopPropagation();
    const dy = (e.clientY - pageResizeStartRef.current.startY) / zoom;
    const nextHeight = Math.min(
      6000,
      Math.max(400, Math.round((pageResizeStartRef.current.startHeight + dy) / 10) * 10)
    );
    setPages((prev) =>
      prev.map((p) => (p.id === activePageId ? { ...p, height: nextHeight } : p))
    );
  };

  const handlePageHeightResizeUp = (e: React.PointerEvent) => {
    if (!isResizingPageHeight) return;
    setIsResizingPageHeight(false);
    pageResizeStartRef.current = null;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // Ignore
    }
    saveHistory(pages);
  };

  return (
    <div className="flex h-screen flex-col overflow-hidden text-slate-900 bg-slate-50">
      {/* Clean 3-Zone SaaS Top Bar */}
      <header className="h-14 bg-white border-b border-slate-200 flex items-center justify-between gap-8 px-5 shrink-0 z-20">
        {/* Zone 1: Cursive Color-Gradient Brand Wordmark */}
        <span className="brand-cursive-logo text-[28px] px-1.5 py-0.5 leading-none whitespace-nowrap shrink-0 select-none">
          Webside
        </span>

        {/* Zone 2: Guided Creation Flow (Template -> Design / Live Preview -> Undo / Redo) */}
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => setShowTemplateModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200/80 transition-colors whitespace-nowrap shrink-0"
          >
            <LayoutTemplate size={14} className="text-indigo-600" />
            <span>テンプレート</span>
          </button>

          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
            <button
              type="button"
              onClick={() => setIsPreviewMode(false)}
              className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                !isPreviewMode
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <PenTool size={13} />
              <span>デザイン編集</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setIsPreviewMode(true);
                setSelectedIds([]);
              }}
              className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                isPreviewMode
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Eye size={13} />
              <span>実画面プレビュー</span>
            </button>
          </div>

          <div className="flex items-center bg-slate-100 rounded-lg p-1 gap-0.5">
            <button
              type="button"
              onClick={handleUndo}
              disabled={historyIndex === 0 || isPreviewMode}
              className="p-1.5 hover:bg-white rounded-md disabled:opacity-30 transition-colors text-slate-700"
              title="元に戻す"
            >
              <Undo size={14} />
            </button>
            <button
              type="button"
              onClick={handleRedo}
              disabled={historyIndex === history.length - 1 || isPreviewMode}
              className="p-1.5 hover:bg-white rounded-md disabled:opacity-30 transition-colors text-slate-700"
              title="やり直す"
            >
              <Redo size={14} />
            </button>
          </div>
        </div>

        {/* Zone 3: Code View & Export Action */}
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => setShowCodeModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
          >
            <Code2 size={15} className="text-indigo-600" />
            <span>コードを見る</span>
          </button>
          <button
            type="button"
            onClick={handleExport}
            className="flex items-center gap-1.5 bg-slate-900 text-white px-4 py-2 rounded-lg text-xs font-medium hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
          >
            <Download size={15} />
            <span>サイトを書き出し</span>
          </button>
        </div>
      </header>

      {/* Main Workspace */}
      <div className="flex flex-1 overflow-hidden relative">
        {!isPreviewMode && <Toolbar onAdd={handleAddElement} />}

        {/* Center Viewport */}
        <div className="flex-1 flex flex-col min-w-0 bg-slate-200/85 relative">
          {toastMessage && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[90] px-4 py-2 rounded-lg bg-slate-900 text-white text-xs font-medium shadow-lg flex items-center gap-2 pointer-events-none">
              <Check size={14} className="text-emerald-400 shrink-0" />
              <span>{toastMessage}</span>
            </div>
          )}

          {isPreviewMode ? (
            /* Exact HTML / CSS / JS Browser Preview with Responsive Viewport Switcher */
            <div className="flex-1 flex flex-col overflow-hidden bg-slate-200/90">
              {/* Responsive Preview Toolbar */}
              <div className="h-11 px-4 bg-white border-b border-slate-200 flex items-center justify-between gap-4 shrink-0 z-20">
                <div className="flex items-center gap-3 min-w-0">
                  <button
                    type="button"
                    onClick={() => setIsPreviewMode(false)}
                    className="px-3 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-xs font-medium text-slate-800 flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
                  >
                    <PenTool size={12} />
                    <span>編集画面に戻る</span>
                  </button>
                  <span className="text-xs text-slate-500 truncate hidden md:inline">
                    実際のブラウザ・スマホでの見え方やボタンの動きをそのまま確認できます
                  </span>
                </div>

                <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg shrink-0">
                  <button
                    type="button"
                    onClick={() => setPreviewViewport('desktop')}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 tabular-nums ${
                      previewViewport === 'desktop'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Monitor size={13} />
                    <span>パソコン</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewViewport('tablet')}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 tabular-nums ${
                      previewViewport === 'tablet'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Tablet size={13} />
                    <span>タブレット</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewViewport('mobile')}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 tabular-nums ${
                      previewViewport === 'mobile'
                        ? 'bg-white text-indigo-700 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Smartphone size={13} />
                    <span>スマホ表示</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setPreviewReloadKey((k) => k + 1)}
                  className="px-2.5 py-1 rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-xs text-slate-700 font-medium flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
                >
                  <RotateCcw size={12} />
                  <span>リセット</span>
                </button>
              </div>

              {/* Viewport Frame Area */}
              <div
                className={`flex-1 overflow-auto flex justify-center ${
                  previewViewport === 'desktop' ? 'bg-white' : 'p-4 sm:p-6 bg-slate-200/80'
                }`}
              >
                <div
                  className={`h-full transition-[width] duration-200 ease-out overflow-hidden ${
                    previewViewport === 'desktop'
                      ? 'w-full'
                      : previewViewport === 'tablet'
                        ? 'w-[768px] max-w-full rounded-xl border border-slate-300 shadow-xl bg-white'
                        : 'w-[390px] max-w-full rounded-2xl border border-slate-300 shadow-xl bg-white'
                  }`}
                >
                  <iframe
                    key={`${activePage.id}-${previewReloadKey}`}
                    title="Webside Live HTML Preview"
                    srcDoc={previewSrcDoc}
                    sandbox="allow-scripts allow-same-origin"
                    className="w-full h-full border-none block"
                    style={{ backgroundColor: pageBg }}
                  />
                </div>
              </div>
            </div>
          ) : (
            /* Interactive Visual Design Canvas */
            <div
              ref={canvasWrapperRef}
              className="flex-1 overflow-hidden relative select-none"
              onPointerDown={handleWrapperPointerDown}
              onPointerMove={handleWrapperPointerMove}
              onPointerUp={handleWrapperPointerUp}
              onDoubleClick={(e) => {
                if (e.target === e.currentTarget) {
                  fitEntirePageInView();
                }
              }}
              style={{
                cursor: isSpacePressed ? 'grab' : isPanning ? 'grabbing' : 'default',
                touchAction: 'none',
              }}
              onClick={() => {
                if (hasPanned.current) return;
                if (!isSpacePressed) handleSelectElement(null);
              }}
            >
              <div
                data-canvas-surface="true"
                className="shadow-xl border border-slate-300/60 absolute transition-none"
                style={{
                  width: `${CANVAS_WIDTH}px`,
                  height: `${pageHeight}px`,
                  backgroundColor: pageBg,
                  color: '#0f172a',
                  transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                  transformOrigin: '0 0',
                  backgroundImage: isDarkCanvas
                    ? 'radial-gradient(rgba(255,255,255,0.12) 1px, transparent 1px)'
                    : 'radial-gradient(rgba(148,163,184,0.45) 1px, transparent 1px)',
                  backgroundSize: '20px 20px',
                }}
              >
                {elements.length === 0 && (
                  <div
                    onClick={(e) => e.stopPropagation()}
                    className="absolute inset-0 flex items-center justify-center pointer-events-none"
                  >
                    <div className="pointer-events-auto bg-white/95 border border-slate-200 rounded-xl shadow-sm p-6 max-w-md text-center space-y-3">
                      <h3 className="text-base font-semibold text-slate-800">
                        白紙のページが用意できました
                      </h3>
                      <p className="text-xs text-slate-500 leading-relaxed">
                        左側のバーから「見出し」「文章」「画像」を追加するか、デザイン済みのテンプレートを選んで編集を始められます。
                      </p>
                      <div className="flex items-center justify-center gap-2.5 pt-1">
                        <button
                          type="button"
                          onClick={() => setShowTemplateModal(true)}
                          className="px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium transition-colors whitespace-nowrap shrink-0"
                        >
                          テンプレートを選ぶ
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAddElement('text', 'heading')}
                          className="px-3.5 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-medium transition-colors whitespace-nowrap shrink-0"
                        >
                          見出しを追加する
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {elements.map((el) => (
                  <CanvasElement
                    key={el.id}
                    element={el}
                    isSelected={selectedIds.includes(el.id)}
                    isColliding={collidingIds.includes(el.id)}
                    isPreviewMode={false}
                    onSelect={(id, isShift) => handleSelectElement(id, isShift)}
                    onUpdate={handleUpdateElementsWithHistory}
                    onDragMove={handleDragMove}
                    onDragEnd={handleDragEnd}
                    onConstrainResize={handleConstrainResize}
                    onResizeEnd={handleResizeEnd}
                    onAutoHeightSync={handleAutoHeightSync}
                    onCancelInlineEdit={handleCancelInlineEdit}
                    zoom={zoom}
                    isSpacePressed={isSpacePressed}
                  />
                ))}

                {/* Smart Guides */}
                {activeGuides.current.map((guide, i) => (
                  <div
                    key={i}
                    className="absolute pointer-events-none z-[100]"
                    style={{
                      backgroundColor: guide.variant === 'margin' ? '#f97316' : '#4f46e5',
                      left: guide.type === 'x' ? `${guide.pos}px` : 0,
                      top: guide.type === 'y' ? `${guide.pos}px` : 0,
                      width: guide.type === 'x' ? '1px' : '100%',
                      height: guide.type === 'y' ? '1px' : '100%',
                    }}
                  />
                ))}

                {/* Bottom Page Height Drag Handle */}
                <div
                  onPointerDown={handlePageHeightResizeDown}
                  onPointerMove={handlePageHeightResizeMove}
                  onPointerUp={handlePageHeightResizeUp}
                  onClick={(e) => e.stopPropagation()}
                  className="absolute left-0 right-0 flex items-center justify-center cursor-ns-resize group"
                  style={{
                    top: `${pageHeight + 8}px`,
                    height: '28px',
                  }}
                  title="上下にドラッグしてページの長さを変更できます"
                >
                  <div className="px-3 py-1 rounded bg-white/95 border border-slate-300 shadow-xs text-[11px] text-slate-600 group-hover:border-indigo-500 group-hover:text-indigo-700 flex items-center gap-1.5 tabular-nums transition-colors">
                    <GripHorizontal size={13} />
                    <span>ページの高さをドラッグで調整</span>
                    <span className="text-slate-300">·</span>
                    <span className="font-mono text-slate-500 group-hover:text-indigo-600">
                      {pageHeight}px
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Bottom Bar: Clean Page Tabs + Zoom Controls */}
          <div className="h-10 bg-white border-t border-slate-200 flex items-center justify-between px-3 select-none z-30 gap-3">
            {/* Left: Clean Human-Named Page Tabs (no confusing .html file paths) */}
            <div className="flex items-end h-full overflow-x-auto gap-1 pt-1 min-w-0">
              {pages.map((page) => (
                <div
                  key={page.id}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    setContextMenu({ x: e.clientX, y: e.clientY - 84, pageId: page.id });
                  }}
                  onClick={() => {
                    setActivePageId(page.id);
                    setSelectedIds([]);
                  }}
                  onDoubleClick={() => !isPreviewMode && startRenaming(page)}
                  title="ダブルクリックでページ名を変更"
                  className={`group relative h-full px-3.5 flex items-center gap-2 cursor-pointer text-xs font-medium border-t-2 border-x rounded-t-sm min-w-[96px] max-w-[200px] shrink-0 transition-colors ${
                    activePageId === page.id
                      ? 'bg-slate-50 text-indigo-700 border-t-indigo-600 border-x-slate-200'
                      : 'bg-slate-100/70 text-slate-600 border-t-transparent border-x-transparent hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  {editingPageId === page.id ? (
                    <input
                      ref={editInputRef}
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      onBlur={finishRenaming}
                      onKeyDown={(e) => e.key === 'Enter' && finishRenaming()}
                      className="w-full bg-white border border-indigo-400 rounded px-1.5 py-0.5 outline-none text-slate-900 text-xs"
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <>
                      <span className="truncate select-none">{page.name}</span>
                      {!isPreviewMode && pages.length > 1 && (
                        confirmDeletePageId === page.id ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              executeDeletePage(page.id);
                            }}
                            className="px-1.5 py-0.5 bg-red-600 text-white text-[10px] rounded whitespace-nowrap"
                          >
                            削除確認
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setConfirmDeletePageId(page.id);
                            }}
                            className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-red-100 hover:text-red-600 rounded transition-opacity"
                            title="このページを削除"
                          >
                            <Plus size={12} className="rotate-45" />
                          </button>
                        )
                      )}
                    </>
                  )}
                </div>
              ))}
              {!isPreviewMode && (
                <button
                  type="button"
                  onClick={handleAddPage}
                  className="h-7 px-2 flex items-center gap-1 rounded-md hover:bg-slate-100 text-slate-600 hover:text-slate-900 ml-1 mb-0.5 text-xs shrink-0 transition-colors whitespace-nowrap"
                  title="サイトに新しいページを追加します"
                >
                  <Plus size={13} />
                  <span>ページ追加</span>
                </button>
              )}
            </div>

            {/* Right: Clean Dimensions & Zoom Controls */}
            <div className="flex items-center gap-2.5 text-xs text-slate-600 h-full shrink-0">
              {!isPreviewMode && isSpacePressed && (
                <span className="text-indigo-600 font-medium flex items-center gap-1 whitespace-nowrap">
                  <Hand size={12} /> 画面移動中
                </span>
              )}

              <span className="text-[11px] font-mono text-slate-400 hidden lg:inline tabular-nums">
                {CANVAS_WIDTH}×{pageHeight}px
              </span>

              {!isPreviewMode && (
                <>
                  <button
                    type="button"
                    onClick={fitEntirePageInView}
                    className="flex items-center gap-1 px-2 py-1 rounded hover:bg-slate-100 text-slate-600 hover:text-slate-900 transition-colors whitespace-nowrap"
                    title="ページ全体を画面にフィット (Ctrl/Cmd + 0)"
                  >
                    <Maximize size={13} />
                    <span className="text-[11px]">全体表示</span>
                  </button>

                  <div className="flex items-center gap-1.5 relative">
                    <button
                      type="button"
                      onClick={() => setZoomAroundViewportPoint(zoom / 1.18)}
                      className="p-1 hover:bg-slate-100 rounded text-slate-600"
                      title="縮小 (Ctrl/Cmd + -)"
                    >
                      <ZoomOut size={14} />
                    </button>

                    <input
                      type="range"
                      min={15}
                      max={300}
                      step={5}
                      value={Math.round(zoom * 100)}
                      onChange={(e) => setZoomAroundViewportPoint(Number(e.target.value) / 100)}
                      className="w-20 accent-indigo-600 cursor-pointer hidden sm:block"
                      title="ズーム倍率スライダー"
                    />

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowZoomMenu((prev) => !prev);
                      }}
                      className="w-12 py-0.5 rounded hover:bg-slate-100 text-center font-mono text-[11px] tabular-nums text-slate-700"
                      title="クリックで倍率プリセットを選択"
                    >
                      {Math.round(zoom * 100)}%
                    </button>

                    <button
                      type="button"
                      onClick={() => setZoomAroundViewportPoint(zoom * 1.18)}
                      className="p-1 hover:bg-slate-100 rounded text-slate-600"
                      title="拡大 (Ctrl/Cmd + +)"
                    >
                      <ZoomIn size={14} />
                    </button>

                    {showZoomMenu && (
                      <div
                        className="absolute bottom-full right-0 mb-2 bg-white border border-slate-200 rounded-lg shadow-xl py-1 w-36 z-50"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {[25, 50, 75, 100, 150, 200].map((pct) => (
                          <button
                            key={pct}
                            type="button"
                            onClick={() => {
                              setZoomAroundViewportPoint(pct / 100);
                              setShowZoomMenu(false);
                            }}
                            className="w-full px-3 py-1.5 text-left text-xs font-mono tabular-nums hover:bg-slate-50 text-slate-700 flex justify-between items-center"
                          >
                            <span>{pct}%</span>
                            {Math.round(zoom * 100) === pct && (
                              <Check size={12} className="text-indigo-600" />
                            )}
                          </button>
                        ))}
                        <div className="border-t border-slate-100 my-1" />
                        <button
                          type="button"
                          onClick={() => {
                            fitCanvasToViewport(pageHeight, true);
                            setShowZoomMenu(false);
                          }}
                          className="w-full px-3 py-1.5 text-left text-xs hover:bg-slate-50 text-slate-700"
                        >
                          横幅に合わせる
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            fitEntirePageInView();
                            setShowZoomMenu(false);
                          }}
                          className="w-full px-3 py-1.5 text-left text-xs hover:bg-slate-50 text-slate-700"
                        >
                          ページ全体を表示
                        </button>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Page Tab Context Menu */}
          {contextMenu && (
            <div
              className="fixed bg-white shadow-lg rounded-lg border border-slate-200 py-1 z-50 min-w-[150px]"
              style={{ left: contextMenu.x, top: contextMenu.y }}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                className="w-full text-left px-3 py-2 text-xs hover:bg-slate-50 text-slate-700 flex items-center gap-2"
                onClick={() => {
                  const p = pages.find((item) => item.id === contextMenu.pageId);
                  if (p) startRenaming(p);
                }}
              >
                <Edit2 size={12} /> ページ名を変更
              </button>
              {pages.length > 1 && (
                <button
                  type="button"
                  className="w-full text-left px-3 py-2 text-xs hover:bg-red-50 text-red-600 flex items-center gap-2"
                  onClick={() => executeDeletePage(contextMenu.pageId)}
                >
                  <Trash2 size={12} /> ページを削除
                </button>
              )}
            </div>
          )}
        </div>

        {!isPreviewMode && (
          <PropertiesPanel
            elements={elements.filter((el) => selectedIds.includes(el.id))}
            allPageElements={elements}
            activePage={activePage}
            onUpdatePage={handleUpdatePage}
            onSelectElement={handleSelectElement}
            onReorderElement={handleReorderElement}
            onUpdate={handleUpdateElementsWithHistory}
            onDelete={handleDeleteElements}
            onDuplicate={handleDuplicateElements}
            canvasWidth={CANVAS_WIDTH}
            canvasHeight={pageHeight}
            pages={pages}
            onEnterPreview={() => {
              setIsPreviewMode(true);
              setSelectedIds([]);
            }}
          />
        )}
      </div>

      {/* Design Templates Gallery Modal */}
      {showTemplateModal && (
        <TemplateModal
          onApplyTemplate={handleApplyTemplate}
          onClose={() => setShowTemplateModal(false)}
        />
      )}

      {/* Live Generated HTML / CSS / JS Code Modal */}
      {showCodeModal && (
        <CodeModal
          pages={pages}
          activePageId={activePageId}
          canvasWidth={CANVAS_WIDTH}
          canvasHeight={pageHeight}
          onClose={() => setShowCodeModal(false)}
          onExportZip={handleExport}
        />
      )}
    </div>
  );
};

export default App;