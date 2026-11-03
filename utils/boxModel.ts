import { EditorElement, ElementStyle, HtmlTagName, Page } from '../types';
import { isIframeVideoSource, parseVideoEmbed } from './mediaUtils';

export interface BoxSides {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface Rect {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
}

export interface ElementBoxGeometry {
  borderBox: Rect;
  marginBox: Rect;
  contentBox: Rect;
  padding: BoxSides;
  margin: BoxSides;
  border: BoxSides;
  borderWidth: number;
  boxWidth: number;
  boxHeight: number;
}

export function getPaddingSides(style: ElementStyle): BoxSides {
  const base = style.padding ?? 0;
  return {
    top: Math.max(0, style.paddingTop ?? base),
    right: Math.max(0, style.paddingRight ?? base),
    bottom: Math.max(0, style.paddingBottom ?? base),
    left: Math.max(0, style.paddingLeft ?? base),
  };
}

export function getMarginSides(style: ElementStyle): BoxSides {
  const base = style.margin ?? 0;
  return {
    top: Math.max(0, style.marginTop ?? base),
    right: Math.max(0, style.marginRight ?? base),
    bottom: Math.max(0, style.marginBottom ?? base),
    left: Math.max(0, style.marginLeft ?? base),
  };
}

export function getEffectiveBorderWidth(style: ElementStyle): number {
  if (!style.borderWidth || style.borderStyle === 'none') return 0;
  return Math.max(0, style.borderWidth);
}

export function getBorderSides(style: ElementStyle): BoxSides {
  const w = getEffectiveBorderWidth(style);
  if (w === 0) return { top: 0, right: 0, bottom: 0, left: 0 };
  const mode = style.borderSides || 'all';
  return {
    top: mode === 'all' || mode === 'top' || mode === 'y' ? w : 0,
    right: mode === 'all' || mode === 'right' ? w : 0,
    bottom: mode === 'all' || mode === 'bottom' || mode === 'y' ? w : 0,
    left: mode === 'all' || mode === 'left' ? w : 0,
  };
}

export function hasAnyMargin(style: ElementStyle): boolean {
  const m = getMarginSides(style);
  return m.top > 0 || m.right > 0 || m.bottom > 0 || m.left > 0;
}

export function hasAnyPadding(style: ElementStyle): boolean {
  const p = getPaddingSides(style);
  return p.top > 0 || p.right > 0 || p.bottom > 0 || p.left > 0;
}

export function isUniformSides(sides: BoxSides): boolean {
  return sides.top === sides.right && sides.right === sides.bottom && sides.bottom === sides.left;
}

export function formatCssBoxShorthand(sides: BoxSides): string {
  const { top, right, bottom, left } = sides;
  if (top === right && right === bottom && bottom === left) {
    return `${top}px`;
  }
  if (top === bottom && left === right) {
    return `${top}px ${right}px`;
  }
  if (left === right) {
    return `${top}px ${right}px ${bottom}px`;
  }
  return `${top}px ${right}px ${bottom}px ${left}px`;
}

export function buildCssFilterString(style: ElementStyle): string {
  const filters: string[] = [];
  if (style.filterBrightness !== undefined && style.filterBrightness !== 100) {
    filters.push(`brightness(${style.filterBrightness}%)`);
  }
  if (style.filterContrast !== undefined && style.filterContrast !== 100) {
    filters.push(`contrast(${style.filterContrast}%)`);
  }
  if (style.filterGrayscale !== undefined && style.filterGrayscale > 0) {
    filters.push(`grayscale(${style.filterGrayscale}%)`);
  }
  return filters.join(' ');
}

export function getDefaultTagForElement(
  el: Pick<EditorElement, 'type' | 'link' | 'mediaType' | 'src'>
): HtmlTagName {
  switch (el.type) {
    case 'text':
      return 'p';
    case 'button':
      return el.link ? 'a' : 'button';
    case 'media':
      if (el.mediaType === 'svg') return 'div';
      if (el.mediaType === 'video') return isIframeVideoSource(el.src) ? 'iframe' : 'video';
      if (el.mediaType === 'audio') return 'audio';
      return 'img';
    case 'navigation':
      return 'nav';
    case 'divider':
      return 'hr';
    case 'circle':
      return 'div';
    case 'rectangle':
    default:
      return 'div';
  }
}

export function getEffectiveTag(el: EditorElement): HtmlTagName {
  if (el.type === 'navigation') return el.tagName === 'header' ? 'header' : 'nav';
  if (el.type === 'media') {
    if (el.mediaType === 'svg') return 'div';
    if (el.mediaType === 'video') return isIframeVideoSource(el.src) ? 'iframe' : 'video';
    if (el.mediaType === 'audio') return 'audio';
    return 'img';
  }
  if (el.type === 'divider') return 'hr';
  if (el.type === 'button' && el.link) return 'a';
  return el.tagName || getDefaultTagForElement(el);
}

export interface ElementHumanSummary {
  kindLabel: string;
  previewText: string;
}

export function getElementHumanSummary(el: EditorElement): ElementHumanSummary {
  const tag = getEffectiveTag(el);
  const rawContent = (el.content || '').replace(/\s+/g, ' ').trim();
  const shortContent = rawContent.length > 16 ? `${rawContent.slice(0, 16)}…` : rawContent;

  switch (el.type) {
    case 'text': {
      const kindLabel =
        tag === 'h1'
          ? '大見出し'
          : tag === 'h2'
            ? '中見出し'
            : tag === 'h3' || tag === 'h4'
              ? '小見出し'
              : tag === 'blockquote'
                ? '引用文'
                : tag === 'span'
                  ? 'ラベル文字'
                  : '文章';
      return {
        kindLabel,
        previewText: shortContent ? `「${shortContent}」` : '（未入力）',
      };
    }
    case 'button': {
      return {
        kindLabel: tag === 'a' ? 'リンクボタン' : 'ボタン',
        previewText: shortContent ? `「${shortContent}」` : '',
      };
    }
    case 'media': {
      const altText = (el.alt || el.imageName || '').trim();
      const shortAlt = altText.length > 14 ? `${altText.slice(0, 14)}…` : altText;
      if (el.mediaType === 'video') {
        const parsed = parseVideoEmbed(el.src);
        const videoPreview = shortAlt
          ? `「${shortAlt}」`
          : parsed.kind === 'iframe'
            ? `(${parsed.providerLabel})`
            : '';
        return {
          kindLabel: parsed.kind === 'iframe' ? '埋め込み動画' : '動画',
          previewText: videoPreview,
        };
      }
      if (el.mediaType === 'audio') {
        return {
          kindLabel: '音声プレイヤー',
          previewText: shortAlt ? `「${shortAlt}」` : '',
        };
      }
      return {
        kindLabel: el.mediaType === 'svg' ? '図形・SVG' : '画像',
        previewText: shortAlt ? `「${shortAlt}」` : '',
      };
    }
    case 'navigation': {
      const labels = (el.menuItems || [])
        .map((m) => m.label.trim())
        .filter(Boolean)
        .slice(0, 2)
        .join(' / ');
      return {
        kindLabel: el.navType === 'hamburger' ? '開閉メニュー' : 'メニューバー',
        previewText: labels ? `(${labels})` : '',
      };
    }
    case 'divider':
      return { kindLabel: '区切り線', previewText: '' };
    case 'circle':
      return {
        kindLabel: '丸・バッジ',
        previewText: shortContent ? `「${shortContent}」` : '',
      };
    case 'rectangle':
    default: {
      const kindLabel =
        tag === 'header'
          ? 'ヘッダー枠'
          : tag === 'footer'
            ? 'フッター枠'
            : tag === 'aside'
              ? '開閉・補足枠'
              : tag === 'section'
                ? 'セクション枠'
                : tag === 'article'
                  ? 'カード枠'
                  : rawContent
                    ? 'テキスト枠'
                    : 'ボックス枠';
      return {
        kindLabel,
        previewText: shortContent ? `「${shortContent}」` : '',
      };
    }
  }
}

export function sanitizeHtmlId(raw: string | undefined, fallbackId: string): string {
  const cleaned = (raw || '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-zA-Z0-9_-]/g, '');
  if (!cleaned) {
    const safeFallback = fallbackId.replace(/[^a-zA-Z0-9_-]/g, '');
    return /^[a-zA-Z]/.test(safeFallback) ? safeFallback : `el-${safeFallback || 'item'}`;
  }
  return /^[a-zA-Z]/.test(cleaned) ? cleaned : `el-${cleaned}`;
}

export function sanitizeClassNames(raw: string | undefined): string {
  if (!raw) return '';
  return raw
    .split(/\s+/)
    .map((token) => token.replace(/[^a-zA-Z0-9_-]/g, ''))
    .filter((token) => token.length > 0 && !/^[0-9]/.test(token))
    .join(' ');
}

export function getPageFilename(page: Page, allPages: Page[]): string {
  if (allPages.length > 0 && page.id === allPages[0].id) {
    return 'index.html';
  }
  const base = (page.slug || page.id || 'page')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9_-]/g, '');
  return `${base || page.id}.html`;
}

function makeRect(left: number, top: number, width: number, height: number): Rect {
  const w = Math.max(0, width);
  const h = Math.max(0, height);
  return {
    left,
    top,
    right: left + w,
    bottom: top + h,
    width: w,
    height: h,
    centerX: left + w / 2,
    centerY: top + h / 2,
  };
}

export function getElementBoxes(
  element: EditorElement,
  canvasWidth: number,
  canvasHeight: number,
  overrides?: Partial<Pick<EditorElement, 'x' | 'y' | 'width' | 'height'>>
): ElementBoxGeometry {
  const x = overrides?.x ?? element.x;
  const y = overrides?.y ?? element.y;
  const rawW = overrides?.width ?? element.width;
  const rawH = overrides?.height ?? element.height;

  const padding = getPaddingSides(element.style);
  const margin = getMarginSides(element.style);
  const border = getBorderSides(element.style);
  const borderWidth = getEffectiveBorderWidth(element.style);
  const isContentBox = element.style.boxSizing === 'content-box';

  const boxWidth = isContentBox
    ? rawW + padding.left + padding.right + border.left + border.right
    : rawW;
  const boxHeight = isContentBox
    ? rawH + padding.top + padding.bottom + border.top + border.bottom
    : rawH;

  let borderLeft = 0;
  if (element.anchorX === 'left') {
    borderLeft = x + margin.left;
  } else if (element.anchorX === 'right') {
    borderLeft = canvasWidth - x - margin.right - boxWidth;
  } else {
    borderLeft = canvasWidth / 2 + x + margin.left - boxWidth / 2;
  }

  let borderTop = 0;
  if (element.anchorY === 'top') {
    borderTop = y + margin.top;
  } else if (element.anchorY === 'bottom') {
    borderTop = canvasHeight - y - margin.bottom - boxHeight;
  } else {
    borderTop = canvasHeight / 2 + y + margin.top - boxHeight / 2;
  }

  const borderBox = makeRect(borderLeft, borderTop, boxWidth, boxHeight);
  const marginBox = makeRect(
    borderLeft - margin.left,
    borderTop - margin.top,
    boxWidth + margin.left + margin.right,
    boxHeight + margin.top + margin.bottom
  );
  const contentBox = makeRect(
    borderLeft + border.left + padding.left,
    borderTop + border.top + padding.top,
    Math.max(0, boxWidth - (border.left + padding.left) - (border.right + padding.right)),
    Math.max(0, boxHeight - (border.top + padding.top) - (border.bottom + padding.bottom))
  );

  return {
    borderBox,
    marginBox,
    contentBox,
    padding,
    margin,
    border,
    borderWidth,
    boxWidth,
    boxHeight,
  };
}

export function boxesOverlap(a: Rect, b: Rect, eps: number = 0.5): boolean {
  return (
    a.left < b.right - eps &&
    a.right > b.left + eps &&
    a.top < b.bottom - eps &&
    a.bottom > b.top + eps
  );
}

export function shouldPreventOverlap(a: EditorElement, b: EditorElement): boolean {
  return hasAnyMargin(a.style) || hasAnyMargin(b.style);
}

function shiftBorderLeftToX(element: EditorElement, deltaLeft: number): number {
  if (element.anchorX === 'right') {
    return element.x - deltaLeft;
  }
  return element.x + deltaLeft;
}

function shiftBorderTopToY(element: EditorElement, deltaTop: number): number {
  if (element.anchorY === 'bottom') {
    return element.y - deltaTop;
  }
  return element.y + deltaTop;
}

export function resolveDragCollision(
  primaryEl: EditorElement,
  proposedX: number,
  proposedY: number,
  allElements: EditorElement[],
  selectedIds: string[],
  canvasWidth: number,
  canvasHeight: number
): { x: number; y: number; collidingIds: string[] } {
  const prevBoxes = getElementBoxes(primaryEl, canvasWidth, canvasHeight);
  let nextBoxes = getElementBoxes(primaryEl, canvasWidth, canvasHeight, {
    x: proposedX,
    y: proposedY,
  });

  let deltaLeft = nextBoxes.marginBox.left - prevBoxes.marginBox.left;
  let deltaTop = nextBoxes.marginBox.top - prevBoxes.marginBox.top;

  const collidingSet = new Set<string>();
  const obstacles = allElements.filter(
    (other) => !selectedIds.includes(other.id) && shouldPreventOverlap(primaryEl, other)
  );

  if (obstacles.length === 0) {
    return { x: Math.round(proposedX), y: Math.round(proposedY), collidingIds: [] };
  }

  const EPS = 0.5;

  for (const obs of obstacles) {
    const obsMargin = getElementBoxes(obs, canvasWidth, canvasHeight).marginBox;
    const candidateMargin = makeRect(
      prevBoxes.marginBox.left + deltaLeft,
      prevBoxes.marginBox.top + deltaTop,
      prevBoxes.marginBox.width,
      prevBoxes.marginBox.height
    );

    if (!boxesOverlap(candidateMargin, obsMargin, EPS)) continue;

    collidingSet.add(obs.id);
    collidingSet.add(primaryEl.id);

    const cameFromLeft = prevBoxes.marginBox.right <= obsMargin.left + EPS;
    const cameFromRight = prevBoxes.marginBox.left >= obsMargin.right - EPS;
    const cameFromTop = prevBoxes.marginBox.bottom <= obsMargin.top + EPS;
    const cameFromBottom = prevBoxes.marginBox.top >= obsMargin.bottom - EPS;

    if (cameFromLeft && cameFromTop) {
      const fixX = obsMargin.left - candidateMargin.right;
      const fixY = obsMargin.top - candidateMargin.bottom;
      if (Math.abs(fixX) <= Math.abs(fixY)) deltaLeft += fixX;
      else deltaTop += fixY;
    } else if (cameFromLeft && cameFromBottom) {
      const fixX = obsMargin.left - candidateMargin.right;
      const fixY = obsMargin.bottom - candidateMargin.top;
      if (Math.abs(fixX) <= Math.abs(fixY)) deltaLeft += fixX;
      else deltaTop += fixY;
    } else if (cameFromRight && cameFromTop) {
      const fixX = obsMargin.right - candidateMargin.left;
      const fixY = obsMargin.top - candidateMargin.bottom;
      if (Math.abs(fixX) <= Math.abs(fixY)) deltaLeft += fixX;
      else deltaTop += fixY;
    } else if (cameFromRight && cameFromBottom) {
      const fixX = obsMargin.right - candidateMargin.left;
      const fixY = obsMargin.bottom - candidateMargin.top;
      if (Math.abs(fixX) <= Math.abs(fixY)) deltaLeft += fixX;
      else deltaTop += fixY;
    } else if (cameFromLeft) {
      deltaLeft += obsMargin.left - candidateMargin.right;
    } else if (cameFromRight) {
      deltaLeft += obsMargin.right - candidateMargin.left;
    } else if (cameFromTop) {
      deltaTop += obsMargin.top - candidateMargin.bottom;
    } else if (cameFromBottom) {
      deltaTop += obsMargin.bottom - candidateMargin.top;
    } else {
      const pushLeft = obsMargin.left - candidateMargin.right;
      const pushRight = obsMargin.right - candidateMargin.left;
      const pushUp = obsMargin.top - candidateMargin.bottom;
      const pushDown = obsMargin.bottom - candidateMargin.top;
      const best = [
        { axis: 'x', val: pushLeft },
        { axis: 'x', val: pushRight },
        { axis: 'y', val: pushUp },
        { axis: 'y', val: pushDown },
      ].sort((a, b) => Math.abs(a.val) - Math.abs(b.val))[0];

      if (best.axis === 'x') deltaLeft += best.val;
      else deltaTop += best.val;
    }
  }

  const resolvedMargin = makeRect(
    prevBoxes.marginBox.left + deltaLeft,
    prevBoxes.marginBox.top + deltaTop,
    prevBoxes.marginBox.width,
    prevBoxes.marginBox.height
  );

  const stillOverlaps = obstacles.some((obs) =>
    boxesOverlap(resolvedMargin, getElementBoxes(obs, canvasWidth, canvasHeight).marginBox, EPS)
  );

  if (stillOverlaps) {
    const xOnlyMargin = makeRect(
      prevBoxes.marginBox.left + deltaLeft,
      prevBoxes.marginBox.top,
      prevBoxes.marginBox.width,
      prevBoxes.marginBox.height
    );
    const yOnlyMargin = makeRect(
      prevBoxes.marginBox.left,
      prevBoxes.marginBox.top + deltaTop,
      prevBoxes.marginBox.width,
      prevBoxes.marginBox.height
    );

    if (
      !obstacles.some((o) =>
        boxesOverlap(xOnlyMargin, getElementBoxes(o, canvasWidth, canvasHeight).marginBox, EPS)
      )
    ) {
      deltaTop = 0;
    } else if (
      !obstacles.some((o) =>
        boxesOverlap(yOnlyMargin, getElementBoxes(o, canvasWidth, canvasHeight).marginBox, EPS)
      )
    ) {
      deltaLeft = 0;
    } else {
      deltaLeft = 0;
      deltaTop = 0;
    }
  }

  nextBoxes = getElementBoxes(primaryEl, canvasWidth, canvasHeight, {
    x: shiftBorderLeftToX(primaryEl, deltaLeft),
    y: shiftBorderTopToY(primaryEl, deltaTop),
  });

  const resolvedX = Math.round(
    shiftBorderLeftToX(primaryEl, nextBoxes.marginBox.left - prevBoxes.marginBox.left)
  );
  const resolvedY = Math.round(
    shiftBorderTopToY(primaryEl, nextBoxes.marginBox.top - prevBoxes.marginBox.top)
  );

  return {
    x: resolvedX,
    y: resolvedY,
    collidingIds: Array.from(collidingSet),
  };
}

export function findMarginCollisions(
  targetEl: EditorElement,
  allElements: EditorElement[],
  canvasWidth: number,
  canvasHeight: number
): string[] {
  const targetMargin = getElementBoxes(targetEl, canvasWidth, canvasHeight).marginBox;
  const colliding: string[] = [];

  for (const other of allElements) {
    if (other.id === targetEl.id) continue;
    if (!shouldPreventOverlap(targetEl, other)) continue;
    const otherMargin = getElementBoxes(other, canvasWidth, canvasHeight).marginBox;
    if (boxesOverlap(targetMargin, otherMargin, 0.5)) {
      colliding.push(other.id);
    }
  }

  return colliding;
}

export function findNonOverlappingPosition(
  newEl: EditorElement,
  existingElements: EditorElement[],
  canvasWidth: number,
  canvasHeight: number
): { x: number; y: number } {
  if (findMarginCollisions(newEl, existingElements, canvasWidth, canvasHeight).length === 0) {
    return { x: newEl.x, y: newEl.y };
  }

  const step = 24;
  for (let radius = 1; radius <= 25; radius++) {
    const candidates = [
      { dx: 0, dy: radius * step },
      { dx: radius * step, dy: 0 },
      { dx: radius * step, dy: radius * step },
      { dx: 0, dy: -radius * step },
      { dx: -radius * step, dy: 0 },
    ];
    for (const c of candidates) {
      const candidate: EditorElement = { ...newEl, x: newEl.x + c.dx, y: newEl.y + c.dy };
      const boxes = getElementBoxes(candidate, canvasWidth, canvasHeight);
      if (
        boxes.borderBox.left >= 0 &&
        boxes.borderBox.top >= 0 &&
        boxes.borderBox.right <= canvasWidth &&
        boxes.borderBox.bottom <= canvasHeight &&
        findMarginCollisions(candidate, existingElements, canvasWidth, canvasHeight).length === 0
      ) {
        return { x: candidate.x, y: candidate.y };
      }
    }
  }

  return { x: newEl.x, y: newEl.y };
}

/**
 * Determines whether an element automatically expands/contracts its height
 * to fit its text content (enabled by default for horizontal text and text-bearing boxes).
 */
export function isAutoHeightElement(el: EditorElement): boolean {
  if (
    el.type === 'divider' ||
    el.type === 'media' ||
    el.type === 'navigation' ||
    el.type === 'circle'
  ) {
    return false;
  }
  if (el.style.writingMode === 'vertical-rl') {
    return false;
  }
  if (el.type === 'text') {
    return el.autoHeight !== false;
  }
  if (el.type === 'rectangle') {
    const hasText = Boolean((el.content || '').trim());
    return hasText ? el.autoHeight !== false : Boolean(el.autoHeight);
  }
  if (el.type === 'button') {
    return Boolean(el.autoHeight);
  }
  return false;
}

function rangesOverlapX(l1: number, r1: number, l2: number, r2: number, minOverlap = 4): boolean {
  return Math.min(r1, r2) - Math.max(l1, l2) > minOverlap;
}

function horizontalGap(l1: number, r1: number, l2: number, r2: number): number {
  if (r1 < l2) return l2 - r1;
  if (r2 < l1) return l1 - r2;
  return 0;
}

/**
 * Updates `changedId` to `newHeight` (anchoring its top edge) and automatically shifts
 * overlapping downstream elements and enclosing cards so growing/shrinking text never
 * collides with dividers, subsequent items, or footers.
 */
export function applyVerticalReflow(
  elements: EditorElement[],
  pageHeight: number,
  changedId: string,
  newHeight: number,
  canvasWidth: number,
  enablePageReflow: boolean = true
): { elements: EditorElement[]; pageHeight: number } {
  const sourceEl = elements.find((el) => el.id === changedId);
  if (!sourceEl) return { elements, pageHeight };

  const clampedHeight = Math.max(1, Math.round(newHeight));
  if (clampedHeight === sourceEl.height) {
    return { elements, pageHeight };
  }

  const oldBoxesMap = new Map<string, ElementBoxGeometry>();
  for (const el of elements) {
    oldBoxesMap.set(el.id, getElementBoxes(el, canvasWidth, pageHeight));
  }

  const sourceOldBox = oldBoxesMap.get(sourceEl.id)!;
  const sourceTempBox = getElementBoxes(sourceEl, canvasWidth, pageHeight, {
    height: clampedHeight,
  });
  const deltaBoxH = sourceTempBox.boxHeight - sourceOldBox.boxHeight;

  // Keep top edge stationary regardless of anchorY
  let nextSourceY = sourceEl.y;
  if (sourceEl.anchorY === 'bottom') {
    nextSourceY = Math.round(sourceEl.y - deltaBoxH);
  } else if (sourceEl.anchorY === 'center') {
    nextSourceY = Math.round(sourceEl.y + deltaBoxH / 2);
  }

  if (!enablePageReflow || deltaBoxH === 0 || sourceEl.style.position === 'fixed') {
    const updatedSimple = elements.map((el) =>
      el.id === changedId ? { ...el, height: clampedHeight, y: nextSourceY } : el
    );
    return { elements: updatedSimple, pageHeight };
  }

  interface ShiftZone {
    left: number;
    right: number;
    triggerBottom: number;
    shiftY: number;
  }

  const shiftZones: ShiftZone[] = [
    {
      left: sourceOldBox.marginBox.left,
      right: sourceOldBox.marginBox.right,
      triggerBottom: sourceOldBox.marginBox.bottom,
      shiftY: deltaBoxH,
    },
  ];

  const heightUpdates = new Map<string, number>([[changedId, clampedHeight]]);
  const yShifts = new Map<string, number>();

  // 1. Expand/contract enclosing container cards or backdrops if they wrap sourceEl
  for (const el of elements) {
    if (el.id === changedId || el.style.position === 'fixed') continue;
    if (el.type !== 'rectangle' && el.type !== 'media') continue;

    const box = oldBoxesMap.get(el.id)!;
    const enclosesSource =
      box.borderBox.left <= sourceOldBox.borderBox.left + 4 &&
      box.borderBox.right >= sourceOldBox.borderBox.right - 4 &&
      box.borderBox.top <= sourceOldBox.borderBox.top + 4 &&
      box.borderBox.bottom >= sourceOldBox.borderBox.bottom - 4;

    if (!enclosesSource) continue;

    const isLargeBackdrop = el.locked || el.type === 'media' || box.boxHeight >= 600;
    if (!isLargeBackdrop) {
      const nextCardH = Math.max(36, el.height + deltaBoxH);
      const cardDelta = nextCardH - el.height;
      if (cardDelta !== 0) {
        heightUpdates.set(el.id, nextCardH);
        shiftZones.push({
          left: box.marginBox.left,
          right: box.marginBox.right,
          triggerBottom: box.marginBox.bottom,
          shiftY: cardDelta,
        });
      }
    } else if (deltaBoxH > 0) {
      const newSourceBottom = sourceOldBox.borderBox.bottom + deltaBoxH;
      if (newSourceBottom + 24 > box.borderBox.bottom) {
        const neededExtra = Math.round(newSourceBottom + 24 - box.borderBox.bottom);
        heightUpdates.set(el.id, el.height + neededExtra);
        shiftZones.push({
          left: box.marginBox.left,
          right: box.marginBox.right,
          triggerBottom: box.marginBox.bottom,
          shiftY: neededExtra,
        });
      }
    }
  }

  // 2. Sort remaining movable elements from top to bottom and propagate vertical shifts
  const movableCandidates = elements
    .filter(
      (el) =>
        el.id !== changedId &&
        !heightUpdates.has(el.id) &&
        el.style.position !== 'fixed'
    )
    .sort(
      (a, b) =>
        oldBoxesMap.get(a.id)!.borderBox.top - oldBoxesMap.get(b.id)!.borderBox.top ||
        oldBoxesMap.get(a.id)!.borderBox.left - oldBoxesMap.get(b.id)!.borderBox.left
    );

  // Compute new bottom of any element given current heightUpdates & yShifts
  const getUpdatedMarginBottom = (el: EditorElement): number => {
    const orig = oldBoxesMap.get(el.id)!;
    const hOverride = heightUpdates.get(el.id);
    const yShift = yShifts.get(el.id) ?? 0;
    const hDelta = hOverride !== undefined ? hOverride - el.height : 0;
    return orig.marginBox.bottom + hDelta + yShift;
  };

  for (let i = 0; i < movableCandidates.length; i++) {
    const el = movableCandidates[i];
    const elBox = oldBoxesMap.get(el.id)!;

    let proposedShift = 0;
    let matched = false;

    for (const zone of shiftZones) {
      if (
        elBox.marginBox.top >= zone.triggerBottom - 4 &&
        rangesOverlapX(elBox.marginBox.left, elBox.marginBox.right, zone.left, zone.right, 4)
      ) {
        if (!matched || Math.abs(zone.shiftY) > Math.abs(proposedShift)) {
          proposedShift = zone.shiftY;
          matched = true;
        }
      }
    }

    // Check same-row coupling (e.g., item title on left + item price on right of same column row)
    if (!matched && elBox.borderBox.top >= sourceOldBox.borderBox.bottom - 4 && elBox.boxHeight <= 84) {
      for (const [shiftedId, shiftedVal] of yShifts.entries()) {
        if (shiftedVal === 0) continue;
        const peerBox = oldBoxesMap.get(shiftedId)!;
        if (
          peerBox.boxHeight <= 84 &&
          Math.abs(elBox.borderBox.top - peerBox.borderBox.top) <= 24 &&
          horizontalGap(
            elBox.borderBox.left,
            elBox.borderBox.right,
            peerBox.borderBox.left,
            peerBox.borderBox.right
          ) <= 160
        ) {
          proposedShift = shiftedVal;
          matched = true;
          break;
        }
      }
    }

    if (!matched || proposedShift === 0) continue;

    let actualShift = proposedShift;

    // When pulling upward (actualShift < 0), never collide with unshifted side-column elements above
    if (actualShift < 0) {
      for (const other of elements) {
        if (other.id === el.id || other.style.position === 'fixed') continue;
        const otherOld = oldBoxesMap.get(other.id)!;
        if (otherOld.marginBox.bottom > elBox.marginBox.top + 2) continue;
        if (
          !rangesOverlapX(
            elBox.marginBox.left,
            elBox.marginBox.right,
            otherOld.marginBox.left,
            otherOld.marginBox.right,
            4
          )
        ) {
          continue;
        }
        const origGap = Math.max(0, elBox.marginBox.top - otherOld.marginBox.bottom);
        const minClearance = Math.min(24, origGap);
        const otherNewBottom = getUpdatedMarginBottom(other);
        const minAllowedTop = otherNewBottom + minClearance;
        const minAllowedShift = minAllowedTop - elBox.marginBox.top;
        if (actualShift < minAllowedShift) {
          actualShift = minAllowedShift;
        }
      }
      if (elBox.marginBox.top + actualShift < 0) {
        actualShift = -elBox.marginBox.top;
      }
    }

    actualShift = Math.round(actualShift);
    if (actualShift !== 0) {
      yShifts.set(el.id, actualShift);
      shiftZones.push({
        left: elBox.marginBox.left,
        right: elBox.marginBox.right,
        triggerBottom: elBox.marginBox.bottom,
        shiftY: actualShift,
      });

      // Retroactively sync any already-visited peer on the exact same row (if price was to the left of title)
      if (elBox.boxHeight <= 84) {
        for (let j = 0; j < i; j++) {
          const prevPeer = movableCandidates[j];
          if (yShifts.has(prevPeer.id)) continue;
          const prevBox = oldBoxesMap.get(prevPeer.id)!;
          if (
            prevBox.borderBox.top >= sourceOldBox.borderBox.bottom - 4 &&
            prevBox.boxHeight <= 84 &&
            Math.abs(prevBox.borderBox.top - elBox.borderBox.top) <= 24 &&
            horizontalGap(
              prevBox.borderBox.left,
              prevBox.borderBox.right,
              elBox.borderBox.left,
              elBox.borderBox.right
            ) <= 160
          ) {
            yShifts.set(prevPeer.id, actualShift);
            shiftZones.push({
              left: prevBox.marginBox.left,
              right: prevBox.marginBox.right,
              triggerBottom: prevBox.marginBox.bottom,
              shiftY: actualShift,
            });
          }
        }
      }
    }
  }

  let nextPageHeight = pageHeight;
  let maxBottomAfter = 0;
  let maxOldBottom = 0;

  for (const el of elements) {
    if (el.style.position === 'fixed') continue;
    const orig = oldBoxesMap.get(el.id)!;
    maxOldBottom = Math.max(maxOldBottom, orig.marginBox.bottom);
    maxBottomAfter = Math.max(maxBottomAfter, getUpdatedMarginBottom(el));
  }

  const origBottomPad = Math.max(48, pageHeight - maxOldBottom);
  if (deltaBoxH > 0 && maxBottomAfter + 48 > pageHeight) {
    nextPageHeight = Math.ceil((maxBottomAfter + Math.min(80, origBottomPad)) / 10) * 10;
  } else if (deltaBoxH < 0 && yShifts.size > 0) {
    const shrunkTarget = Math.ceil((maxBottomAfter + Math.min(80, origBottomPad)) / 10) * 10;
    nextPageHeight = Math.max(400, Math.min(pageHeight, shrunkTarget));
  }

  const nextElements = elements.map((el) => {
    if (el.id === changedId) {
      let adjustedY = nextSourceY;
      if (el.anchorY === 'bottom' && nextPageHeight !== pageHeight) {
        adjustedY += nextPageHeight - pageHeight;
      } else if (el.anchorY === 'center' && nextPageHeight !== pageHeight) {
        adjustedY -= Math.round((nextPageHeight - pageHeight) / 2);
      }
      return { ...el, height: clampedHeight, y: adjustedY };
    }

    const nextH = heightUpdates.get(el.id);
    const shift = yShifts.get(el.id) ?? 0;

    if (nextH === undefined && shift === 0 && nextPageHeight === pageHeight) {
      return el;
    }

    const updatedH = nextH ?? el.height;
    const hDelta = updatedH - el.height;
    let updatedY = el.y;

    if (el.anchorY === 'top') {
      updatedY = Math.round(el.y + shift);
    } else if (el.anchorY === 'bottom') {
      updatedY = Math.round(el.y - shift - hDelta + (nextPageHeight - pageHeight));
    } else {
      updatedY = Math.round(el.y + shift + hDelta / 2 - (nextPageHeight - pageHeight) / 2);
    }

    return {
      ...el,
      height: updatedH,
      y: updatedY,
    };
  });

  return {
    elements: nextElements,
    pageHeight: nextPageHeight,
  };
}

export interface MobileFlowItemMeta {
  id: string;
  order: number;
  marginTopPx: number;
  isFixedNav: boolean;
  isTopFlowNav: boolean;
  isHiddenDecorativeOverlay: boolean;
  isFullBleedMedia: boolean;
}

/**
 * Analyzes 2D canvas geometry using XY-cut section & column decomposition
 * to produce natural mobile document-flow ordering and vertical spacing for <= 767px screens.
 */
export function computeMobileFlowLayout(
  elements: EditorElement[],
  canvasWidth: number,
  canvasHeight: number
): Map<string, MobileFlowItemMeta> {
  const result = new Map<string, MobileFlowItemMeta>();
  const boxesMap = new Map<string, ElementBoxGeometry>();

  for (const el of elements) {
    boxesMap.set(el.id, getElementBoxes(el, canvasWidth, canvasHeight));
  }

  const fixedNavs: EditorElement[] = [];
  const topFlowNavs: EditorElement[] = [];
  const hiddenOverlays: EditorElement[] = [];
  const flowCandidates: EditorElement[] = [];

  const mediaElements = elements.filter((el) => el.type === 'media');

  for (const el of elements) {
    const box = boxesMap.get(el.id)!;
    const borderW = getEffectiveBorderWidth(el.style);
    const isEmptyRect =
      el.type === 'rectangle' && !(el.content || '').trim() && borderW === 0 && !el.link;

    // Detect pure decorative gradient scrims sitting over large hero photography
    const overlapsHeroMedia =
      isEmptyRect &&
      box.boxWidth >= canvasWidth * 0.75 &&
      box.boxHeight >= 180 &&
      mediaElements.some((m) => {
        const mBox = boxesMap.get(m.id)!;
        return boxesOverlap(box.borderBox, mBox.borderBox, 8);
      });

    if (overlapsHeroMedia) {
      hiddenOverlays.push(el);
      result.set(el.id, {
        id: el.id,
        order: 0,
        marginTopPx: 0,
        isFixedNav: false,
        isTopFlowNav: false,
        isHiddenDecorativeOverlay: true,
        isFullBleedMedia: false,
      });
      continue;
    }

    if (el.style.position === 'fixed') {
      fixedNavs.push(el);
      result.set(el.id, {
        id: el.id,
        order: 0,
        marginTopPx: 0,
        isFixedNav: true,
        isTopFlowNav: false,
        isHiddenDecorativeOverlay: false,
        isFullBleedMedia: false,
      });
      continue;
    }

    if (
      el.type === 'navigation' &&
      el.navType === 'horizontal' &&
      box.borderBox.top <= 32 &&
      box.boxWidth >= canvasWidth * 0.8
    ) {
      topFlowNavs.push(el);
      continue;
    }

    flowCandidates.push(el);
  }

  // Sort flow candidates by top edge
  const sortedByTop = [...flowCandidates].sort((a, b) => {
    const ba = boxesMap.get(a.id)!.borderBox;
    const bb = boxesMap.get(b.id)!.borderBox;
    return ba.top - bb.top || ba.left - bb.left;
  });

  // 1. Partition into Horizontal Section Bands (sweeping Y intervals)
  const sectionBands: EditorElement[][] = [];
  let currentBand: EditorElement[] = [];
  let bandMaxBottom = -Infinity;

  for (const el of sortedByTop) {
    const b = boxesMap.get(el.id)!.borderBox;
    if (currentBand.length === 0) {
      currentBand = [el];
      bandMaxBottom = b.bottom;
    } else if (b.top < bandMaxBottom - 2) {
      currentBand.push(el);
      bandMaxBottom = Math.max(bandMaxBottom, b.bottom);
    } else {
      sectionBands.push(currentBand);
      currentBand = [el];
      bandMaxBottom = b.bottom;
    }
  }
  if (currentBand.length > 0) {
    sectionBands.push(currentBand);
  }

  // 2. Within each Section Band: pull full-bleed background media first, then X-sweep into Columns
  interface OrderedItem {
    el: EditorElement;
    bandIdx: number;
    colIdx: number;
  }
  const orderedFlow: OrderedItem[] = [];

  sectionBands.forEach((band, bandIdx) => {
    const bgMedia: EditorElement[] = [];
    const fgItems: EditorElement[] = [];

    for (const el of band) {
      const b = boxesMap.get(el.id)!.borderBox;
      const isBackdropMedia =
        el.type === 'media' &&
        b.width >= canvasWidth * 0.85 &&
        b.height >= 220 &&
        band.some((other) => other.id !== el.id && boxesOverlap(b, boxesMap.get(other.id)!.borderBox, 8));
      if (isBackdropMedia) {
        bgMedia.push(el);
      } else {
        fgItems.push(el);
      }
    }

    bgMedia.sort((a, b) => boxesMap.get(a.id)!.borderBox.top - boxesMap.get(b.id)!.borderBox.top);
    for (const bg of bgMedia) {
      orderedFlow.push({ el: bg, bandIdx, colIdx: -1 });
    }

    const sortedByLeft = [...fgItems].sort((a, b) => {
      const ba = boxesMap.get(a.id)!.borderBox;
      const bb = boxesMap.get(b.id)!.borderBox;
      return ba.left - bb.left || ba.top - bb.top;
    });

    const columns: EditorElement[][] = [];
    let curCol: EditorElement[] = [];
    let colMaxRight = -Infinity;

    for (const el of sortedByLeft) {
      const b = boxesMap.get(el.id)!.borderBox;
      if (curCol.length === 0) {
        curCol = [el];
        colMaxRight = b.right;
      } else if (b.left < colMaxRight - 4) {
        curCol.push(el);
        colMaxRight = Math.max(colMaxRight, b.right);
      } else {
        columns.push(curCol);
        curCol = [el];
        colMaxRight = b.right;
      }
    }
    if (curCol.length > 0) {
      columns.push(curCol);
    }

    columns.forEach((col, colIdx) => {
      col.sort((a, b) => {
        const ba = boxesMap.get(a.id)!.borderBox;
        const bb = boxesMap.get(b.id)!.borderBox;
        if (Math.abs(ba.top - bb.top) <= 16) {
          return ba.left - bb.left;
        }
        return ba.top - bb.top;
      });
      for (const item of col) {
        orderedFlow.push({ el: item, bandIdx, colIdx });
      }
    });
  });

  let orderCounter = 1;
  for (const nav of topFlowNavs) {
    result.set(nav.id, {
      id: nav.id,
      order: orderCounter++,
      marginTopPx: 0,
      isFixedNav: false,
      isTopFlowNav: true,
      isHiddenDecorativeOverlay: false,
      isFullBleedMedia: false,
    });
  }

  orderedFlow.forEach((entry, idx) => {
    const { el, bandIdx, colIdx } = entry;
    const currBox = boxesMap.get(el.id)!.borderBox;
    const isFullBleedMedia =
      el.type === 'media' &&
      (!el.mediaType || el.mediaType === 'image' || el.mediaType === 'video') &&
      currBox.width >= canvasWidth * 0.92;

    let marginTopPx = 0;
    if (idx === 0) {
      marginTopPx = isFullBleedMedia && currBox.top <= 4 ? 0 : 8;
    } else {
      const prevEntry = orderedFlow[idx - 1];
      const prevBox = boxesMap.get(prevEntry.el.id)!.borderBox;

      if (bandIdx !== prevEntry.bandIdx) {
        const rawSectionGap = Math.max(16, currBox.top - prevBox.bottom);
        marginTopPx = Math.min(36, Math.max(20, Math.round(rawSectionGap * 0.65)));
      } else if (colIdx !== prevEntry.colIdx) {
        marginTopPx = 22;
      } else if (Math.abs(currBox.top - prevBox.top) <= 18) {
        // Companion item on the same desktop row (e.g., item price next to item title, or secondary CTA button)
        marginTopPx = el.type === 'button' ? 10 : 4;
      } else {
        const rawColGap = Math.max(8, currBox.top - prevBox.bottom);
        marginTopPx = Math.min(28, Math.max(10, Math.round(rawColGap * 0.75)));
      }
    }

    result.set(el.id, {
      id: el.id,
      order: orderCounter++,
      marginTopPx,
      isFixedNav: false,
      isTopFlowNav: false,
      isHiddenDecorativeOverlay: false,
      isFullBleedMedia,
    });
  });

  return result;
}

