import JSZip from 'jszip';
import { EditorElement, Page } from '../types';
import {
  MobileFlowItemMeta,
  buildCssFilterString,
  computeMobileFlowLayout,
  formatCssBoxShorthand,
  getEffectiveBorderWidth,
  getEffectiveTag,
  getElementBoxes,
  getMarginSides,
  getPaddingSides,
  getPageFilename,
  hasAnyMargin,
  hasAnyPadding,
  isAutoHeightElement,
  sanitizeClassNames,
  sanitizeHtmlId,
} from './boxModel';

export interface GeneratedHtmlFile {
  pageId: string;
  pageName: string;
  filename: string;
  content: string;
}

export interface GeneratedSitePreview {
  htmlFiles: GeneratedHtmlFile[];
  cssContent: string;
  jsContent: string;
}

export interface ElementCodeSnippet {
  html: string;
  css: string;
  js: string;
}

export interface GenerateSiteOptions {
  previewMode?: boolean;
  origin?: string;
  packagedImageIds?: Set<string>;
}

const isDataImageUri = (str: string) => str.startsWith('data:image/');

const dataURItoBlob = (dataURI: string) => {
  const commaIdx = dataURI.indexOf(',');
  const header = commaIdx >= 0 ? dataURI.slice(0, commaIdx) : '';
  const data = commaIdx >= 0 ? dataURI.slice(commaIdx + 1) : '';
  const mimeMatch = header.match(/data:([^;,]+)/);
  const mimeString = mimeMatch ? mimeMatch[1] : 'image/png';

  if (header.includes(';base64')) {
    const byteString = atob(data);
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) {
      ia[i] = byteString.charCodeAt(i);
    }
    return new Blob([ab], { type: mimeString });
  }

  return new Blob([decodeURIComponent(data)], { type: mimeString });
};

const escapeHtml = (raw: string): string =>
  raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const escapeJsString = (raw: string): string =>
  raw.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\r?\n/g, '\\n');

const FONT_IMPORT_MAP: Record<string, string> = {
  "'Noto Sans JP', sans-serif": 'Noto+Sans+JP:wght@400;500;600;700',
  "'Shippori Mincho', serif": 'Shippori+Mincho:wght@400;500;600;700',
  "'Cormorant Garamond', serif": 'Cormorant+Garamond:ital,wght@0,500;0,600;0,700;1,400;1,600',
  "'Playfair Display', serif": 'Playfair+Display:ital,wght@0,500;0,600;0,700;1,400;1,600',
  "'Outfit', sans-serif": 'Outfit:wght@400;500;600;700',
  "'Plus Jakarta Sans', sans-serif": 'Plus+Jakarta+Sans:wght@400;500;600;700',
  "'DM Sans', sans-serif": 'DM+Sans:wght@400;500;700',
  "'Oswald', sans-serif": 'Oswald:wght@500;600;700',
  "'M PLUS 1p', sans-serif": 'M+PLUS+1p:wght@400;500;700',
  "'Sawarabi Mincho', serif": 'Sawarabi+Mincho',
  "'Yomogi', cursive": 'Yomogi',
  "'DotGothic16', sans-serif": 'DotGothic16',
  "'Lato', sans-serif": 'Lato:wght@400;700',
  "'Open Sans', sans-serif": 'Open+Sans:wght@400;600;700',
  "'Montserrat', sans-serif": 'Montserrat:wght@400;600;700',
  "'JetBrains Mono', monospace": 'JetBrains+Mono:wght@400;500;600',
};

function collectGoogleFontLink(pages: Page[]): string {
  const families = new Set<string>([
    FONT_IMPORT_MAP["'Plus Jakarta Sans', sans-serif"],
    FONT_IMPORT_MAP["'Noto Sans JP', sans-serif"],
  ]);
  for (const page of pages) {
    for (const el of page.elements) {
      const f = el.style.fontFamily;
      if (f && FONT_IMPORT_MAP[f]) {
        families.add(FONT_IMPORT_MAP[f]);
      }
    }
  }
  const query = Array.from(families)
    .map((fam) => `family=${fam}`)
    .join('&');
  return [
    '  <link rel="preconnect" href="https://fonts.googleapis.com">',
    '  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>',
    `  <link href="https://fonts.googleapis.com/css2?${query}&display=swap" rel="stylesheet">`,
  ].join('\n');
}

function resolveLinkHref(el: EditorElement, allPages: Page[]): string {
  if (!el.link) return '';
  if (el.linkType === 'page') {
    const target = allPages.find((p) => p.id === el.link);
    return target ? `./${getPageFilename(target, allPages)}` : '#';
  }
  return el.link;
}

function resolveMenuLinkHref(rawLink: string, allPages: Page[]): string {
  if (!rawLink) return '#';
  const cleaned = rawLink.startsWith('#') ? rawLink.slice(1) : rawLink;
  if (cleaned === 'home' && allPages.length > 0) {
    return '#';
  }
  const matchedPage = allPages.find((p) => p.id === cleaned || p.slug === cleaned);
  if (matchedPage) {
    return `./${getPageFilename(matchedPage, allPages)}`;
  }
  return rawLink;
}

function getCleanExportImageName(el: EditorElement, selectorId: string): string {
  if (el.imageName) {
    return el.imageName.replace(/[^a-zA-Z0-9._-]/g, '_');
  }
  if (el.src && isDataImageUri(el.src)) {
    const extMatch = el.src.match(/^data:image\/([a-zA-Z0-9+.-]+)[;,]/);
    const rawExt = extMatch ? extMatch[1].replace('svg+xml', 'svg') : 'png';
    return `${selectorId}.${rawExt}`;
  }
  if (el.src && !el.src.startsWith('http://') && !el.src.startsWith('https://')) {
    const baseName = el.src.split('/').pop()?.split('?')[0] || `${selectorId}.jpg`;
    return baseName.replace(/[^a-zA-Z0-9._-]/g, '_');
  }
  return '';
}

function buildSelectorMaps(pages: Page[]) {
  const usedSelectorIds = new Set<string>();
  const elementSelectorMap = new Map<string, string>();
  const idLookup = new Map<string, string>();

  for (const page of pages) {
    for (const el of page.elements) {
      const baseId = sanitizeHtmlId(el.htmlId, el.id);
      let uniqueId = baseId;
      let counter = 2;
      while (usedSelectorIds.has(uniqueId)) {
        uniqueId = `${baseId}-${counter}`;
        counter++;
      }
      usedSelectorIds.add(uniqueId);
      elementSelectorMap.set(el.id, uniqueId);
      idLookup.set(el.id, uniqueId);
      if (el.htmlId && !idLookup.has(el.htmlId)) {
        idLookup.set(el.htmlId, uniqueId);
      }
    }
  }

  return { elementSelectorMap, idLookup };
}

function buildElementCssRules(
  el: EditorElement,
  selectorId: string,
  canvasWidth: number = 1280
): string {
  const declarations: string[] = [];
  const style = el.style;
  const tag = getEffectiveTag(el);
  const posMode = style.position || 'absolute';

  declarations.push(`position: ${posMode};`);

  const transformParts: string[] = [];
  if (posMode === 'fixed') {
    // Align fixed elements with the centered 1280px .page-canvas across any monitor width
    // (Using 100% instead of 100vw avoids vertical-scrollbar width mismatch)
    if (el.anchorX === 'left') {
      declarations.push(
        el.x === 0
          ? `left: max(0px, calc((100% - ${canvasWidth}px) / 2));`
          : `left: calc(max(0px, (100% - ${canvasWidth}px) / 2) + ${el.x}px);`
      );
    } else if (el.anchorX === 'right') {
      declarations.push(
        el.x === 0
          ? `right: max(0px, calc((100% - ${canvasWidth}px) / 2));`
          : `right: calc(max(0px, (100% - ${canvasWidth}px) / 2) + ${el.x}px);`
      );
    } else {
      declarations.push(el.x === 0 ? 'left: 50%;' : `left: calc(50% + ${el.x}px);`);
      transformParts.push('translateX(-50%)');
    }
  } else {
    if (el.anchorX === 'left') {
      declarations.push(`left: ${el.x}px;`);
    } else if (el.anchorX === 'right') {
      declarations.push(`right: ${el.x}px;`);
    } else {
      declarations.push(el.x === 0 ? 'left: 50%;' : `left: calc(50% + ${el.x}px);`);
      transformParts.push('translateX(-50%)');
    }
  }

  if (el.anchorY === 'top') {
    declarations.push(`top: ${el.y}px;`);
  } else if (el.anchorY === 'bottom') {
    declarations.push(`bottom: ${el.y}px;`);
  } else {
    declarations.push(el.y === 0 ? 'top: 50%;' : `top: calc(50% + ${el.y}px);`);
    transformParts.push('translateY(-50%)');
  }

  if (style.rotate) {
    transformParts.push(`rotate(${style.rotate}deg)`);
  }

  if (transformParts.length > 0) {
    declarations.push(`transform: ${transformParts.join(' ')};`);
  }

  declarations.push(`width: ${el.width}px;`);
  if (isAutoHeightElement(el)) {
    declarations.push(`min-height: ${el.height}px;`);
    declarations.push('height: auto;');
  } else {
    declarations.push(`height: ${el.height}px;`);
  }

  if (style.boxSizing === 'content-box') {
    declarations.push('box-sizing: content-box;');
  }

  if (hasAnyMargin(style)) {
    declarations.push(`margin: ${formatCssBoxShorthand(getMarginSides(style))};`);
  } else {
    declarations.push('margin: 0;');
  }

  if (el.type === 'navigation' && el.navType === 'horizontal') {
    const navPad = hasAnyPadding(style)
      ? formatCssBoxShorthand(getPaddingSides(style))
      : `0 ${style.padding ?? 24}px`;
    declarations.push(`padding: ${navPad};`);
  } else if (hasAnyPadding(style)) {
    declarations.push(`padding: ${formatCssBoxShorthand(getPaddingSides(style))};`);
  } else {
    declarations.push('padding: 0;');
  }

  // Display & Layout (1:1 parity with CanvasElement)
  if (el.type === 'divider' || tag === 'hr') {
    declarations.push('display: block;');
  } else if (el.type === 'media' && el.mediaType === 'image') {
    declarations.push('display: block;');
    declarations.push(`object-fit: ${style.objectFit || 'cover'};`);
  } else if (el.type === 'media' && el.mediaType === 'svg') {
    declarations.push('display: block;');
  } else if (el.type === 'navigation' && el.navType === 'horizontal') {
    declarations.push('display: flex;');
    declarations.push('align-items: center;');
    declarations.push('justify-content: space-between;');
  } else if (el.type === 'navigation' && el.navType === 'hamburger') {
    declarations.push('display: flex;');
    declarations.push('align-items: center;');
    declarations.push('justify-content: center;');
  } else if (el.type === 'text') {
    const displayVal = style.display || 'block';
    declarations.push(`display: ${displayVal};`);
    if (displayVal === 'flex' || displayVal === 'inline-flex') {
      if (style.flexDirection && style.flexDirection !== 'row') {
        declarations.push(`flex-direction: ${style.flexDirection};`);
      }
      declarations.push(`align-items: ${style.alignItems || 'flex-start'};`);
      declarations.push(
        `justify-content: ${
          style.justifyContent ||
          (style.textAlign === 'center'
            ? 'center'
            : style.textAlign === 'right'
              ? 'flex-end'
              : 'flex-start')
        };`
      );
    }
    declarations.push('white-space: pre-wrap;');
    declarations.push('overflow-wrap: break-word;');
  } else {
    const displayVal = style.display || 'flex';
    declarations.push(`display: ${displayVal};`);
    if (displayVal === 'flex' || displayVal === 'inline-flex') {
      if (style.flexDirection && style.flexDirection !== 'row') {
        declarations.push(`flex-direction: ${style.flexDirection};`);
      }
      declarations.push(`align-items: ${style.alignItems || 'center'};`);
      declarations.push(`justify-content: ${style.justifyContent || 'center'};`);
      if (style.gap) {
        declarations.push(`gap: ${style.gap}px;`);
      }
    }
    if (el.content) {
      declarations.push('white-space: pre-wrap;');
      declarations.push('overflow-wrap: break-word;');
    }
  }

  // Backgrounds & Glassmorphism
  if (el.type === 'divider' || tag === 'hr') {
    const hrBg =
      style.backgroundColor && style.backgroundColor !== 'transparent'
        ? style.backgroundColor
        : '#cbd5e1';
    declarations.push(`background-color: ${hrBg};`);
  } else if (style.backgroundColor && style.backgroundColor !== 'transparent') {
    declarations.push(`background-color: ${style.backgroundColor};`);
  } else {
    declarations.push('background-color: transparent;');
  }

  if (style.backgroundImage) {
    declarations.push(`background-image: ${style.backgroundImage};`);
  }

  if (style.backdropFilterBlur && style.backdropFilterBlur > 0) {
    declarations.push(`-webkit-backdrop-filter: blur(${style.backdropFilterBlur}px);`);
    declarations.push(`backdrop-filter: blur(${style.backdropFilterBlur}px);`);
  }

  if (style.color) {
    declarations.push(`color: ${style.color};`);
  }

  // Typography (emit exact values without skipping 400 / left / sans-serif)
  const hasText =
    el.type === 'text' ||
    el.type === 'button' ||
    el.type === 'navigation' ||
    Boolean(el.content && el.content.trim().length > 0);

  if (hasText) {
    if (style.fontFamily) {
      declarations.push(`font-family: ${style.fontFamily};`);
    }
    if (style.fontSize) {
      declarations.push(`font-size: ${style.fontSize}px;`);
    }
    if (style.fontWeight) {
      declarations.push(`font-weight: ${style.fontWeight};`);
    } else if (el.type === 'navigation') {
      declarations.push('font-weight: 500;');
    }
    if (style.fontStyle && style.fontStyle !== 'normal') {
      declarations.push(`font-style: ${style.fontStyle};`);
    }
    if (style.lineHeight) {
      declarations.push(`line-height: ${style.lineHeight};`);
    }
    if (style.letterSpacing !== undefined && style.letterSpacing !== 0) {
      declarations.push(`letter-spacing: ${style.letterSpacing}px;`);
    }
    if (style.textAlign) {
      declarations.push(`text-align: ${style.textAlign};`);
    }
    if (style.textTransform && style.textTransform !== 'none') {
      declarations.push(`text-transform: ${style.textTransform};`);
    }
    if (style.writingMode && style.writingMode !== 'horizontal-tb') {
      declarations.push(`writing-mode: ${style.writingMode};`);
    }
    if (style.textDecoration && style.textDecoration !== 'none') {
      declarations.push(`text-decoration: ${style.textDecoration};`);
    } else if (tag === 'a') {
      declarations.push('text-decoration: none;');
    }
  }

  // Borders (including selective sides)
  const bw = getEffectiveBorderWidth(style);
  const bStyle = style.borderStyle || 'solid';
  const bColor = style.borderColor || '#0f172a';
  const bSides = style.borderSides || 'all';

  if (bw > 0) {
    if (bSides === 'all') {
      declarations.push(`border: ${bw}px ${bStyle} ${bColor};`);
    } else {
      declarations.push('border: none;');
      if (bSides === 'bottom' || bSides === 'y') {
        declarations.push(`border-bottom: ${bw}px ${bStyle} ${bColor};`);
      }
      if (bSides === 'top' || bSides === 'y') {
        declarations.push(`border-top: ${bw}px ${bStyle} ${bColor};`);
      }
      if (bSides === 'left') {
        declarations.push(`border-left: ${bw}px ${bStyle} ${bColor};`);
      }
      if (bSides === 'right') {
        declarations.push(`border-right: ${bw}px ${bStyle} ${bColor};`);
      }
    }
  } else {
    declarations.push('border: none;');
  }

  if (el.type === 'circle' && style.borderRadius === undefined) {
    declarations.push('border-radius: 50%;');
  } else if (style.borderRadius && style.borderRadius > 0) {
    const unit = style.borderRadiusUnit || 'px';
    declarations.push(`border-radius: ${style.borderRadius}${unit};`);
  }

  if (style.boxShadow) {
    declarations.push(`box-shadow: ${style.boxShadow};`);
  }

  const filterStr = buildCssFilterString(style);
  if (filterStr) {
    declarations.push(`filter: ${filterStr};`);
  }

  if (style.opacity !== undefined && style.opacity !== 1) {
    declarations.push(`opacity: ${style.opacity};`);
  }

  if (style.overflow && style.overflow !== 'visible') {
    declarations.push(`overflow: ${style.overflow};`);
  }

  declarations.push(`z-index: ${style.zIndex ?? 1};`);

  const hasInteractiveJs = el.interaction && el.interaction.action !== 'none';
  if (style.cursor && style.cursor !== 'auto') {
    declarations.push(`cursor: ${style.cursor};`);
  } else if (el.type === 'button' || el.link || hasInteractiveJs) {
    declarations.push('cursor: pointer;');
  }

  // Hover pseudo-class
  const hoverDeclarations: string[] = [];
  if (el.hoverEffect === 'opacity') {
    hoverDeclarations.push(`opacity: ${Number(((style.opacity ?? 1) * 0.75).toFixed(2))};`);
  } else if (el.hoverEffect === 'scale') {
    const hoverTrans = [...transformParts, 'scale(1.04)'].join(' ');
    hoverDeclarations.push(`transform: ${hoverTrans};`);
  } else if (el.hoverEffect === 'lift') {
    const hoverTrans = [...transformParts, 'translateY(-4px)'].join(' ');
    const liftShadow = style.boxShadow
      ? `${style.boxShadow}, 0 10px 20px rgba(15, 23, 42, 0.14)`
      : '0 10px 20px rgba(15, 23, 42, 0.14)';
    hoverDeclarations.push(`transform: ${hoverTrans};`);
    hoverDeclarations.push(`box-shadow: ${liftShadow};`);
  }

  if (style.hoverBackgroundColor) {
    hoverDeclarations.push(`background-color: ${style.hoverBackgroundColor};`);
  }
  if (style.hoverColor) {
    hoverDeclarations.push(`color: ${style.hoverColor};`);
  }

  if (hoverDeclarations.length > 0) {
    declarations.push(
      'transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.2s ease, opacity 0.2s ease, background-color 0.2s ease, color 0.2s ease;'
    );
  }

  const ruleBlocks: string[] = [];
  ruleBlocks.push(`#${selectorId} {\n  ${declarations.join('\n  ')}\n}`);

  if (el.type === 'media' && el.mediaType === 'svg') {
    ruleBlocks.push(`#${selectorId} > svg {\n  width: 100%;\n  height: 100%;\n  display: block;\n}`);
  }

  if (el.type === 'navigation' && el.navType === 'horizontal' && style.gap !== undefined) {
    ruleBlocks.push(`#${selectorId} .nav-list {\n  gap: ${style.gap}px;\n}`);
  }

  if (hoverDeclarations.length > 0) {
    ruleBlocks.push(`#${selectorId}:hover {\n  ${hoverDeclarations.join('\n  ')}\n}`);
  }

  return ruleBlocks.join('\n\n');
}

function buildElementMobileCssRules(
  el: EditorElement,
  selectorId: string,
  meta: MobileFlowItemMeta,
  allPages: Page[]
): string {
  if (meta.isHiddenDecorativeOverlay) {
    return `  #${selectorId} {\n    display: none !important;\n  }`;
  }

  if (meta.isFixedNav) {
    if (el.navType === 'hamburger') {
      return [
        `  #${selectorId} {`,
        '    position: fixed !important;',
        '    top: 12px !important;',
        '    right: 16px !important;',
        '    left: auto !important;',
        '    bottom: auto !important;',
        '    width: 44px !important;',
        '    height: 44px !important;',
        '    margin: 0 !important;',
        '    transform: none !important;',
        '  }',
      ].join('\n');
    }

    return [
      `  #${selectorId} {`,
      '    position: fixed !important;',
      '    top: 0 !important;',
      '    left: 0 !important;',
      '    right: 0 !important;',
      '    bottom: auto !important;',
      '    width: 100% !important;',
      '    height: auto !important;',
      '    min-height: 56px !important;',
      '    padding: 12px 16px !important;',
      '    margin: 0 !important;',
      '    transform: none !important;',
      '  }',
    ].join('\n');
  }

  if (meta.isTopFlowNav) {
    return [
      `  #${selectorId} {`,
      '    position: relative !important;',
      '    left: auto !important;',
      '    right: auto !important;',
      '    top: auto !important;',
      '    bottom: auto !important;',
      '    transform: none !important;',
      `    order: ${meta.order};`,
      '    width: calc(100% + 40px) !important;',
      '    max-width: none !important;',
      '    height: auto !important;',
      '    min-height: 56px !important;',
      '    padding: 12px 16px !important;',
      '    margin: -28px -20px 20px -20px !important;',
      '  }',
    ].join('\n');
  }

  const hasImageLink =
    el.type === 'media' && el.mediaType === 'image' && Boolean(resolveLinkHref(el, allPages));

  const blocks: string[] = [];
  if (hasImageLink) {
    blocks.push(
      [
        `  #${selectorId}-link {`,
        `    order: ${meta.order};`,
        '    display: block;',
        '    width: 100%;',
        `    margin: ${meta.marginTopPx}px 0 0 0 !important;`,
        '  }',
      ].join('\n')
    );
  }

  const decls: string[] = [
    'position: relative !important;',
    'left: auto !important;',
    'right: auto !important;',
    'top: auto !important;',
    'bottom: auto !important;',
    'transform: none !important;',
  ];

  if (!hasImageLink) {
    decls.push(`order: ${meta.order};`);
  }

  const pad = getPaddingSides(el.style);

  if (el.type === 'divider') {
    decls.push('width: 100% !important;');
    decls.push(`height: ${Math.max(1, el.height)}px !important;`);
    decls.push(`margin: ${meta.marginTopPx}px 0 0 0 !important;`);
  } else if (el.type === 'media' && el.mediaType === 'image') {
    if (meta.isFullBleedMedia) {
      decls.push('width: calc(100% + 40px) !important;');
      decls.push('max-width: none !important;');
      decls.push('height: auto !important;');
      decls.push('aspect-ratio: 16 / 10;');
      decls.push(
        `margin: ${meta.marginTopPx === 0 ? '-28px' : `${meta.marginTopPx}px`} -20px 0 -20px !important;`
      );
      decls.push('border-radius: 0 !important;');
    } else {
      decls.push('width: 100% !important;');
      decls.push('max-width: 100% !important;');
      decls.push('height: auto !important;');
      decls.push(`aspect-ratio: ${Math.max(1, el.width)} / ${Math.max(1, el.height)};`);
      decls.push(`margin: ${hasImageLink ? 0 : meta.marginTopPx}px 0 0 0 !important;`);
    }
  } else if (el.type === 'media' && el.mediaType === 'svg') {
    decls.push(`width: min(100%, ${el.width}px) !important;`);
    decls.push('height: auto !important;');
    decls.push(`aspect-ratio: ${Math.max(1, el.width)} / ${Math.max(1, el.height)};`);
    decls.push(`margin: ${meta.marginTopPx}px 0 0 0 !important;`);
  } else if (el.type === 'text') {
    if (el.style.writingMode === 'vertical-rl') {
      decls.push('width: auto !important;');
      decls.push(`height: ${Math.min(el.height, 220)}px !important;`);
      decls.push('min-height: 0 !important;');
      decls.push('align-self: center;');
      decls.push(`margin: ${meta.marginTopPx}px auto 0 auto !important;`);
    } else {
      decls.push('width: 100% !important;');
      decls.push('max-width: 100% !important;');
      decls.push('height: auto !important;');
      decls.push('min-height: 0 !important;');
      decls.push(`margin: ${meta.marginTopPx}px 0 0 0 !important;`);

      const fs = el.style.fontSize ?? 16;
      if (fs >= 44) {
        decls.push(`font-size: ${Math.max(28, Math.round(fs * 0.66))}px !important;`);
        decls.push('line-height: 1.22 !important;');
      } else if (fs >= 30) {
        decls.push(`font-size: ${Math.max(22, Math.round(fs * 0.78))}px !important;`);
        decls.push('line-height: 1.28 !important;');
      }

      if (el.style.letterSpacing && el.style.letterSpacing > 2.5) {
        decls.push('letter-spacing: 1.8px !important;');
      }

      if (pad.left > 16 || pad.right > 16) {
        decls.push(`padding-left: ${Math.min(16, pad.left)}px !important;`);
        decls.push(`padding-right: ${Math.min(16, pad.right)}px !important;`);
      }

      if (el.style.textAlign === 'right') {
        decls.push('text-align: left !important;');
      }
    }
  } else if (el.type === 'button') {
    if (el.anchorX === 'center') {
      decls.push(`width: min(100%, ${Math.max(240, el.width)}px) !important;`);
      decls.push('align-self: center;');
      decls.push(`margin: ${meta.marginTopPx}px auto 0 auto !important;`);
    } else {
      decls.push('width: 100% !important;');
      decls.push('max-width: 100% !important;');
      decls.push(`margin: ${meta.marginTopPx}px 0 0 0 !important;`);
    }
    decls.push(`min-height: ${Math.max(44, el.height)}px !important;`);
    decls.push('height: auto !important;');
    decls.push('padding: 12px 20px !important;');
  } else if (el.type === 'circle') {
    decls.push(`width: min(100%, ${el.width}px) !important;`);
    decls.push('height: auto !important;');
    decls.push('aspect-ratio: 1 / 1;');
    decls.push('align-self: center;');
    decls.push(`margin: ${meta.marginTopPx}px auto 0 auto !important;`);
  } else if (el.type === 'navigation') {
    if (el.navType === 'hamburger') {
      decls.push('width: 44px !important;');
      decls.push('height: 44px !important;');
      decls.push('align-self: flex-end;');
      decls.push(`margin: ${meta.marginTopPx}px 0 0 auto !important;`);
    } else {
      decls.push('width: 100% !important;');
      decls.push('height: auto !important;');
      decls.push('min-height: 52px !important;');
      decls.push('padding: 10px 14px !important;');
      decls.push(`margin: ${meta.marginTopPx}px 0 0 0 !important;`);
    }
  } else {
    // rectangle (<section>, <article>, <aside>, <footer>, <div>)
    const hasInnerText = Boolean((el.content || '').trim());
    decls.push('width: 100% !important;');
    decls.push('max-width: 100% !important;');
    decls.push('height: auto !important;');
    decls.push(`min-height: ${hasInnerText ? '0' : `${Math.min(el.height, 140)}px`} !important;`);
    decls.push(`margin: ${meta.marginTopPx}px 0 0 0 !important;`);
    decls.push('overflow-wrap: break-word;');

    if (pad.left > 20 || pad.right > 20 || pad.top > 28 || pad.bottom > 28) {
      decls.push(
        `padding: ${Math.min(24, pad.top)}px ${Math.min(20, pad.right)}px ${Math.min(24, pad.bottom)}px ${Math.min(20, pad.left)}px !important;`
      );
    }
    if (el.style.letterSpacing && el.style.letterSpacing > 2) {
      decls.push('letter-spacing: 1.4px !important;');
    }
  }

  blocks.push(`  #${selectorId} {\n    ${decls.join('\n    ')}\n  }`);
  return blocks.join('\n\n');
}

function buildElementHtmlMarkup(
  el: EditorElement,
  selectorId: string,
  allPages: Page[],
  resolvedImageSrc?: string
): string {
  const userClasses = sanitizeClassNames(el.className);
  const classAttr = userClasses ? ` class="${userClasses}"` : '';
  const hiddenAttr = el.hiddenByDefault ? ' hidden' : '';
  const tag = getEffectiveTag(el);
  const href = resolveLinkHref(el, allPages);

  if (el.type === 'divider' || tag === 'hr') {
    return `<hr id="${selectorId}"${classAttr}${hiddenAttr}>`;
  }

  if (el.type === 'media') {
    if (el.mediaType === 'svg') {
      const svg = (
        el.svgContent ||
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/></svg>'
      ).trim();
      if (href) {
        const targetAttrs =
          el.linkTarget === '_blank' ? ' target="_blank" rel="noopener noreferrer"' : '';
        return `<a id="${selectorId}"${classAttr} href="${escapeHtml(href)}"${targetAttrs}${hiddenAttr}>\n      ${svg}\n    </a>`;
      }
      return `<div id="${selectorId}"${classAttr}${hiddenAttr}>\n      ${svg}\n    </div>`;
    }

    const imgSrc = resolvedImageSrc || el.src || '';
    const altText = escapeHtml(el.alt ?? '');
    const imgMarkup = `<img id="${selectorId}"${classAttr} src="${escapeHtml(imgSrc)}" alt="${altText}"${hiddenAttr}>`;
    if (href) {
      const targetAttrs =
        el.linkTarget === '_blank' ? ' target="_blank" rel="noopener noreferrer"' : '';
      return `<a id="${selectorId}-link" class="media-link" href="${escapeHtml(href)}"${targetAttrs}>\n      ${imgMarkup}\n    </a>`;
    }
    return imgMarkup;
  }

  if (el.type === 'navigation') {
    if (el.navType === 'horizontal') {
      const leftItems = el.menuItems?.filter((i) => (i.position || 'left') === 'left') || [];
      const rightItems = el.menuItems?.filter((i) => i.position === 'right') || [];
      const outerTag = el.tagName === 'header' ? 'header' : 'nav';
      const navClasses = ['site-navbar', userClasses].filter(Boolean).join(' ');

      const leftList = leftItems
        .map(
          (item) =>
            `        <li><a href="${escapeHtml(resolveMenuLinkHref(item.link, allPages))}" class="nav-link">${escapeHtml(item.label)}</a></li>`
        )
        .join('\n');
      const rightList = rightItems
        .map(
          (item) =>
            `        <li><a href="${escapeHtml(resolveMenuLinkHref(item.link, allPages))}" class="nav-link">${escapeHtml(item.label)}</a></li>`
        )
        .join('\n');

      const innerLists = [
        leftItems.length > 0
          ? `      <ul class="nav-list">\n${leftList}\n      </ul>`
          : '      <div class="nav-spacer"></div>',
        rightItems.length > 0 ? `      <ul class="nav-list">\n${rightList}\n      </ul>` : '',
      ]
        .filter(Boolean)
        .join('\n');

      if (outerTag === 'header') {
        return `<header id="${selectorId}" class="${navClasses}"${hiddenAttr}>\n      <nav class="site-navbar__inner" aria-label="メインナビゲーション">\n${innerLists}\n      </nav>\n    </header>`;
      }
      return `<nav id="${selectorId}" class="${navClasses}" aria-label="メインナビゲーション"${hiddenAttr}>\n${innerLists}\n    </nav>`;
    }

    const drawerId = `${selectorId}-drawer`;
    const navClasses = ['hamburger-nav', userClasses].filter(Boolean).join(' ');
    const listMarkup = (el.menuItems || [])
      .map(
        (item) =>
          `        <li><a href="${escapeHtml(resolveMenuLinkHref(item.link, allPages))}" class="drawer-link">${escapeHtml(item.label)}</a></li>`
      )
      .join('\n');

    return [
      `<nav id="${selectorId}" class="${navClasses}" aria-label="メニュー"${hiddenAttr}>`,
      `      <button type="button" class="hamburger-trigger" aria-expanded="false" aria-controls="${drawerId}" aria-label="メニューを開閉">`,
      '        <span class="hamburger-icon" aria-hidden="true">',
      '          <span></span>',
      '          <span></span>',
      '          <span></span>',
      '        </span>',
      '      </button>',
      `      <ul id="${drawerId}" class="hamburger-drawer" hidden>`,
      listMarkup,
      '      </ul>',
      '    </nav>',
    ]
      .filter((line) => line !== '')
      .join('\n');
  }

  const escapedText = escapeHtml(el.content || '');

  if (href) {
    const targetAttrs =
      el.linkTarget === '_blank' ? ' target="_blank" rel="noopener noreferrer"' : '';
    if (tag === 'a' || el.type === 'button') {
      return `<a id="${selectorId}"${classAttr} href="${escapeHtml(href)}"${targetAttrs}${hiddenAttr}>${escapedText}</a>`;
    }
    return `<${tag} id="${selectorId}"${classAttr}${hiddenAttr}><a href="${escapeHtml(href)}" class="inherit-link"${targetAttrs}>${escapedText}</a></${tag}>`;
  }

  if (tag === 'button') {
    const btnType = el.buttonType || 'button';
    return `<button id="${selectorId}"${classAttr} type="${btnType}"${hiddenAttr}>${escapedText}</button>`;
  }

  if (tag === 'a') {
    return `<a id="${selectorId}"${classAttr} href="#"${hiddenAttr}>${escapedText}</a>`;
  }

  return `<${tag} id="${selectorId}"${classAttr}${hiddenAttr}>${escapedText}</${tag}>`;
}

function buildElementJsCode(
  el: EditorElement,
  selectorId: string,
  idLookup: Map<string, string>,
  previewMode: boolean = false
): string {
  const interaction = el.interaction;
  if (!interaction || interaction.action === 'none') return '';

  const eventName = interaction.event || 'click';
  const rawTarget = interaction.targetId || '';
  const resolvedTargetId = idLookup.get(rawTarget) || sanitizeHtmlId(rawTarget, rawTarget);
  const safeVar = `el_${selectorId.replace(/[^a-zA-Z0-9_]/g, '_')}`;

  const lines: string[] = [];
  lines.push(`const ${safeVar} = document.getElementById('${selectorId}');`);
  lines.push(`if (${safeVar}) {`);
  lines.push(`  ${safeVar}.addEventListener('${eventName}', (event) => {`);

  switch (interaction.action) {
    case 'toggle-element': {
      if (resolvedTargetId) {
        lines.push(`    const target = document.getElementById('${resolvedTargetId}');`);
        lines.push('    if (target) {');
        lines.push('      target.hidden = !target.hidden;');
        lines.push('      syncLayout();');
        lines.push('    }');
      }
      break;
    }
    case 'scroll-to': {
      if (resolvedTargetId) {
        lines.push(`    const target = document.getElementById('${resolvedTargetId}');`);
        lines.push('    if (target) {');
        lines.push("      target.scrollIntoView({ behavior: 'smooth', block: 'start' });");
        lines.push('    }');
      }
      break;
    }
    case 'toggle-class': {
      const cls = sanitizeClassNames(interaction.className) || 'is-active';
      const firstCls = cls.split(' ')[0];
      const targetExpr = resolvedTargetId
        ? `document.getElementById('${resolvedTargetId}')`
        : 'event.currentTarget';
      lines.push(`    const target = ${targetExpr};`);
      lines.push('    if (target instanceof HTMLElement) {');
      lines.push(`      target.classList.toggle('${firstCls}');`);
      lines.push('    }');
      break;
    }
    case 'alert': {
      const msg = escapeJsString(interaction.message || 'クリックされました');
      if (previewMode) {
        lines.push(
          `    window.parent.postMessage({ type: 'WEBSIDE_TOAST', message: '${msg}' }, '*');`
        );
      } else {
        lines.push(`    window.alert('${msg}');`);
      }
      break;
    }
    case 'custom': {
      const code = (interaction.customCode || '').trim();
      if (code) {
        for (const codeLine of code.split('\n')) {
          lines.push(`    ${codeLine}`);
        }
      }
      break;
    }
  }

  lines.push('  });');
  lines.push('}');
  return lines.join('\n');
}

export function generateElementSnippet(
  el: EditorElement,
  allPages: Page[],
  canvasWidth: number = 1280
): ElementCodeSnippet {
  const selectorId = sanitizeHtmlId(el.htmlId, el.id);
  const { idLookup } = buildSelectorMaps(allPages);

  const cleanImg = getCleanExportImageName(el, selectorId);
  const previewImgSrc = cleanImg ? `./images/${cleanImg}` : el.src;

  const html = buildElementHtmlMarkup(el, selectorId, allPages, previewImgSrc);
  const css = buildElementCssRules(el, selectorId, canvasWidth);
  const js = buildElementJsCode(el, selectorId, idLookup, false);

  return { html, css, js };
}

export function generateSiteFiles(
  pages: Page[],
  canvasWidth: number = 1280,
  defaultCanvasHeight: number = 800,
  options?: GenerateSiteOptions
): GeneratedSitePreview {
  const isPreview = Boolean(options?.previewMode);
  const origin = options?.origin || '';
  const packagedImageIds = options?.packagedImageIds;

  const { elementSelectorMap, idLookup } = buildSelectorMaps(pages);
  const fontLinks = collectGoogleFontLink(pages);
  const cssSections: string[] = [];
  const jsBlocks: string[] = [];
  let hasHamburgerMenu = false;

  const primaryBg = pages[0]?.backgroundColor || '#ffffff';

  cssSections.push(`/* ==========================================================================
   Base Reset & Layout
   ========================================================================== */
*,
*::before,
*::after {
  box-sizing: border-box;
}

[hidden] {
  display: none !important;
}

html {
  scroll-behavior: smooth;
  line-height: 1.5;
  -webkit-text-size-adjust: 100%;
}

body {
  margin: 0;
  padding: 0;
  background-color: ${primaryBg};
  color: #0f172a;
  font-family: 'Plus Jakarta Sans', 'Noto Sans JP', -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  line-height: 1.5;
  overflow-x: hidden;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-rendering: optimizeLegibility;
}

h1, h2, h3, h4, h5, h6, p, blockquote, figure, ul, ol {
  margin: 0;
  padding: 0;
  font-size: inherit;
  font-weight: inherit;
}

button, input, select, textarea {
  font-family: inherit;
  font-size: 100%;
  font-weight: inherit;
  line-height: inherit;
  letter-spacing: inherit;
  color: inherit;
  margin: 0;
  padding: 0;
  background: transparent;
  border: none;
}

hr {
  margin: 0;
  border: none;
  color: inherit;
}

img, svg {
  display: block;
  max-width: none;
}

.page-viewport {
  width: 100%;
  display: flex;
  justify-content: center;
  overflow-x: hidden;
}

.page-canvas {
  position: relative;
  width: ${canvasWidth}px;
  min-height: ${defaultCanvasHeight}px;
  flex-shrink: 0;
  transform-origin: top left;
}

.inherit-link {
  color: inherit;
  text-decoration: inherit;
}

.media-link {
  text-decoration: none;
}

.is-active {
  outline: 2px solid #4f46e5;
  outline-offset: 2px;
}

/* Smartphone Responsive Base (375px–767px: Native Flexbox Document Flow) */
@media (max-width: 767px) {
  .page-viewport {
    display: block;
    width: 100%;
    height: auto !important;
    overflow-x: hidden;
  }

  .page-canvas {
    width: 100% !important;
    max-width: 100% !important;
    min-height: 100vh !important;
    height: auto !important;
    padding: 28px 20px 48px;
    display: flex;
    flex-direction: column;
    align-items: stretch;
    transform: none !important;
  }

  .site-navbar__inner {
    flex-wrap: wrap;
    gap: 8px 14px;
  }

  .nav-list {
    gap: 14px !important;
    flex-wrap: wrap;
    font-size: 13px;
  }
}`);

  const hasAnyNav = pages.some((p) => p.elements.some((el) => el.type === 'navigation'));
  if (hasAnyNav) {
    cssSections.push(`/* ==========================================================================
   Navigation Components
   ========================================================================== */
.site-navbar__inner {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.nav-list {
  display: flex;
  align-items: center;
  gap: 24px;
  list-style: none;
  margin: 0;
  padding: 0;
}

.nav-link {
  color: inherit;
  text-decoration: none;
  font-weight: inherit;
  white-space: nowrap;
  transition: opacity 0.2s ease;
}

.nav-link:hover {
  opacity: 0.7;
}

.hamburger-trigger {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  color: inherit;
  cursor: pointer;
  padding: 0;
}

.hamburger-icon {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  width: 24px;
  height: 18px;
}

.hamburger-icon span {
  display: block;
  width: 100%;
  height: 2px;
  background-color: currentColor;
  border-radius: 2px;
}

.hamburger-drawer {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  min-width: 192px;
  margin: 0;
  padding: 8px;
  list-style: none;
  background-color: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  box-shadow: 0 10px 25px rgba(15, 23, 42, 0.12);
  z-index: 1000;
}

.drawer-link {
  display: block;
  padding: 10px 14px;
  color: #1e293b;
  font-size: 14px;
  text-decoration: none;
  border-radius: 6px;
  transition: background-color 0.15s ease;
}

.drawer-link:hover {
  background-color: #f1f5f9;
}`);
  }

  interface PreparedPageData {
    page: Page;
    filename: string;
    pageSlug: string;
    pageElementMarkups: string[];
  }

  interface DesktopFlowItemMeta {
    id: string;
    l: number;
    r: number;
    t: number;
    h: number;
    baseCssTop: number | null;
    hiddenInit: boolean;
  }

  const preparedPages: PreparedPageData[] = [];
  const fixedSelectorsTop: string[] = [];
  const fixedSelectorsBottom: string[] = [];
  const desktopFlowByCanvas: Record<
    string,
    { baseCanvasH: number; autoFlow: boolean; items: DesktopFlowItemMeta[] }
  > = {};

  for (const page of pages) {
    const filename = getPageFilename(page, pages);
    const pageSlug = sanitizeHtmlId(page.slug || page.id, page.id);
    const pageBg = page.backgroundColor || '#ffffff';
    const pageHeight = page.height || defaultCanvasHeight;

    const pageElementMarkups: string[] = [];
    const pageCssRules: string[] = [];
    const pageMobileRules: string[] = [];
    const pageDesktopItems: DesktopFlowItemMeta[] = [];

    const mobileLayoutMap = computeMobileFlowLayout(page.elements, canvasWidth, pageHeight);

    const hasFixedTopHeader = page.elements.some(
      (el) =>
        el.style.position === 'fixed' &&
        el.anchorY !== 'bottom' &&
        (el.type === 'navigation' ? el.navType !== 'hamburger' : el.width >= canvasWidth * 0.5)
    );

    pageCssRules.push(
      `body.page-${pageSlug} {\n  background-color: ${pageBg};\n}\n\n#canvas-${pageSlug} {\n  min-height: ${pageHeight}px;\n  background-color: ${pageBg};\n}`
    );

    if (hasFixedTopHeader) {
      pageMobileRules.push(
        `  #canvas-${pageSlug} {\n    padding-top: 84px;\n  }`
      );
    }

    for (const el of page.elements) {
      const selectorId = elementSelectorMap.get(el.id) || sanitizeHtmlId(el.htmlId, el.id);

      if (el.type === 'navigation' && el.navType === 'hamburger') {
        hasHamburgerMenu = true;
      }

      if (el.style.position === 'fixed') {
        if (el.anchorY === 'bottom') {
          fixedSelectorsBottom.push(`#${selectorId}`);
        } else {
          fixedSelectorsTop.push(`#${selectorId}`);
        }
      } else {
        const box = getElementBoxes(el, canvasWidth, pageHeight);
        pageDesktopItems.push({
          id: selectorId,
          l: Math.round(box.marginBox.left),
          r: Math.round(box.marginBox.right),
          t: Math.round(box.marginBox.top),
          h: Math.round(box.marginBox.height),
          baseCssTop: el.anchorY === 'top' ? el.y : null,
          hiddenInit: Boolean(el.hiddenByDefault),
        });
      }

      let resolvedImgSrc = el.src || '';
      if (el.type === 'media' && el.mediaType === 'image' && el.src) {
        if (isPreview) {
          if (
            origin &&
            !el.src.startsWith('data:') &&
            !el.src.startsWith('http://') &&
            !el.src.startsWith('https://') &&
            !el.src.startsWith('blob:')
          ) {
            resolvedImgSrc = `${origin}${el.src.startsWith('/') ? '' : '/'}${el.src}`;
          } else {
            resolvedImgSrc = el.src;
          }
        } else {
          const cleanImg = getCleanExportImageName(el, selectorId);
          const wasPackaged = packagedImageIds ? packagedImageIds.has(el.id) : Boolean(cleanImg);
          if (cleanImg && wasPackaged) {
            resolvedImgSrc = `./images/${cleanImg}`;
          }
        }
      }

      pageElementMarkups.push(buildElementHtmlMarkup(el, selectorId, pages, resolvedImgSrc));
      pageCssRules.push(buildElementCssRules(el, selectorId, canvasWidth));

      const mobileMeta = mobileLayoutMap.get(el.id);
      if (mobileMeta) {
        pageMobileRules.push(buildElementMobileCssRules(el, selectorId, mobileMeta, pages));
      }

      const jsBlock = buildElementJsCode(el, selectorId, idLookup, isPreview);
      if (jsBlock) {
        jsBlocks.push(jsBlock);
      }
    }

    pageDesktopItems.sort((a, b) => a.t - b.t || a.l - b.l);
    desktopFlowByCanvas[`canvas-${pageSlug}`] = {
      baseCanvasH: pageHeight,
      autoFlow: page.autoFlow !== false,
      items: pageDesktopItems,
    };

    if (pageMobileRules.length > 0) {
      pageCssRules.push(
        `/* Smartphone Responsive Layout (<= 767px) */\n@media (max-width: 767px) {\n${pageMobileRules.join('\n\n')}\n}`
      );
    }

    cssSections.push(
      `/* ==========================================================================\n   Page: ${page.name} (${filename})\n   ========================================================================== */\n${pageCssRules.join('\n\n')}`
    );

    preparedPages.push({
      page,
      filename,
      pageSlug,
      pageElementMarkups,
    });
  }

  const cssContent = `${cssSections.join('\n\n')}\n`;

  const hasFixedElements = fixedSelectorsTop.length > 0 || fixedSelectorsBottom.length > 0;
  const fixedSyncSnippet = hasFixedElements
    ? `\n  const fixedTopEls = ${
        fixedSelectorsTop.length > 0
          ? `document.querySelectorAll('${fixedSelectorsTop.join(', ')}')`
          : '[]'
      };\n  const fixedBottomEls = ${
        fixedSelectorsBottom.length > 0
          ? `document.querySelectorAll('${fixedSelectorsBottom.join(', ')}')`
          : '[]'
      };\n  const syncFixedPositions = () => {\n    const vw = document.documentElement.clientWidth;\n    const canvas = document.querySelector('.page-canvas');\n    if (!(canvas instanceof HTMLElement)) return;\n    if (vw > MOBILE_BREAKPOINT && vw < CANVAS_WIDTH) {\n      const scale = vw / CANVAS_WIDTH;\n      const offsetTop = window.scrollY / scale;\n      fixedTopEls.forEach((el) => {\n        if (el instanceof HTMLElement) el.style.translate = \`0px \${offsetTop}px\`;\n      });\n      const offsetBottom = (window.scrollY + window.innerHeight) / scale - canvas.offsetHeight;\n      fixedBottomEls.forEach((el) => {\n        if (el instanceof HTMLElement) el.style.translate = \`0px \${offsetBottom}px\`;\n      });\n    } else {\n      fixedTopEls.forEach((el) => {\n        if (el instanceof HTMLElement) el.style.translate = '';\n      });\n      fixedBottomEls.forEach((el) => {\n        if (el instanceof HTMLElement) el.style.translate = '';\n      });\n    }\n  };`
    : '';

  const flowMapJson = JSON.stringify(desktopFlowByCanvas);

  const buildJsBody = (includePreviewBridge: boolean): string => {
    const sections: string[] = [];

    sections.push(`  // レスポンシブ制御 & テキスト増減時の縦方向自動押し下げ整列
  const CANVAS_WIDTH = ${canvasWidth};
  const MOBILE_BREAKPOINT = 767;
  const PAGE_FLOW_MAP = ${flowMapJson};${fixedSyncSnippet}

  const syncDesktopFlow = () => {
    const canvas = document.querySelector('.page-canvas');
    if (!(canvas instanceof HTMLElement)) return;
    const cfg = PAGE_FLOW_MAP[canvas.id];
    if (!cfg) return;

    const vw = document.documentElement.clientWidth;
    if (vw <= MOBILE_BREAKPOINT || !cfg.autoFlow) {
      cfg.items.forEach((item) => {
        const el = document.getElementById(item.id);
        if (el instanceof HTMLElement) el.style.top = '';
      });
      canvas.style.minHeight = '';
      return;
    }

    const zones = [];
    const appliedShifts = new Map();
    let maxBottom = cfg.baseCanvasH;

    cfg.items.forEach((item) => {
      const el = document.getElementById(item.id);
      if (!(el instanceof HTMLElement)) return;

      let shiftY = 0;
      for (let i = 0; i < zones.length; i++) {
        const z = zones[i];
        const overlapX = Math.min(item.r, z.r) - Math.max(item.l, z.l) > 4;
        if (overlapX && item.t >= z.triggerBottom - 4) {
          if (z.shiftY > shiftY) shiftY = z.shiftY;
        }
      }

      if (shiftY === 0 && item.h <= 84) {
        appliedShifts.forEach((peerShift, peerMeta) => {
          if (
            peerShift > shiftY &&
            peerMeta.h <= 84 &&
            Math.abs(item.t - peerMeta.t) <= 24 &&
            Math.max(0, Math.max(item.l - peerMeta.r, peerMeta.l - item.r)) <= 160
          ) {
            shiftY = peerShift;
          }
        });
      }

      if (item.baseCssTop !== null) {
        el.style.top = shiftY > 0 ? \`\${item.baseCssTop + shiftY}px\` : '';
      }
      if (shiftY > 0) {
        appliedShifts.set(item, shiftY);
      }

      if (!el.hidden) {
        const liveH = el.offsetHeight;
        const liveBottom = item.t + shiftY + liveH;
        if (liveBottom + 56 > maxBottom) {
          maxBottom = liveBottom + 56;
        }

        if (item.hiddenInit) {
          zones.push({
            l: item.l,
            r: item.r,
            triggerBottom: item.t + 4,
            shiftY: shiftY + liveH + 20,
          });
        } else {
          const extraH = Math.max(0, liveH - item.h);
          if (shiftY + extraH > 0) {
            zones.push({
              l: item.l,
              r: item.r,
              triggerBottom: item.t + item.h,
              shiftY: shiftY + extraH,
            });
          }
        }
      }
    });

    canvas.style.minHeight = maxBottom > cfg.baseCanvasH ? \`\${Math.ceil(maxBottom)}px\` : '';
  };

  const syncCanvasScale = () => {
    const vw = document.documentElement.clientWidth;
    const canvas = document.querySelector('.page-canvas');
    const viewport = document.querySelector('.page-viewport');
    if (!(canvas instanceof HTMLElement) || !(viewport instanceof HTMLElement)) return;

    if (vw > MOBILE_BREAKPOINT && vw < CANVAS_WIDTH) {
      const scale = vw / CANVAS_WIDTH;
      viewport.style.justifyContent = 'flex-start';
      canvas.style.transform = \`scale(\${scale})\`;
      viewport.style.height = \`\${Math.ceil(canvas.offsetHeight * scale)}px\`;
    } else {
      viewport.style.justifyContent = vw <= MOBILE_BREAKPOINT ? 'flex-start' : 'center';
      canvas.style.transform = '';
      viewport.style.height = '';
    }${hasFixedElements ? '\n    syncFixedPositions();' : ''}
  };

  const syncLayout = () => {
    syncDesktopFlow();
    syncCanvasScale();
  };

  syncLayout();
  window.addEventListener('resize', syncLayout);
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(syncLayout);
  }
  if (typeof ResizeObserver !== 'undefined') {
    let rafId = 0;
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(syncLayout);
    });
    const canvasEl = document.querySelector('.page-canvas');
    if (canvasEl) {
      Array.from(canvasEl.children).forEach((child) => ro.observe(child));
    }
  }${
    hasFixedElements
      ? "\n  window.addEventListener('scroll', syncFixedPositions, { passive: true });"
      : ''
  }`);

    if (hasHamburgerMenu) {
      sections.push(`  // ハンバーガーメニューの開閉制御
  const triggers = document.querySelectorAll('.hamburger-trigger');
  triggers.forEach((trigger) => {
    trigger.addEventListener('click', (event) => {
      event.stopPropagation();
      const drawerId = trigger.getAttribute('aria-controls');
      const drawer = drawerId ? document.getElementById(drawerId) : null;
      if (!drawer) return;

      const isExpanded = trigger.getAttribute('aria-expanded') === 'true';
      trigger.setAttribute('aria-expanded', String(!isExpanded));
      drawer.hidden = isExpanded;
    });
  });

  document.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof Element) || !target.closest('.hamburger-nav')) {
      document.querySelectorAll('.hamburger-trigger').forEach((trigger) => {
        trigger.setAttribute('aria-expanded', 'false');
      });
      document.querySelectorAll('.hamburger-drawer').forEach((drawer) => {
        if (drawer instanceof HTMLElement) {
          drawer.hidden = true;
        }
      });
    }
  });`);
    }

    if (jsBlocks.length > 0) {
      const indentedBlocks = jsBlocks
        .map((block) =>
          block
            .split('\n')
            .map((line) => `  ${line}`)
            .join('\n')
        )
        .join('\n\n');
      sections.push(`  // 要素のイベントリスナー\n${indentedBlocks}`);
    }

    if (includePreviewBridge) {
      sections.push(`  // エディタ内プレビュー用ページ遷移ブリッジ
  window.alert = (msg) => {
    window.parent.postMessage({ type: 'WEBSIDE_TOAST', message: String(msg) }, '*');
  };
  document.addEventListener('click', (event) => {
    const target = event.target instanceof Element ? event.target.closest('a') : null;
    if (!target) return;
    const href = target.getAttribute('href') || '';
    if (href === '#') {
      event.preventDefault();
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    if (href.startsWith('#')) {
      event.preventDefault();
      const sec = document.getElementById(href.slice(1));
      if (sec) sec.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    if (href.endsWith('.html')) {
      event.preventDefault();
      const cleanFile = href.replace(/^\\.\\//, '');
      window.parent.postMessage({ type: 'WEBSIDE_NAVIGATE_FILE', filename: cleanFile }, '*');
      return;
    }
    if (href.startsWith('http://') || href.startsWith('https://')) {
      event.preventDefault();
      window.parent.postMessage({ type: 'WEBSIDE_TOAST', message: '外部リンク: ' + href }, '*');
    }
  });`);
    }

    return `document.addEventListener('DOMContentLoaded', () => {\n${sections.join('\n\n')}\n});\n`;
  };

  const jsContent = buildJsBody(false);
  const previewJsContent = isPreview ? buildJsBody(true) : '';

  const htmlFiles: GeneratedHtmlFile[] = preparedPages.map(
    ({ page, filename, pageSlug, pageElementMarkups }) => {
      const headLines = isPreview
        ? [
            '  <meta charset="UTF-8">',
            '  <meta name="viewport" content="width=device-width, initial-scale=1.0">',
            `  <title>${escapeHtml(page.name)}</title>`,
            fontLinks,
            `  <style>\n${cssContent}  </style>`,
          ]
            .filter(Boolean)
            .join('\n')
        : [
            '  <meta charset="UTF-8">',
            '  <meta name="viewport" content="width=device-width, initial-scale=1.0">',
            `  <title>${escapeHtml(page.name)}</title>`,
            fontLinks,
            '  <link rel="stylesheet" href="./css/style.css">',
            '  <script src="./js/main.js" defer></script>',
          ]
            .filter(Boolean)
            .join('\n');

      const bodyInner =
        pageElementMarkups.length > 0
          ? pageElementMarkups.map((markup) => `      ${markup}`).join('\n')
          : '      <!-- 要素がありません -->';

      const htmlContent = [
        '<!DOCTYPE html>',
        '<html lang="ja">',
        '<head>',
        headLines,
        '</head>',
        `<body class="page-${pageSlug}">`,
        '  <div class="page-viewport">',
        `    <main id="canvas-${pageSlug}" class="page-canvas">`,
        bodyInner,
        '    </main>',
        '  </div>',
        isPreview ? `  <script>\n${previewJsContent}  </script>` : '',
        '</body>',
        '</html>',
        '',
      ]
        .filter((line) => line !== '')
        .join('\n');

      return {
        pageId: page.id,
        pageName: page.name,
        filename,
        content: htmlContent,
      };
    }
  );

  return {
    htmlFiles,
    cssContent,
    jsContent,
  };
}

export const generateWebsiteBundle = async (
  pages: Page[],
  canvasWidth = 1280,
  defaultCanvasHeight = 800
) => {
  const zip = new JSZip();
  const cssFolder = zip.folder('css');
  const jsFolder = zip.folder('js');
  const imgFolder = zip.folder('images');

  const { elementSelectorMap } = buildSelectorMaps(pages);
  const packagedImageIds = new Set<string>();

  for (const page of pages) {
    for (const el of page.elements) {
      const selectorId = elementSelectorMap.get(el.id) || sanitizeHtmlId(el.htmlId, el.id);

      if (el.type === 'media' && el.mediaType === 'image' && el.src && imgFolder) {
        const cleanFilename = getCleanExportImageName(el, selectorId);
        if (!cleanFilename) continue;

        if (isDataImageUri(el.src)) {
          imgFolder.file(cleanFilename, dataURItoBlob(el.src));
          packagedImageIds.add(el.id);
        } else {
          try {
            const resp = await fetch(el.src);
            if (resp.ok) {
              const blob = await resp.blob();
              imgFolder.file(cleanFilename, blob);
              packagedImageIds.add(el.id);
            }
          } catch {
            // External CORS-protected URL falls back to original el.src in HTML
          }
        }
      }
    }
  }

  const generated = generateSiteFiles(pages, canvasWidth, defaultCanvasHeight, {
    packagedImageIds,
  });

  for (const htmlFile of generated.htmlFiles) {
    zip.file(htmlFile.filename, htmlFile.content);
  }
  cssFolder?.file('style.css', generated.cssContent);
  jsFolder?.file('main.js', generated.jsContent);

  return zip.generateAsync({ type: 'blob' });
};

export const downloadBundle = async (
  pages: Page[],
  canvasWidth = 1280,
  defaultCanvasHeight = 800
) => {
  const content = await generateWebsiteBundle(pages, canvasWidth, defaultCanvasHeight);
  const url = URL.createObjectURL(content);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'webside_project.zip';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};