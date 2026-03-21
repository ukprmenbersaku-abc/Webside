export type ElementType = 'text' | 'rectangle' | 'circle' | 'media' | 'button' | 'navigation';

export type AnchorX = 'left' | 'center' | 'right';
export type AnchorY = 'top' | 'center' | 'bottom';

export interface MenuItem {
  id: string;
  label: string;
  link: string;
  position?: 'left' | 'right'; 
}

export interface EditorElement {
  id: string;
  type: ElementType;
  x: number; 
  y: number;
  anchorX: AnchorX;
  anchorY: AnchorY;
  width: number;
  height: number;
  content?: string;
  svgContent?: string;
  mediaType?: 'image' | 'svg';
  navType?: 'horizontal' | 'hamburger';
  menuItems?: MenuItem[];
  hoverEffect?: 'none' | 'opacity' | 'scale' | 'lift';
  style: {
    backgroundColor?: string;
    color?: string;
    fontSize?: number;
    fontWeight?: string;
    fontFamily?: string;
    borderRadius?: number;
    borderWidth?: number;
    borderColor?: string;
    textAlign?: 'left' | 'center' | 'right';
    opacity?: number;
    zIndex?: number;
    boxShadow?: string;
    gap?: number;
    padding?: number;
    margin?: number;
    cursor?: 'auto' | 'pointer' | 'text' | 'move' | 'default';
  };
  src?: string;
  imageName?: string;
  link?: string; // Can be a URL or a Page ID
  linkType?: 'url' | 'page'; // Distinguish between external URL and internal page link
}

export interface SmartGuide {
  type: 'x' | 'y';
  pos: number;
}

export interface Page {
  id: string;
  name: string;
  elements: EditorElement[];
}

export const PRESET_COLORS = [
  '#ffffff', '#000000', '#ef4444', '#f97316', '#f59e0b', 
  '#84cc16', '#10b981', '#06b6d4', '#3b82f6', '#6366f1', 
  '#8b5cf6', '#d946ef', '#f43f5e', '#64748b'
];