export type ElementType =
  | 'text'
  | 'rectangle'
  | 'circle'
  | 'divider'
  | 'media'
  | 'button'
  | 'navigation';

export type AnchorX = 'left' | 'center' | 'right';
export type AnchorY = 'top' | 'center' | 'bottom';

export type HtmlTagName =
  | 'h1'
  | 'h2'
  | 'h3'
  | 'h4'
  | 'p'
  | 'span'
  | 'blockquote'
  | 'div'
  | 'section'
  | 'article'
  | 'header'
  | 'footer'
  | 'main'
  | 'aside'
  | 'hr'
  | 'button'
  | 'a'
  | 'img'
  | 'video'
  | 'audio'
  | 'iframe'
  | 'nav';

export type BorderSidesMode = 'all' | 'bottom' | 'top' | 'left' | 'right' | 'y';

export type JsEventType = 'click' | 'dblclick' | 'mouseenter';
export type JsActionType =
  | 'none'
  | 'toggle-element'
  | 'scroll-to'
  | 'toggle-class'
  | 'alert'
  | 'custom';

export interface JsInteraction {
  event: JsEventType;
  action: JsActionType;
  targetId?: string;
  className?: string;
  message?: string;
  customCode?: string;
}

export interface MenuItem {
  id: string;
  label: string;
  link: string;
  position?: 'left' | 'right';
}

export interface ElementStyle {
  position?: 'absolute' | 'fixed';
  display?: 'block' | 'flex' | 'inline-flex';
  flexDirection?: 'row' | 'column';
  justifyContent?: 'flex-start' | 'center' | 'flex-end' | 'space-between';
  alignItems?: 'flex-start' | 'center' | 'flex-end' | 'stretch';
  boxSizing?: 'border-box' | 'content-box';

  backgroundColor?: string;
  backgroundImage?: string;
  backdropFilterBlur?: number;

  color?: string;
  fontSize?: number;
  fontWeight?: string;
  fontStyle?: 'normal' | 'italic';
  fontFamily?: string;
  lineHeight?: number;
  letterSpacing?: number;
  textAlign?: 'left' | 'center' | 'right' | 'justify';
  textDecoration?: 'none' | 'underline' | 'line-through';
  textTransform?: 'none' | 'uppercase' | 'lowercase';
  writingMode?: 'horizontal-tb' | 'vertical-rl';

  borderRadius?: number;
  borderRadiusUnit?: 'px' | '%';
  borderWidth?: number;
  borderStyle?: 'none' | 'solid' | 'dashed' | 'dotted' | 'double';
  borderColor?: string;
  borderSides?: BorderSidesMode;

  opacity?: number;
  zIndex?: number;
  boxShadow?: string;
  overflow?: 'visible' | 'hidden' | 'auto';
  objectFit?: 'cover' | 'contain' | 'fill' | 'none';
  gap?: number;

  rotate?: number;
  filterBrightness?: number;
  filterContrast?: number;
  filterGrayscale?: number;

  padding?: number;
  paddingTop?: number;
  paddingRight?: number;
  paddingBottom?: number;
  paddingLeft?: number;

  margin?: number;
  marginTop?: number;
  marginRight?: number;
  marginBottom?: number;
  marginLeft?: number;

  cursor?: 'auto' | 'pointer' | 'text' | 'move' | 'default';
  hoverBackgroundColor?: string;
  hoverColor?: string;
}

export interface EditorElement {
  id: string;
  htmlId?: string;
  className?: string;
  tagName?: HtmlTagName;
  type: ElementType;
  x: number;
  y: number;
  anchorX: AnchorX;
  anchorY: AnchorY;
  width: number;
  height: number;
  autoHeight?: boolean;
  locked?: boolean;
  hiddenByDefault?: boolean;
  content?: string;
  svgContent?: string;
  mediaType?: 'image' | 'svg' | 'video' | 'audio';
  mediaControls?: boolean;
  mediaAutoplay?: boolean;
  mediaLoop?: boolean;
  mediaMuted?: boolean;
  poster?: string;
  posterName?: string;
  alt?: string;
  navType?: 'horizontal' | 'hamburger';
  menuItems?: MenuItem[];
  hoverEffect?: 'none' | 'opacity' | 'scale' | 'lift';
  style: ElementStyle;
  src?: string;
  imageName?: string;
  link?: string;
  linkType?: 'url' | 'page';
  linkTarget?: '_self' | '_blank';
  buttonType?: 'button' | 'submit' | 'reset';
  interaction?: JsInteraction;
}

export interface SmartGuide {
  type: 'x' | 'y';
  pos: number;
  variant?: 'align' | 'margin';
}

export interface Page {
  id: string;
  slug?: string;
  name: string;
  height?: number;
  autoFlow?: boolean;
  backgroundColor?: string;
  elements: EditorElement[];
}

export interface SiteTemplate {
  id: string;
  name: string;
  category: string;
  description: string;
  accentColor: string;
  canvasBg: string;
  previewImage?: string;
  featuresUsed: string[];
  pages: Page[];
}

export const PRESET_COLORS = [
  '#ffffff',
  '#f8fafc',
  '#f7f4ef',
  '#e2e8f0',
  '#64748b',
  '#1e293b',
  '#0f172a',
  '#0c0e12',
  '#8c6239',
  '#ef4444',
  '#f97316',
  '#10b981',
  '#3b82f6',
  '#4f46e5',
];