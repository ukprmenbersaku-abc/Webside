import React, { useMemo, useState } from 'react';
import { Check, Code2, Copy, Download, FileCode, Palette, Zap, X } from 'lucide-react';
import { Page } from '../types';
import { generateSiteFiles } from '../utils/codeGenerator';

interface CodeModalProps {
  pages: Page[];
  activePageId: string;
  canvasWidth: number;
  canvasHeight: number;
  onClose: () => void;
  onExportZip: () => void;
}

const CodeModal: React.FC<CodeModalProps> = ({
  pages,
  activePageId,
  canvasWidth,
  canvasHeight,
  onClose,
  onExportZip,
}) => {
  const generated = useMemo(
    () => generateSiteFiles(pages, canvasWidth, canvasHeight),
    [pages, canvasWidth, canvasHeight]
  );

  const initialHtmlTab =
    generated.htmlFiles.find((f) => f.pageId === activePageId)?.filename ||
    generated.htmlFiles[0]?.filename ||
    'index.html';

  const [selectedFile, setSelectedFile] = useState<string>(initialHtmlTab);
  const [copied, setCopied] = useState(false);

  const fileEntries = useMemo(() => {
    const list: {
      key: string;
      title: string;
      subtitle: string;
      lang: 'HTML' | 'CSS' | 'JS';
      content: string;
    }[] = [];

    for (const hf of generated.htmlFiles) {
      const matchedPage = pages.find((p) => p.id === hf.pageId);
      list.push({
        key: hf.filename,
        title: matchedPage ? `${matchedPage.name}（HTML）` : 'ページ本体（HTML）',
        subtitle: 'ページの文章・パーツ構造',
        lang: 'HTML',
        content: hf.content,
      });
    }
    list.push({
      key: 'css/style.css',
      title: 'デザイン・見た目（CSS）',
      subtitle: '色・文字・余白・スマホ対応',
      lang: 'CSS',
      content: generated.cssContent,
    });
    list.push({
      key: 'js/main.js',
      title: '動き・クリック処理（JS）',
      subtitle: 'メニュー開閉・スクロール動作',
      lang: 'JS',
      content: generated.jsContent,
    });
    return list;
  }, [generated, pages]);

  const currentFile = fileEntries.find((f) => f.key === selectedFile) || fileEntries[0];
  const lines = currentFile.content.split('\n');

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(currentFile.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard fallback ignored cleanly
    }
  };

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center p-6 bg-slate-950/50 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        className="bg-white border border-slate-200 rounded-xl shadow-2xl w-full max-w-5xl h-[82vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between shrink-0 bg-slate-50 gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Code2 size={18} className="text-indigo-600 shrink-0" />
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-slate-900">
                自動生成されたWebコード（HTML / CSS / JavaScript）
              </h2>
              <p className="text-[11px] text-slate-500 truncate">
                「サイトを書き出し」を押すと、画像・動画・音声ファイルも含めてそのまま公開できる一式（ZIP）に自動でまとめられます
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors whitespace-nowrap shrink-0"
            >
              {copied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
              <span>{copied ? 'コピーしました' : '表示中のコードをコピー'}</span>
            </button>
            <button
              type="button"
              onClick={onExportZip}
              className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
            >
              <Download size={14} />
              <span>サイトを書き出し (ZIP)</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-lg transition-colors"
              aria-label="閉じる"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Category Sidebar + Code Area */}
        <div className="flex flex-1 min-h-0">
          <div className="w-60 border-r border-slate-200 bg-slate-50/70 p-3 flex flex-col gap-1.5 overflow-y-auto shrink-0">
            <div className="px-2 py-1 text-[11px] font-medium text-slate-500">
              コードの種類を切り替え
            </div>
            {fileEntries.map((entry) => {
              const isActive = entry.key === currentFile.key;
              return (
                <button
                  type="button"
                  key={entry.key}
                  onClick={() => setSelectedFile(entry.key)}
                  className={`w-full flex flex-col gap-0.5 px-3 py-2.5 rounded-lg transition-colors text-left ${
                    isActive
                      ? 'bg-indigo-50 text-indigo-700 border border-indigo-200/80'
                      : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900 border border-transparent'
                  }`}
                >
                  <div className="w-full flex items-center gap-2">
                    {entry.lang === 'HTML' ? (
                      <FileCode size={14} className="text-orange-500 shrink-0" />
                    ) : entry.lang === 'CSS' ? (
                      <Palette size={14} className="text-sky-500 shrink-0" />
                    ) : (
                      <Zap size={14} className="text-amber-500 shrink-0" />
                    )}
                    <span className="truncate text-xs font-semibold">{entry.title}</span>
                  </div>
                  <span className="text-[10px] text-slate-500 pl-5 truncate">
                    {entry.subtitle}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Code Viewer */}
          <div className="flex-1 bg-slate-950 text-slate-100 overflow-auto font-mono text-xs leading-relaxed">
            <div className="min-w-full inline-block py-4">
              {lines.map((line, idx) => (
                <div key={idx} className="flex hover:bg-slate-900/80 px-4">
                  <span className="w-10 pr-4 text-right text-slate-600 select-none shrink-0 tabular-nums">
                    {idx + 1}
                  </span>
                  <pre className="m-0 whitespace-pre text-slate-200 font-mono">{line || ' '}</pre>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CodeModal;
