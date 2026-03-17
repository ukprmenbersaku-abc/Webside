import { Page, EditorElement } from '../types';
import JSZip from 'jszip';

// Helper to check if a string is a base64 data URI
const isBase64 = (str: string) => str.startsWith('data:');

// Helper to convert data URI to Blob
const dataURItoBlob = (dataURI: string) => {
  const byteString = atob(dataURI.split(',')[1]);
  const mimeString = dataURI.split(',')[0].split(':')[1].split(';')[0];
  const ab = new ArrayBuffer(byteString.length);
  const ia = new Uint8Array(ab);
  for (let i = 0; i < byteString.length; i++) {
    ia[i] = byteString.charCodeAt(i);
  }
  return new Blob([ab], { type: mimeString });
};

// Generate HTML for a single page
const generatePageHtml = async (page: Page, allPages: Page[], imgFolder: JSZip | null) => {
    
    // Collection for element specific styles (e.g. hover effects)
    const elementCssRules: string[] = [];

    // Process elements to handle images and generate HTML
    const processedHtmlPromises = page.elements.map(async (el) => {
        let srcAttr = '';
        
        // Handle Media Export Logic
        if (el.type === 'media' && el.mediaType === 'image' && el.src) {
            if (isBase64(el.src) && imgFolder) {
                // It's a local uploaded image (base64)
                const extension = el.src.substring("data:image/".length, el.src.indexOf(";base64"));
                const filename = el.imageName || `image_${el.id}.${extension}`;
                const cleanFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_'); // Safety
                
                imgFolder.file(cleanFilename, dataURItoBlob(el.src));
                srcAttr = `./images/${cleanFilename}`;
            } else {
                // It's a remote URL
                srcAttr = el.src;
            }
        }

        // Generate CSS styles
        const styles: string[] = [
            `width: ${el.width}px`,
            `height: ${el.height}px`,
            `z-index: ${el.style.zIndex || 1}`,
            `opacity: ${el.style.opacity || 1}`,
        ];

        // Cursor logic
        if (el.style.cursor && el.style.cursor !== 'auto') {
            styles.push(`cursor: ${el.style.cursor}`);
        } else if (el.link) {
            styles.push(`cursor: pointer`);
        }

        if (el.anchorX === 'left') {
            styles.push(`left: ${el.x}px`);
        } else if (el.anchorX === 'right') {
            styles.push(`right: ${el.x}px`);
        } else if (el.anchorX === 'center') {
            styles.push(`left: 50%`);
            styles.push(`margin-left: ${el.x}px`); 
            styles.push(`transform: translateX(-50%)`);
        }

        let transformString = el.anchorX === 'center' ? 'translateX(-50%)' : '';

        if (el.anchorY === 'top') {
            styles.push(`top: ${el.y}px`);
        } else if (el.anchorY === 'bottom') {
            styles.push(`bottom: ${el.y}px`);
        } else if (el.anchorY === 'center') {
            styles.push(`top: 50%`);
            styles.push(`margin-top: ${el.y}px`);
            transformString += transformString ? ' translateY(-50%)' : 'translateY(-50%)';
        }

        if (transformString) {
            const idx = styles.findIndex(s => s.startsWith('transform:'));
            if (idx !== -1) styles.splice(idx, 1);
            styles.push(`transform: ${transformString}`);
        }

        if (el.style.backgroundColor) styles.push(`background-color: ${el.style.backgroundColor}`);
        if (el.style.color) styles.push(`color: ${el.style.color}`);
        if (el.style.fontSize) styles.push(`font-size: ${el.style.fontSize}px`);
        if (el.style.fontWeight) styles.push(`font-weight: ${el.style.fontWeight}`);
        if (el.style.fontFamily) styles.push(`font-family: ${el.style.fontFamily}`);
        if (el.style.borderRadius) styles.push(`border-radius: ${el.style.borderRadius}px`);
        if (el.style.borderWidth) styles.push(`border: ${el.style.borderWidth}px solid ${el.style.borderColor || 'black'}`);
        if (el.style.textAlign) styles.push(`text-align: ${el.style.textAlign}`);
        if (el.style.boxShadow) styles.push(`box-shadow: ${el.style.boxShadow}`);
        
        // Generate Hover CSS
        if (el.hoverEffect && el.hoverEffect !== 'none') {
            const elIdSelector = `#${el.id}`;
            let hoverCss = `${elIdSelector}:hover { `;
            
            if (el.hoverEffect === 'opacity') {
                hoverCss += `opacity: ${(el.style.opacity || 1) * 0.7}; `;
            } else if (el.hoverEffect === 'scale') {
                // Must append scale to existing transform to preserve positioning
                hoverCss += `transform: ${transformString} scale(1.05); `;
            } else if (el.hoverEffect === 'lift') {
                // Combine transform and shadow
                const baseShadow = el.style.boxShadow || '';
                const liftShadow = baseShadow ? `${baseShadow}, 0 10px 20px rgba(0,0,0,0.15)` : '0 10px 20px rgba(0,0,0,0.15)';
                let trans = transformString;
                // Add translateY manually to the string. 
                // Note: Regex checks are brittle, simplistic append usually works for CSS transforms if order doesn't flip axes drastically
                trans += ' translateY(-4px)'; 
                hoverCss += `transform: ${trans}; box-shadow: ${liftShadow}; `;
            }
            
            hoverCss += `}`;
            elementCssRules.push(hoverCss);
            
            // Add transition to base element
            styles.push(`transition: transform 0.2s ease, box-shadow 0.2s ease, opacity 0.2s ease`);
        }

        if (el.type === 'navigation' && el.navType === 'horizontal') {
            // handled internally
        } else if (el.type !== 'text') {
            styles.push(`justify-content: center`);
        } else {
            if (el.style.textAlign === 'center') styles.push('justify-content: center');
            if (el.style.textAlign === 'right') styles.push('justify-content: flex-end');
        }

        const styleString = styles.join('; ');
        const className = el.type === 'button' ? 'element btn-element' : el.type === 'text' ? 'element text-element' : 'element';

        // Content Generation based on Type
        let contentHtml = '';

        if (el.type === 'media') {
            if (el.mediaType === 'image') {
                contentHtml = `<img src="${srcAttr}" style="width: 100%; height: 100%; object-fit: cover; border-radius: inherit;" alt="Image" />`;
            } else {
                contentHtml = el.svgContent || '';
            }
        } else if (el.type === 'text') {
            contentHtml = `<div style="width: 100%; word-wrap: break-word;">${el.content || ''}</div>`;
        } else if (el.type === 'navigation') {
            const resolveLink = (link: string) => {
                if (link.startsWith('#')) {
                    const pageId = link.substring(1);
                    const targetPage = allPages.find(p => p.id === pageId);
                    return targetPage ? (targetPage.id === allPages[0].id ? './index.html' : `./${targetPage.id}.html`) : link;
                }
                const targetPage = allPages.find(p => p.id === link);
                return targetPage ? (targetPage.id === allPages[0].id ? './index.html' : `./${targetPage.id}.html`) : link;
            };

            if (el.navType === 'horizontal') {
                const gap = el.style.gap ?? 24;
                const padding = el.style.padding ?? 24;
                
                const leftItems = el.menuItems?.filter(i => (i.position || 'left') === 'left') || [];
                const rightItems = el.menuItems?.filter(i => i.position === 'right') || [];
                
                contentHtml = `
                <nav style="width: 100%; height: 100%; display: flex; align-items: center; padding: 0 ${padding}px; box-sizing: border-box; justify-content: space-between;">
                    <div style="display: flex; gap: ${gap}px; align-items: center;">
                        ${leftItems.map(item => `<a href="${resolveLink(item.link)}" class="menu-link">${item.label}</a>`).join('')}
                    </div>
                    <div style="display: flex; gap: ${gap}px; align-items: center;">
                        ${rightItems.map(item => `<a href="${resolveLink(item.link)}" class="menu-link">${item.label}</a>`).join('')}
                    </div>
                </nav>
                `;
            } else {
                const menuId = `menu-${el.id}`;
                contentHtml = `
                    <div class="hamburger-container" onclick="toggleMenu('${menuId}')" style="cursor: pointer; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center;">
                        <svg viewBox="0 0 24 24" width="60%" height="60%" stroke="${el.style.color || 'currentColor'}" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
                    </div>
                    <div id="${menuId}" class="hamburger-menu-list" style="display: none; position: absolute; top: 100%; right: 0; background: white; box-shadow: 0 4px 12px rgba(0,0,0,0.15); border-radius: 8px; padding: 8px; min-width: 180px; z-index: 1000; overflow: hidden;">
                        ${el.menuItems?.map(item => `<a href="${resolveLink(item.link)}" style="display: block; padding: 12px 16px; text-decoration: none; color: #333; font-size: 14px; transition: background 0.2s; border-radius: 4px;">${item.label}</a>`).join('')}
                    </div>
                `;
            }
        } else {
            contentHtml = `<span>${el.content || ''}</span>`;
        }
        
        let finalStyleString = styleString;
        if (el.type === 'navigation' && el.navType === 'hamburger') {
            finalStyleString = finalStyleString.replace('overflow: hidden', 'overflow: visible');
        }

        // Determine Href for general elements
        let href = '';
        if (el.linkType === 'page' && el.link) {
            const target = allPages.find(p => p.id === el.link);
            if (target) href = `./${target.id}.html`;
        } else if (el.link) {
            href = el.link;
        }

        if (href && el.type !== 'menubar' && el.type !== 'hamburger') {
            return `<a id="${el.id}" href="${href}" class="${className}" style="${finalStyleString}; text-decoration: none;">${contentHtml}</a>`;
        }

        return `<div id="${el.id}" class="${className}" style="${finalStyleString}">
        ${contentHtml}
        </div>`;
    });

    const htmlElementsArray = await Promise.all(processedHtmlPromises);
    const htmlElements = htmlElementsArray.join('\n    ');

    const scriptContent = `
        function toggleMenu(id) {
            var menu = document.getElementById(id);
            if (menu.style.display === 'none' || menu.style.display === '') {
                menu.style.display = 'block';
            } else {
                menu.style.display = 'none';
            }
        }
        document.addEventListener('click', function(event) {
            var isClickInside = event.target.closest('.hamburger-container');
            if (!isClickInside) {
                var menus = document.querySelectorAll('.hamburger-menu-list');
                menus.forEach(function(m) { m.style.display = 'none'; });
            }
        });
    `;

    const dynamicCss = elementCssRules.join('\n');

    const css = `
        * { box-sizing: border-box; }
        body { margin: 0; padding: 0; background-color: #ffffff; font-family: sans-serif; overflow-x: hidden; }
        .container { position: relative; width: 100%; max-width: 1280px; min-height: 800px; margin: 0 auto; overflow: hidden; background-color: white; box-shadow: 0 0 20px rgba(0,0,0,0.05); }
        .element { position: absolute; display: flex; align-items: center; overflow: hidden; }
        .text-element { align-items: flex-start; }
        .btn-element { justify-content: center; cursor: pointer; transition: transform 0.1s; }
        .btn-element:active { transform: scale(0.98); }
        .menu-link { text-decoration: none; color: inherit; font-weight: 500; transition: opacity 0.2s; }
        .menu-link:hover { opacity: 0.7; }
        .hamburger-menu-list a:hover { background-color: #f3f4f6; }
        
        /* Dynamic Hover Styles */
        ${dynamicCss}
    `;

    return `<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${page.name} - My Friendly Site</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Dancing+Script:wght@700&family=DotGothic16&family=Lato:wght@400;700&family=M+PLUS+1p:wght@400;700&family=Montserrat:wght@400;700&family=Noto+Sans+JP:wght@400;700&family=Open+Sans:wght@400;700&family=Roboto:wght@400;700&family=Sawarabi+Mincho&family=Yomogi&display=swap" rel="stylesheet">
    <style>${css}</style>
</head>
<body>
    <div class="container">
    ${htmlElements}
    </div>
    <script>${scriptContent}</script>
</body>
</html>`;
};

export const generateWebsiteBundle = async (pages: Page[]) => {
  const zip = new JSZip();
  const imgFolder = zip.folder("images");
  
  // Generate a file for each page
  for (const page of pages) {
      const html = await generatePageHtml(page, pages, imgFolder);
      // Main page usually becomes index.html, but for simplicity here we name them by ID.
      // Ideally, the first page is index.html
      const filename = page.id === pages[0].id ? 'index.html' : `${page.id}.html`;
      zip.file(filename, html);
  }

  return zip.generateAsync({ type: "blob" });
};

export const downloadBundle = async (pages: Page[]) => {
    try {
        const content = await generateWebsiteBundle(pages);
        const url = URL.createObjectURL(content);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'website_bundle.zip';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    } catch (e) {
        console.error("Export failed", e);
        alert("書き出し中にエラーが発生しました。");
    }
};