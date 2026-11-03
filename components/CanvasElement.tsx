import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AlignJustify, ArrowRight, Film, ImageOff, Lock, Play, Plus, Volume2 } from 'lucide-react';
import { EditorElement, Page } from '../types';
import {
  buildCssFilterString,
  formatCssBoxShorthand,
  getBorderSides,
  getEffectiveBorderWidth,
  getEffectiveTag,
  getElementHumanSummary,
  getMarginSides,
  getPaddingSides,
  hasAnyMargin,
  hasAnyPadding,
  isAutoHeightElement,
  sanitizeHtmlId,
} from '../utils/boxModel';
import { parseVideoEmbed } from '../utils/mediaUtils';

interface ResizePatch {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface CanvasElementProps {
  element: EditorElement;
  isSelected: boolean;
  isColliding?: boolean;
  isPreviewMode?: boolean;
  isHiddenInPreview?: boolean;
  isActiveClassInPreview?: boolean;
  onSelect: (id: string | null, isShift: boolean) => void;
  onUpdate: (ids: string[], updates: Partial<EditorElement>) => void;
  onDragMove?: (id: string, x: number, y: number) => { x: number; y: number };
  onDragEnd?: () => void;
  onConstrainResize?: (element: EditorElement, patch: ResizePatch, handle: string) => ResizePatch;
  onResizeEnd?: () => void;
  onAutoHeightSync?: (id: string, nextHeight: number, isLiveInlineEdit?: boolean) => void;
  onCancelInlineEdit?: () => void;
  onTriggerInteraction?: (element: EditorElement, eventType: 'click' | 'dblclick' | 'mouseenter') => void;
  onNavigatePage?: (pageId: string) => void;
  pages?: Page[];
  zoom: number;
  isSpacePressed?: boolean;
}

const CanvasElement: React.FC<CanvasElementProps> = ({
  element,
  isSelected,
  isColliding = false,
  isPreviewMode = false,
  isHiddenInPreview = false,
  isActiveClassInPreview = false,
  onSelect,
  onUpdate,
  onDragMove,
  onDragEnd,
  onConstrainResize,
  onResizeEnd,
  onAutoHeightSync,
  onCancelInlineEdit,
  onTriggerInteraction,
  onNavigatePage,
  pages,
  zoom,
  isSpacePressed,
}) => {
  const elementRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const editTextareaRef = useRef<HTMLTextAreaElement>(null);
  const prevTriggerSigRef = useRef<string | null>(null);
  const initialInlineContentRef = useRef<string>('');

  const [isDragging, setIsDragging] = useState(false);
  const dragSessionRef = useRef<{
    active: boolean;
    pointerId: number | null;
    startX: number;
    startY: number;
    initialX: number;
    initialY: number;
  }>({
    active: false,
    pointerId: null,
    startX: 0,
    startY: 0,
    initialX: 0,
    initialY: 0,
  });

  const hasMoved = useRef(false);
  const wasSelectedOnDown = useRef(false);

  const [isResizing, setIsResizing] = useState(false);
  const resizeSessionRef = useRef<{
    active: boolean;
    pointerId: number | null;
    handle: string | null;
    startX: number;
    startY: number;
    w: number;
    h: number;
    x: number;
    y: number;
  }>({
    active: false,
    pointerId: null,
    handle: null,
    startX: 0,
    startY: 0,
    w: 0,
    h: 0,
    x: 0,
    y: 0,
  });

  const [isHovered, setIsHovered] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isEditingText, setIsEditingText] = useState(false);
  const [draftText, setDraftText] = useState(element.content || '');
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    setImgError(false);
  }, [element.src]);

  useEffect(() => {
    if (!isSelected && isEditingText) {
      setIsEditingText(false);
    }
  }, [isSelected, isEditingText]);

  useEffect(() => {
    if (isEditingText && editTextareaRef.current) {
      editTextareaRef.current.focus();
      editTextareaRef.current.select();
    }
  }, [isEditingText]);

  const padding = getPaddingSides(element.style);
  const margin = getMarginSides(element.style);
  const borderSides = getBorderSides(element.style);
  const borderW = getEffectiveBorderWidth(element.style);
  const hasMargin = hasAnyMargin(element.style);
  const hasPadding = hasAnyPadding(element.style);
  const isContentBox = element.style.boxSizing === 'content-box';
  const selectorId = sanitizeHtmlId(element.htmlId, element.id);
  const tagLabel = getEffectiveTag(element);
  const humanSummary = getElementHumanSummary(element);
  const isLocked = Boolean(element.locked);
  const cssFilter = buildCssFilterString(element.style);
  const autoHeightEnabled = isAutoHeightElement(element);

  const activeTextForMeasure = isEditingText ? draftText : element.content || '';
  const probeText =
    activeTextForMeasure.length === 0
      ? '\u200b'
      : activeTextForMeasure.endsWith('\n')
        ? `${activeTextForMeasure}\u200b`
        : activeTextForMeasure;

  const triggerSignature = [
    activeTextForMeasure,
    element.width,
    autoHeightEnabled,
    element.style.fontSize ?? '',
    element.style.lineHeight ?? '',
    element.style.fontFamily ?? '',
    element.style.fontWeight ?? '',
    element.style.fontStyle ?? '',
    element.style.letterSpacing ?? '',
    element.style.textTransform ?? '',
    padding.top,
    padding.right,
    padding.bottom,
    padding.left,
    borderSides.top,
    borderSides.right,
    borderSides.bottom,
    borderSides.left,
    isContentBox ? 'content' : 'border',
  ].join('|');

  useLayoutEffect(() => {
    if (isPreviewMode || !autoHeightEnabled || !onAutoHeightSync) {
      prevTriggerSigRef.current = triggerSignature;
      return;
    }
    const probeEl = measureRef.current;
    if (!probeEl) return;

    const rawOffsetH = probeEl.offsetHeight;
    if (rawOffsetH <= 0) return;

    const nonContentH = padding.top + padding.bottom + borderSides.top + borderSides.bottom;
    const measuredTargetH = isContentBox
      ? Math.max(16, rawOffsetH - nonContentH)
      : Math.max(20, rawOffsetH);

    if (prevTriggerSigRef.current === null) {
      prevTriggerSigRef.current = triggerSignature;
      // On initial mount, preserve authored height unless content genuinely overflows
      if (measuredTargetH > element.height + 2) {
        onAutoHeightSync(element.id, measuredTargetH, false);
      }
      return;
    }

    if (prevTriggerSigRef.current !== triggerSignature && !isResizing) {
      prevTriggerSigRef.current = triggerSignature;
      if (Math.abs(measuredTargetH - element.height) >= 1) {
        onAutoHeightSync(element.id, measuredTargetH, isEditingText);
      }
    }
  }, [
    isPreviewMode,
    autoHeightEnabled,
    onAutoHeightSync,
    triggerSignature,
    isResizing,
    isEditingText,
    element.id,
    element.height,
    isContentBox,
    padding.top,
    padding.bottom,
    borderSides.top,
    borderSides.bottom,
  ]);

  if (isPreviewMode && isHiddenInPreview) {
    return null;
  }

  // --- Dragging Logic ---
  const finishDragSession = (targetEl?: EventTarget | null, pointerId?: number) => {
    if (!dragSessionRef.current.active) return;
    const pid = pointerId ?? dragSessionRef.current.pointerId;
    dragSessionRef.current.active = false;
    dragSessionRef.current.pointerId = null;
    setIsDragging(false);

    if (targetEl && pid !== null && pid !== undefined) {
      try {
        const htmlEl = targetEl as HTMLElement;
        if (htmlEl.hasPointerCapture?.(pid)) {
          htmlEl.releasePointerCapture(pid);
        }
      } catch {
        // Ignore if already released
      }
    }

    if (onDragEnd) onDragEnd();
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (isPreviewMode || isSpacePressed || isEditingText) return;

    e.stopPropagation();
    if (e.button !== 0) return;

    hasMoved.current = false;
    wasSelectedOnDown.current = isSelected;

    if (!isSelected) {
      onSelect(element.id, e.shiftKey);
    }

    if (isLocked) {
      return;
    }

    dragSessionRef.current = {
      active: true,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      initialX: element.x,
      initialY: element.y,
    };
    setIsDragging(true);

    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      // Ignore synthetic pointer edge cases
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    const session = dragSessionRef.current;
    if (!session.active || isPreviewMode || isLocked) return;

    if (e.pointerType === 'mouse' && (e.buttons & 1) === 0) {
      finishDragSession(e.currentTarget, e.pointerId);
      return;
    }

    const dist = Math.hypot(e.clientX - session.startX, e.clientY - session.startY);
    if (dist > 2) {
      hasMoved.current = true;
    }

    if (hasMoved.current) {
      const dx = (e.clientX - session.startX) / zoom;
      const dy = (e.clientY - session.startY) / zoom;

      let newX = session.initialX;
      let newY = session.initialY;

      if (element.anchorX === 'left') newX += dx;
      else if (element.anchorX === 'right') newX -= dx;
      else newX += dx;

      if (element.anchorY === 'top') newY += dy;
      else if (element.anchorY === 'bottom') newY -= dy;
      else newY += dy;

      if (onDragMove) {
        onDragMove(element.id, Math.round(newX), Math.round(newY));
      } else {
        onUpdate([element.id], {
          x: Math.round(newX),
          y: Math.round(newY),
        });
      }
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (dragSessionRef.current.active) {
      const didMove = hasMoved.current;
      const wasSelected = wasSelectedOnDown.current;
      finishDragSession(e.currentTarget, e.pointerId);

      if (!didMove && wasSelected && e.shiftKey) {
        onSelect(element.id, true);
      }
    }
  };

  // --- Resizing Logic ---
  const finishResizeSession = (targetEl?: EventTarget | null, pointerId?: number) => {
    if (!resizeSessionRef.current.active) return;
    const pid = pointerId ?? resizeSessionRef.current.pointerId;
    resizeSessionRef.current.active = false;
    resizeSessionRef.current.pointerId = null;
    resizeSessionRef.current.handle = null;
    setIsResizing(false);

    if (targetEl && pid !== null && pid !== undefined) {
      try {
        const htmlEl = targetEl as HTMLElement;
        if (htmlEl.hasPointerCapture?.(pid)) {
          htmlEl.releasePointerCapture(pid);
        }
      } catch {
        // Ignore
      }
    }

    if (onResizeEnd) onResizeEnd();
  };

  const handleResizeStart = (e: React.PointerEvent, handle: string) => {
    if (isPreviewMode || isSpacePressed || isLocked) return;

    e.stopPropagation();
    e.preventDefault();
    resizeSessionRef.current = {
      active: true,
      pointerId: e.pointerId,
      handle,
      startX: e.clientX,
      startY: e.clientY,
      w: element.width,
      h: element.height,
      x: element.x,
      y: element.y,
    };
    setIsResizing(true);
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      // Ignore
    }
  };

  const handleResizeMove = (e: React.PointerEvent) => {
    const rSession = resizeSessionRef.current;
    if (!rSession.active || !rSession.handle) return;
    e.stopPropagation();

    if (e.pointerType === 'mouse' && (e.buttons & 1) === 0) {
      finishResizeSession(e.currentTarget, e.pointerId);
      return;
    }

    const dx = (e.clientX - rSession.startX) / zoom;
    const dy = (e.clientY - rSession.startY) / zoom;

    let newWidth = rSession.w;
    let newHeight = rSession.h;
    let newX = rSession.x;
    let newY = rSession.y;

    const isEmptyBoxOrDivider =
      element.type === 'divider' ||
      ((element.type === 'rectangle' || element.type === 'circle') &&
        !(element.content || '').trim());

    const extraW = isContentBox
      ? 0
      : padding.left + padding.right + borderSides.left + borderSides.right;
    const extraH = isContentBox
      ? 0
      : padding.top + padding.bottom + borderSides.top + borderSides.bottom;

    const minW = isEmptyBoxOrDivider ? Math.max(1, extraW) : Math.max(20, extraW + 16);
    const naturalMeasuredH =
      autoHeightEnabled && measureRef.current
        ? isContentBox
          ? Math.max(16, measureRef.current.offsetHeight - (padding.top + padding.bottom + borderSides.top + borderSides.bottom))
          : Math.max(20, measureRef.current.offsetHeight)
        : 0;
    const minH = isEmptyBoxOrDivider
      ? Math.max(1, extraH)
      : Math.max(20, extraH + 16, naturalMeasuredH);

    if (rSession.handle.includes('e')) {
      newWidth = Math.max(minW, rSession.w + dx);
      const actualChange = newWidth - rSession.w;
      if (element.anchorX === 'right') {
        newX = rSession.x - actualChange;
      } else if (element.anchorX === 'center') {
        newX = rSession.x + actualChange / 2;
      }
    }
    if (rSession.handle.includes('s')) {
      newHeight = Math.max(minH, rSession.h + dy);
      const actualChange = newHeight - rSession.h;
      if (element.anchorY === 'bottom') {
        newY = rSession.y - actualChange;
      } else if (element.anchorY === 'center') {
        newY = rSession.y + actualChange / 2;
      }
    }
    if (rSession.handle.includes('w')) {
      const requestedWidth = rSession.w - dx;
      newWidth = Math.max(minW, requestedWidth);
      const actualChange = newWidth - rSession.w;
      if (element.anchorX === 'left') {
        newX = rSession.x - actualChange;
      } else if (element.anchorX === 'center') {
        newX = rSession.x - actualChange / 2;
      }
    }
    if (rSession.handle.includes('n')) {
      const requestedHeight = rSession.h - dy;
      newHeight = Math.max(minH, requestedHeight);
      const actualChange = newHeight - rSession.h;
      if (element.anchorY === 'top') {
        newY = rSession.y - actualChange;
      } else if (element.anchorY === 'center') {
        newY = rSession.y - actualChange / 2;
      }
    }

    let patch: ResizePatch = {
      width: Math.round(newWidth),
      height: Math.round(newHeight),
      x: Math.round(newX),
      y: Math.round(newY),
    };

    if (onConstrainResize) {
      patch = onConstrainResize(element, patch, rSession.handle);
    }

    onUpdate([element.id], patch);
  };

  const handleResizeUp = (e: React.PointerEvent) => {
    finishResizeSession(e.currentTarget, e.pointerId);
  };

  const commitInlineText = () => {
    setIsEditingText(false);
    if (draftText !== initialInlineContentRef.current || draftText !== (element.content || '')) {
      onUpdate([element.id], { content: draftText });
    }
  };

  // --- Transform Construction ---
  const transformParts: string[] = [];
  if (element.anchorX === 'center') transformParts.push('translateX(-50%)');
  if (element.anchorY === 'center') transformParts.push('translateY(-50%)');
  if (element.style.rotate) transformParts.push(`rotate(${element.style.rotate}deg)`);

  const isHoverActive = isHovered && !isDragging && !isResizing && !isSpacePressed;
  if (isHoverActive) {
    if (element.hoverEffect === 'scale') {
      transformParts.push('scale(1.04)');
    } else if (element.hoverEffect === 'lift') {
      transformParts.push('translateY(-4px)');
    }
  }

  let finalBoxShadow = element.style.boxShadow;
  if (isHoverActive && element.hoverEffect === 'lift') {
    finalBoxShadow = finalBoxShadow
      ? `${finalBoxShadow}, 0 10px 20px rgba(15, 23, 42, 0.14)`
      : '0 10px 20px rgba(15, 23, 42, 0.14)';
  }

  const effectiveBg =
    isHoverActive && element.style.hoverBackgroundColor
      ? element.style.hoverBackgroundColor
      : element.type === 'divider'
        ? element.style.backgroundColor && element.style.backgroundColor !== 'transparent'
          ? element.style.backgroundColor
          : '#cbd5e1'
        : element.style.backgroundColor;

  const effectiveColor =
    isHoverActive && element.style.hoverColor ? element.style.hoverColor : element.style.color;

  const radiusUnit = element.style.borderRadiusUnit || 'px';
  const effectiveRadius =
    element.type === 'circle' && element.style.borderRadius === undefined
      ? '50%'
      : `${element.style.borderRadius || 0}${radiusUnit}`;

  const leftCss =
    element.anchorX === 'left'
      ? `${element.x}px`
      : element.anchorX === 'center'
        ? element.x === 0
          ? '50%'
          : `calc(50% + ${element.x}px)`
        : undefined;

  const topCss =
    element.anchorY === 'top'
      ? `${element.y}px`
      : element.anchorY === 'center'
        ? element.y === 0
          ? '50%'
          : `calc(50% + ${element.y}px)`
        : undefined;

  const hasInteractiveJs = element.interaction && element.interaction.action !== 'none';

  const baseOpacity =
    isHoverActive && element.hoverEffect === 'opacity'
      ? (element.style.opacity ?? 1) * 0.75
      : (element.style.opacity ?? 1);

  const effectiveOpacity =
    !isPreviewMode && element.hiddenByDefault
      ? baseOpacity * (isSelected ? 0.85 : 0.52)
      : baseOpacity;

  const blurVal =
    element.style.backdropFilterBlur && element.style.backdropFilterBlur > 0
      ? `blur(${element.style.backdropFilterBlur}px)`
      : undefined;

  const style: React.CSSProperties = {
    position: 'absolute',
    width: `${element.width}px`,
    height: `${element.height}px`,
    left: leftCss,
    right: element.anchorX === 'right' ? `${element.x}px` : undefined,
    top: topCss,
    bottom: element.anchorY === 'bottom' ? `${element.y}px` : undefined,
    transform: transformParts.length > 0 ? transformParts.join(' ') : undefined,
    boxSizing: isContentBox ? 'content-box' : 'border-box',

    marginTop: `${margin.top}px`,
    marginRight: `${margin.right}px`,
    marginBottom: `${margin.bottom}px`,
    marginLeft: `${margin.left}px`,

    paddingTop:
      element.type === 'navigation' && element.navType === 'horizontal' && !hasPadding
        ? '0px'
        : `${padding.top}px`,
    paddingRight:
      element.type === 'navigation' && element.navType === 'horizontal' && !hasPadding
        ? `${element.style.padding ?? 24}px`
        : `${padding.right}px`,
    paddingBottom:
      element.type === 'navigation' && element.navType === 'horizontal' && !hasPadding
        ? '0px'
        : `${padding.bottom}px`,
    paddingLeft:
      element.type === 'navigation' && element.navType === 'horizontal' && !hasPadding
        ? `${element.style.padding ?? 24}px`
        : `${padding.left}px`,

    backgroundColor: effectiveBg,
    backgroundImage: element.style.backgroundImage || undefined,
    backdropFilter: blurVal,
    WebkitBackdropFilter: blurVal,

    color: effectiveColor,
    fontSize: element.style.fontSize ? `${element.style.fontSize}px` : undefined,
    fontWeight: element.style.fontWeight || (element.type === 'navigation' ? '500' : undefined),
    fontStyle: element.style.fontStyle || 'normal',
    fontFamily: element.style.fontFamily,
    lineHeight: element.style.lineHeight ?? 1.5,
    letterSpacing: element.style.letterSpacing ? `${element.style.letterSpacing}px` : undefined,
    textDecoration: element.style.textDecoration,
    textTransform: element.style.textTransform || 'none',
    writingMode: element.style.writingMode || 'horizontal-tb',

    borderRadius: effectiveRadius,
    borderStyle: borderW > 0 ? element.style.borderStyle || 'solid' : 'none',
    borderColor: element.style.borderColor || '#0f172a',
    borderTopWidth: `${borderSides.top}px`,
    borderRightWidth: `${borderSides.right}px`,
    borderBottomWidth: `${borderSides.bottom}px`,
    borderLeftWidth: `${borderSides.left}px`,

    textAlign: element.style.textAlign,
    opacity: effectiveOpacity,
    filter: cssFilter || undefined,
    zIndex:
      !isPreviewMode && (isDragging || isResizing)
        ? Math.max(element.style.zIndex ?? 1, 80)
        : (element.style.zIndex ?? 1),
    boxShadow: finalBoxShadow,

    overflow: 'visible',

    cursor: isPreviewMode
      ? element.style.cursor && element.style.cursor !== 'auto'
        ? element.style.cursor
        : element.link || element.type === 'button' || hasInteractiveJs
          ? 'pointer'
          : 'default'
      : isLocked
        ? 'default'
        : isDragging
          ? 'grabbing'
          : isEditingText
            ? 'text'
            : 'move',

    userSelect: isEditingText ? 'text' : 'none',
    pointerEvents: isSpacePressed ? 'none' : 'auto',
    transition:
      isDragging || isResizing
        ? 'none'
        : 'box-shadow 0.2s ease, opacity 0.2s ease, background-color 0.2s ease, color 0.2s ease',
    outline: isActiveClassInPreview ? '2px solid #4f46e5' : undefined,
    outlineOffset: isActiveClassInPreview ? '2px' : undefined,
  };

  const handleStyle = (pos: string): React.CSSProperties => {
    const s: React.CSSProperties = {
      position: 'absolute',
      width: 10,
      height: 10,
      background: '#ffffff',
      border: '1.5px solid #4f46e5',
      borderRadius: '2px',
      zIndex: 60,
    };
    if (pos === 'nw') {
      s.left = -5 - borderSides.left;
      s.top = -5 - borderSides.top;
      s.cursor = 'nw-resize';
    }
    if (pos === 'ne') {
      s.right = -5 - borderSides.right;
      s.top = -5 - borderSides.top;
      s.cursor = 'ne-resize';
    }
    if (pos === 'sw') {
      s.left = -5 - borderSides.left;
      s.bottom = -5 - borderSides.bottom;
      s.cursor = 'sw-resize';
    }
    if (pos === 'se') {
      s.right = -5 - borderSides.right;
      s.bottom = -5 - borderSides.bottom;
      s.cursor = 'se-resize';
    }
    return s;
  };

  const renderMenubarContent = () => {
    const gap = element.style.gap ?? 24;
    const leftItems = element.menuItems?.filter((i) => (i.position || 'left') === 'left') || [];
    const rightItems = element.menuItems?.filter((i) => i.position === 'right') || [];

    const handleNavItemClick = (e: React.MouseEvent, link: string) => {
      if (!isPreviewMode) return;
      e.stopPropagation();
      const targetId = link.startsWith('#') ? link.slice(1) : link;
      if (onNavigatePage && targetId) {
        onNavigatePage(targetId);
      }
    };

    return (
      <div
        className={`w-full h-full flex items-center justify-between ${isPreviewMode ? 'pointer-events-auto' : 'pointer-events-none'}`}
      >
        <div style={{ display: 'flex', gap: `${gap}px`, alignItems: 'center' }}>
          {leftItems.map((item) => (
            <span
              key={item.id}
              onClick={(e) => handleNavItemClick(e, item.link)}
              className={`transition-opacity whitespace-nowrap ${isPreviewMode ? 'cursor-pointer hover:opacity-70' : ''}`}
              style={{ fontWeight: 'inherit' }}
            >
              {item.label}
            </span>
          ))}
        </div>
        <div style={{ display: 'flex', gap: `${gap}px`, alignItems: 'center' }}>
          {rightItems.map((item) => (
            <span
              key={item.id}
              onClick={(e) => handleNavItemClick(e, item.link)}
              className={`transition-opacity whitespace-nowrap ${isPreviewMode ? 'cursor-pointer hover:opacity-70' : ''}`}
              style={{ fontWeight: 'inherit' }}
            >
              {item.label}
            </span>
          ))}
        </div>
      </div>
    );
  };

  const canInlineEditText =
    !isLocked &&
    (element.type === 'text' ||
      element.type === 'button' ||
      element.type === 'rectangle' ||
      element.type === 'circle');

  const handleElementClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isPreviewMode) return;

    if (onTriggerInteraction) {
      onTriggerInteraction(element, 'click');
    }

    if (element.linkType === 'page' && element.link && onNavigatePage) {
      onNavigatePage(element.link);
    }
  };

  const handleElementDoubleClick = (e: React.MouseEvent) => {
    if (isSpacePressed) return;
    e.stopPropagation();

    if (isPreviewMode) {
      if (onTriggerInteraction) {
        onTriggerInteraction(element, 'dblclick');
      }
      return;
    }

    if (canInlineEditText) {
      const startText = element.content || '';
      initialInlineContentRef.current = startText;
      setDraftText(startText);
      setIsEditingText(true);
    }
  };

  // Match exact display / flex rules emitted by buildElementCssRules in codeGenerator.ts
  const isTextElement = element.type === 'text';
  const effectiveDisplay = isTextElement
    ? element.style.display || 'block'
    : element.style.display || 'flex';
  const isFlexLayout = effectiveDisplay === 'flex' || effectiveDisplay === 'inline-flex';

  const innerAlignItems = isTextElement
    ? element.style.alignItems || 'flex-start'
    : element.style.alignItems || 'center';

  const innerJustifyContent = isTextElement
    ? element.style.justifyContent ||
      (element.style.textAlign === 'center'
        ? 'center'
        : element.style.textAlign === 'right'
          ? 'flex-end'
          : 'flex-start')
    : element.style.justifyContent || 'center';

  return (
    <div
      id={`canvas-${selectorId}`}
      ref={elementRef}
      style={style}
      onDragStart={(e) => {
        if (!isEditingText) e.preventDefault();
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onLostPointerCapture={handlePointerUp}
      onMouseEnter={() => {
        setIsHovered(true);
        if (isPreviewMode && onTriggerInteraction) {
          onTriggerInteraction(element, 'mouseenter');
        }
      }}
      onMouseLeave={() => setIsHovered(false)}
      onClick={handleElementClick}
      onDoubleClick={handleElementDoubleClick}
      className="group"
    >
      {/* Expanded hit target for ultra-thin <hr> dividers in Edit Mode */}
      {!isPreviewMode && element.height <= 8 && (
        <div
          style={{
            position: 'absolute',
            top: -6,
            bottom: -6,
            left: 0,
            right: 0,
            zIndex: 10,
          }}
        />
      )}

      {/* ================================================================
          Box Model Double-Line Visualization (Margin Line + Padding Line)
         ================================================================ */}
      {!isPreviewMode && hasMargin && (
        <div
          className="pointer-events-none"
          style={{
            position: 'absolute',
            top: -(margin.top + borderSides.top),
            right: -(margin.right + borderSides.right),
            bottom: -(margin.bottom + borderSides.bottom),
            left: -(margin.left + borderSides.left),
            border: isColliding
              ? '1.5px solid #ef4444'
              : isSelected
                ? '1.5px dashed #f97316'
                : isHovered
                  ? '1.5px dashed rgba(249, 115, 22, 0.85)'
                  : '1px dashed rgba(249, 115, 22, 0.55)',
            backgroundColor: isColliding
              ? 'rgba(239, 68, 68, 0.08)'
              : isSelected
                ? 'rgba(249, 115, 22, 0.05)'
                : 'transparent',
            writingMode: 'horizontal-tb',
            zIndex: 42,
          }}
        >
          {(isSelected || isColliding) && (
            <span
              className="tabular-nums"
              style={{
                position: 'absolute',
                bottom: 2,
                right: 4,
                fontSize: 9,
                lineHeight: '13px',
                padding: '0 4px',
                borderRadius: 2,
                backgroundColor: isColliding ? '#ef4444' : '#f97316',
                color: '#ffffff',
                whiteSpace: 'nowrap',
              }}
            >
              外側余白 <span className="font-mono">margin: {formatCssBoxShorthand(margin)}</span>
            </span>
          )}
        </div>
      )}

      {/* Element / Padding Outer Box Line */}
      {!isPreviewMode && (isSelected || isHovered || hasMargin || element.hiddenByDefault) && (
        <div
          className="pointer-events-none"
          style={{
            position: 'absolute',
            top: -borderSides.top,
            right: -borderSides.right,
            bottom: -borderSides.bottom,
            left: -borderSides.left,
            borderRadius: effectiveRadius,
            border: isSelected
              ? isLocked
                ? '1.5px solid #64748b'
                : '2px solid #4f46e5'
              : element.hiddenByDefault
                ? '1px dashed #6366f1'
                : isHovered
                  ? '1.5px solid #818cf8'
                  : '1px solid rgba(99, 102, 241, 0.5)',
            zIndex: 44,
          }}
        />
      )}

      {/* Inner Content-Box Line when Padding > 0 */}
      {!isPreviewMode && hasPadding && (isSelected || isHovered || hasMargin) && (
        <div
          className="pointer-events-none"
          style={{
            position: 'absolute',
            top: padding.top,
            right: padding.right,
            bottom: padding.bottom,
            left: padding.left,
            border: isSelected
              ? '1px dashed #10b981'
              : '1px dashed rgba(16, 185, 129, 0.6)',
            writingMode: 'horizontal-tb',
            zIndex: 43,
          }}
        >
          {isSelected && (
            <span
              className="tabular-nums"
              style={{
                position: 'absolute',
                top: 1,
                right: 3,
                fontSize: 9,
                lineHeight: '13px',
                padding: '0 4px',
                borderRadius: 2,
                backgroundColor: '#10b981',
                color: '#ffffff',
                whiteSpace: 'nowrap',
              }}
            >
              内側余白 <span className="font-mono">padding: {formatCssBoxShorthand(padding)}</span>
            </span>
          )}
        </div>
      )}

      {/* Selected Human Role Badge */}
      {!isPreviewMode && isSelected && (() => {
        const linkedPage =
          element.linkType === 'page' && element.link
            ? pages?.find((p) => p.id === element.link || p.slug === element.link)
            : undefined;

        return (
          <div
            className="pointer-events-none flex items-center gap-1.5"
            style={{
              position: 'absolute',
              top: -(borderSides.top + (hasMargin ? margin.top : 0) + 24),
              left: -(borderSides.left + (hasMargin ? margin.left : 0)),
              backgroundColor: '#0f172a',
              color: '#f8fafc',
              fontSize: 10,
              lineHeight: '18px',
              padding: '1px 7px',
              borderRadius: 3,
              whiteSpace: 'nowrap',
              writingMode: 'horizontal-tb',
              zIndex: 65,
            }}
          >
            {isLocked && <Lock size={9} className="text-amber-400" />}
            <span className="font-medium text-slate-100">{humanSummary.kindLabel}</span>
            {element.htmlId && !/^el-\d/.test(element.htmlId) && (
              <>
                <span className="text-slate-500">·</span>
                <span className="font-mono text-indigo-300">#{selectorId}</span>
              </>
            )}
            {element.hiddenByDefault && (
              <span className="text-amber-300">· 初期非表示</span>
            )}
            {linkedPage && onNavigatePage && (
              <button
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  onNavigatePage(linkedPage.id);
                }}
                className="pointer-events-auto ml-1 px-1.5 py-0.5 rounded-xs bg-indigo-600 hover:bg-indigo-500 text-white font-medium flex items-center gap-0.5 transition-colors cursor-pointer"
                title={`クリックして「${linkedPage.name}」の編集画面へ移動`}
              >
                <span>遷移先: {linkedPage.name}</span>
                <ArrowRight size={9} />
              </button>
            )}
          </div>
        );
      })()}

      {/* Hidden Unscaled Natural Height Probe for Auto-Height & Reflow */}
      {!isPreviewMode && autoHeightEnabled && (
        <div
          ref={measureRef}
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            visibility: 'hidden',
            pointerEvents: 'none',
            zIndex: -1,
            width: `${Math.max(1, element.width)}px`,
            height: 'auto',
            minHeight: 0,
            boxSizing: isContentBox ? 'content-box' : 'border-box',
            paddingTop: `${padding.top}px`,
            paddingRight: `${padding.right}px`,
            paddingBottom: `${padding.bottom}px`,
            paddingLeft: `${padding.left}px`,
            borderStyle: borderW > 0 ? element.style.borderStyle || 'solid' : 'none',
            borderTopWidth: `${borderSides.top}px`,
            borderRightWidth: `${borderSides.right}px`,
            borderBottomWidth: `${borderSides.bottom}px`,
            borderLeftWidth: `${borderSides.left}px`,
            fontFamily: element.style.fontFamily,
            fontSize: element.style.fontSize ? `${element.style.fontSize}px` : undefined,
            fontWeight: element.style.fontWeight,
            fontStyle: element.style.fontStyle || 'normal',
            lineHeight: element.style.lineHeight ?? 1.5,
            letterSpacing: element.style.letterSpacing
              ? `${element.style.letterSpacing}px`
              : undefined,
            textTransform: element.style.textTransform || 'none',
            writingMode: element.style.writingMode || 'horizontal-tb',
            whiteSpace: 'pre-wrap',
            overflowWrap: 'break-word',
          }}
        >
          {probeText}
        </div>
      )}

      {/* Inner Content Area (1:1 CSS layout parity with exported HTML/CSS) */}
      {element.type !== 'divider' && (
        <div
          className="w-full h-full"
          style={{
            overflow:
              element.type === 'navigation' && element.navType === 'hamburger'
                ? 'visible'
                : element.style.overflow || 'visible',
            borderRadius: 'inherit',
            display:
              element.type === 'media'
                ? 'block'
                : element.type === 'navigation'
                  ? 'flex'
                  : effectiveDisplay,
            flexDirection: isFlexLayout ? element.style.flexDirection || 'row' : undefined,
            alignItems:
              element.type === 'navigation'
                ? 'center'
                : isFlexLayout
                  ? innerAlignItems
                  : undefined,
            justifyContent:
              element.type === 'navigation'
                ? element.navType === 'horizontal'
                  ? 'space-between'
                  : 'center'
                : isFlexLayout
                  ? innerJustifyContent
                  : undefined,
            gap: isFlexLayout && element.style.gap ? `${element.style.gap}px` : undefined,
            whiteSpace:
              element.type === 'text' ||
              element.type === 'button' ||
              element.type === 'rectangle' ||
              element.type === 'circle'
                ? 'pre-wrap'
                : undefined,
            overflowWrap:
              element.type === 'text' ||
              element.type === 'button' ||
              element.type === 'rectangle' ||
              element.type === 'circle'
                ? 'break-word'
                : undefined,
            textAlign: element.style.textAlign,
            writingMode: element.style.writingMode || 'horizontal-tb',
          }}
        >
          {element.type === 'media' && (!element.mediaType || element.mediaType === 'image') && (
            <div className="relative w-full h-full" style={{ borderRadius: 'inherit' }}>
              {imgError || !element.src ? (
                <div className="w-full h-full bg-slate-100 border border-slate-200 flex flex-col items-center justify-center text-slate-400 gap-1 p-2 pointer-events-none select-none">
                  <ImageOff size={22} />
                  <span className="text-[11px] text-center truncate max-w-full">
                    {element.alt || '画像未設定'}
                  </span>
                </div>
              ) : (
                <img
                  src={element.src}
                  alt={element.alt || ''}
                  draggable={false}
                  referrerPolicy="no-referrer"
                  onError={() => setImgError(true)}
                  className="w-full h-full block pointer-events-none select-none"
                  style={{
                    objectFit: element.style.objectFit || 'cover',
                    borderRadius: 'inherit',
                  }}
                />
              )}
              {!isPreviewMode && <div className="absolute inset-0 z-20" />}
            </div>
          )}

          {element.type === 'media' && element.mediaType === 'svg' && (
            <div className="relative w-full h-full" style={{ borderRadius: 'inherit' }}>
              <div
                className="w-full h-full pointer-events-none select-none [&>svg]:w-full [&>svg]:h-full [&>svg]:block"
                dangerouslySetInnerHTML={{
                  __html:
                    element.svgContent ||
                    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/></svg>',
                }}
                style={{ color: effectiveColor }}
              />
              {!isPreviewMode && <div className="absolute inset-0 z-20" />}
            </div>
          )}

          {element.type === 'media' && element.mediaType === 'video' && (() => {
            const parsedVideo = parseVideoEmbed(element.src, {
              controls: element.mediaControls !== false,
              autoplay: Boolean(isPreviewMode && element.mediaAutoplay),
              loop: Boolean(element.mediaLoop),
              muted: Boolean(element.mediaMuted || !isPreviewMode),
            });

            if (parsedVideo.kind === 'iframe') {
              return (
                <div
                  className="relative w-full h-full overflow-hidden bg-slate-950"
                  style={{ borderRadius: 'inherit' }}
                >
                  <iframe
                    src={parsedVideo.embedUrl}
                    title={element.alt || '埋め込み動画'}
                    tabIndex={isPreviewMode ? 0 : -1}
                    referrerPolicy="strict-origin-when-cross-origin"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                    className={`w-full h-full block border-0 ${
                      isPreviewMode ? 'pointer-events-auto' : 'pointer-events-none select-none'
                    }`}
                    style={{ borderRadius: 'inherit' }}
                  />
                  {!isPreviewMode && (
                    <div className="absolute inset-0 z-20 flex items-start justify-start p-2.5">
                      <span className="px-2 py-0.5 rounded bg-slate-950/75 text-[10px] font-medium text-slate-100 border border-white/15 backdrop-blur-xs pointer-events-none select-none">
                        {parsedVideo.providerLabel}
                      </span>
                    </div>
                  )}
                </div>
              );
            }

            if (parsedVideo.src) {
              return (
                <div
                  className="relative w-full h-full overflow-hidden bg-slate-950"
                  style={{ borderRadius: 'inherit' }}
                >
                  <video
                    src={parsedVideo.src}
                    poster={element.poster || undefined}
                    controls={Boolean(isPreviewMode && element.mediaControls !== false)}
                    autoPlay={Boolean(isPreviewMode && element.mediaAutoplay)}
                    loop={Boolean(element.mediaLoop)}
                    muted={Boolean(element.mediaMuted || !isPreviewMode)}
                    playsInline
                    preload="metadata"
                    draggable={false}
                    onLoadedMetadata={(ev) => {
                      const v = ev.currentTarget;
                      if (!isPreviewMode && !element.poster && v.currentTime === 0) {
                        try {
                          v.currentTime = 0.01;
                        } catch {
                          // Ignore seek errors on streaming URLs
                        }
                      }
                    }}
                    className={`w-full h-full block ${
                      isPreviewMode ? 'pointer-events-auto' : 'pointer-events-none select-none'
                    }`}
                    style={{
                      objectFit: element.style.objectFit || 'cover',
                      borderRadius: 'inherit',
                    }}
                  />
                  {!isPreviewMode && (
                    <div className="absolute inset-0 z-20 flex flex-col justify-end">
                      {element.mediaControls !== false && (
                        <div className="h-9 px-3 bg-gradient-to-t from-black/80 via-black/40 to-transparent flex items-center gap-2.5 text-[11px] text-white/90 tabular-nums pointer-events-none select-none">
                          <Play size={13} className="fill-current shrink-0" />
                          <span>0:00</span>
                          <div className="flex-1 h-1 rounded-full bg-white/30 overflow-hidden">
                            <div className="w-1/5 h-full bg-white rounded-full" />
                          </div>
                          <Volume2 size={13} className="shrink-0 opacity-85" />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            }

            return (
              <div
                className="w-full h-full bg-slate-950 text-slate-200 flex flex-col justify-between relative overflow-hidden select-none"
                style={{ borderRadius: 'inherit' }}
              >
                {element.poster && (
                  <img
                    src={element.poster}
                    alt=""
                    draggable={false}
                    className="absolute inset-0 w-full h-full object-cover opacity-55 pointer-events-none select-none"
                  />
                )}
                <div className="relative z-10 flex-1 flex flex-col items-center justify-center gap-2 px-4 text-center pointer-events-none">
                  <div className="w-11 h-11 rounded-full bg-white/15 border border-white/30 backdrop-blur-xs flex items-center justify-center text-white">
                    <Play size={18} className="ml-0.5 fill-current" />
                  </div>
                  <div className="space-y-0.5">
                    <span className="block text-xs font-semibold text-white">
                      {element.alt || '動画プレイヤー'}
                    </span>
                    <span className="block text-[11px] text-slate-300">
                      右パネルからMP4選択・YouTube URL入力
                    </span>
                  </div>
                </div>
                {element.mediaControls !== false && (
                  <div className="relative z-10 h-8 px-3 bg-gradient-to-t from-black/80 to-transparent flex items-center gap-2.5 text-[10px] text-slate-300 tabular-nums pointer-events-none">
                    <Film size={12} className="text-slate-300 shrink-0" />
                    <div className="flex-1 h-1 rounded-full bg-white/25 overflow-hidden">
                      <div className="w-1/4 h-full bg-indigo-500 rounded-full" />
                    </div>
                    <span>0:00</span>
                  </div>
                )}
                {!isPreviewMode && <div className="absolute inset-0 z-20" />}
              </div>
            );
          })()}

          {element.type === 'media' && element.mediaType === 'audio' && (
            isPreviewMode ? (
              element.src ? (
                <audio
                  src={element.src}
                  controls={element.mediaControls !== false}
                  autoPlay={Boolean(element.mediaAutoplay)}
                  loop={Boolean(element.mediaLoop)}
                  muted={Boolean(element.mediaMuted)}
                  preload="metadata"
                  className="w-full h-full block pointer-events-auto"
                />
              ) : null
            ) : element.mediaControls === false ? (
              <div
                className="relative w-full h-full px-3 bg-slate-900/95 text-slate-100 border border-slate-700 flex items-center gap-2.5 select-none overflow-hidden"
                style={{ borderRadius: 'inherit' }}
              >
                <Volume2 size={15} className="text-indigo-400 shrink-0 pointer-events-none" />
                <span className="text-xs font-medium truncate pointer-events-none">
                  {element.alt || element.imageName || 'BGM音声（操作バー非表示）'}
                </span>
                <div className="absolute inset-0 z-20" />
              </div>
            ) : (
              <div
                className="relative w-full h-full flex items-center select-none overflow-hidden"
                style={{ borderRadius: 'inherit' }}
              >
                <div className="w-full h-full max-h-[54px] px-3.5 rounded-full bg-slate-100 border border-slate-300/90 text-slate-800 flex items-center gap-3 pointer-events-none shadow-2xs">
                  <div className="w-7 h-7 rounded-full bg-white border border-slate-200/90 flex items-center justify-center text-slate-800 shrink-0">
                    <Play size={12} className="ml-0.5 fill-current" />
                  </div>
                  <span className="text-[11px] font-mono text-slate-600 tabular-nums shrink-0">
                    0:00
                  </span>
                  <div className="flex-1 min-w-[36px] flex flex-col justify-center gap-1">
                    <div className="w-full h-1.5 rounded-full bg-slate-300 overflow-hidden">
                      <div className="w-1/4 h-full bg-slate-700 rounded-full" />
                    </div>
                  </div>
                  {element.width >= 260 && (
                    <span className="text-[11px] text-slate-500 truncate max-w-[110px]">
                      {element.src ? element.alt || element.imageName || '音声' : '音声未設定'}
                    </span>
                  )}
                  <Volume2 size={14} className="text-slate-600 shrink-0" />
                </div>
                <div className="absolute inset-0 z-20" />
              </div>
            )
          )}

          {canInlineEditText && isEditingText ? (
            <textarea
              ref={editTextareaRef}
              value={draftText}
              onChange={(e) => setDraftText(e.target.value)}
              onBlur={commitInlineText}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === 'Escape') {
                  setDraftText(initialInlineContentRef.current);
                  setIsEditingText(false);
                  if (onCancelInlineEdit) {
                    onCancelInlineEdit();
                  }
                } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  commitInlineText();
                }
              }}
              onPointerDown={(e) => e.stopPropagation()}
              className="w-full h-full bg-transparent outline-none resize-none p-0 m-0 border-none"
              style={{
                color: effectiveColor,
                fontSize: 'inherit',
                fontWeight: 'inherit',
                fontStyle: 'inherit',
                fontFamily: 'inherit',
                lineHeight: 'inherit',
                letterSpacing: 'inherit',
                textAlign: element.style.textAlign || 'left',
              }}
            />
          ) : (
            (element.type === 'text' ||
              element.type === 'rectangle' ||
              element.type === 'circle' ||
              element.type === 'button') &&
            element.content
          )}

          {element.type === 'navigation' && element.navType === 'horizontal' && renderMenubarContent()}

          {element.type === 'navigation' && element.navType === 'hamburger' && (
            <div
              className="w-full h-full flex items-center justify-center relative rounded"
              style={{ backgroundColor: effectiveBg }}
              onClick={(e) => {
                if (isSpacePressed) return;
                e.stopPropagation();
                setIsMenuOpen(!isMenuOpen);
              }}
            >
              <AlignJustify
                size={Math.max(16, Math.min(element.width, element.height) * 0.55)}
                color={effectiveColor || '#1e293b'}
              />

              {isMenuOpen && (
                <div
                  className="absolute top-full right-0 bg-white shadow-xl p-2 rounded-lg w-48 z-[100] border border-slate-200 mt-1.5 pointer-events-auto"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex justify-between items-center mb-1 border-b border-slate-100 pb-1 px-1">
                    <span className="text-slate-400 text-[10px] font-semibold">ナビメニュー</span>
                    <button
                      onClick={() => setIsMenuOpen(false)}
                      className="text-slate-400 hover:text-slate-600 p-0.5"
                    >
                      <Plus size={12} className="rotate-45" />
                    </button>
                  </div>
                  {element.menuItems?.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => {
                        if (isPreviewMode && onNavigatePage) {
                          const pageId = item.link.startsWith('#') ? item.link.slice(1) : item.link;
                          onNavigatePage(pageId);
                          setIsMenuOpen(false);
                        }
                      }}
                      className="py-2 px-2.5 hover:bg-slate-50 rounded text-xs text-slate-700 cursor-pointer transition-colors"
                    >
                      {item.label}
                    </div>
                  ))}
                  {(!element.menuItems || element.menuItems.length === 0) && (
                    <p className="text-slate-400 text-xs py-2 text-center">項目なし</p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Resize Handles (Hidden when locked) */}
      {!isPreviewMode && isSelected && !isLocked && !isSpacePressed && !isEditingText && (
        <>
          <div
            style={handleStyle('nw')}
            onPointerDown={(e) => handleResizeStart(e, 'nw')}
            onPointerMove={handleResizeMove}
            onPointerUp={handleResizeUp}
            onPointerCancel={handleResizeUp}
            onLostPointerCapture={handleResizeUp}
          />
          <div
            style={handleStyle('ne')}
            onPointerDown={(e) => handleResizeStart(e, 'ne')}
            onPointerMove={handleResizeMove}
            onPointerUp={handleResizeUp}
            onPointerCancel={handleResizeUp}
            onLostPointerCapture={handleResizeUp}
          />
          <div
            style={handleStyle('sw')}
            onPointerDown={(e) => handleResizeStart(e, 'sw')}
            onPointerMove={handleResizeMove}
            onPointerUp={handleResizeUp}
            onPointerCancel={handleResizeUp}
            onLostPointerCapture={handleResizeUp}
          />
          <div
            style={handleStyle('se')}
            onPointerDown={(e) => handleResizeStart(e, 'se')}
            onPointerMove={handleResizeMove}
            onPointerUp={handleResizeUp}
            onPointerCancel={handleResizeUp}
            onLostPointerCapture={handleResizeUp}
          />
        </>
      )}
    </div>
  );
};

export default CanvasElement;