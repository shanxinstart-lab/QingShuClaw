import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';

import { i18nService } from '@/services/i18n';
import type { RootState } from '@/store';
import {
  closePanel,
  MAX_PANEL_WIDTH,
  MIN_PANEL_WIDTH,
  selectActiveTab,
  selectArtifact,
  selectPanelWidth,
  selectSelectedArtifact,
  setActiveTab,
  setPanelWidth,
} from '@/store/slices/artifactSlice';
import type { ArtifactType } from '@/types/artifact';
import type { Artifact } from '@/types/artifact';
import { PREVIEWABLE_ARTIFACT_TYPES } from '@/types/artifact';

import ArtifactRenderer from './ArtifactRenderer';
import FileDirectoryView from './FileDirectoryView';
import CodeRenderer from './renderers/CodeRenderer';

const t = (key: string) => i18nService.t(key);

const BROWSER_OPENABLE_TYPES = new Set<ArtifactType>(['html', 'svg', 'mermaid']);

const SYSTEM_OPENABLE_TYPES = new Set<ArtifactType>(['document']);

function buildBrowserHtml(artifact: Artifact): string | null {
  switch (artifact.type) {
    case 'html':
      return artifact.content;
    case 'svg':
      return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${artifact.title}</title><style>body{margin:0;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#f5f5f5}</style></head><body>${artifact.content}</body></html>`;
    case 'mermaid':
      return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${artifact.title}</title><script src="https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js"><\/script><style>body{margin:0;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#fff;font-family:system-ui,sans-serif}</style></head><body><pre class="mermaid">${escapeHtml(artifact.content)}</pre><script>mermaid.initialize({startOnLoad:true,theme:'default',securityLevel:'loose'});<\/script></body></html>`;
    default:
      return null;
  }
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

interface ArtifactPanelProps {
  artifacts: Artifact[];
}

const ArtifactPanel: React.FC<ArtifactPanelProps> = ({ artifacts }) => {
  const dispatch = useDispatch();
  const selectedArtifact = useSelector(selectSelectedArtifact);
  const panelWidth = useSelector(selectPanelWidth);
  const activeTab = useSelector(selectActiveTab);
  const selectedArtifactId = useSelector((state: RootState) => state.artifact.selectedArtifactId);
  const [showFileList, setShowFileList] = useState(false);
  const fileListRef = useRef<HTMLDivElement>(null);
  const toggleBtnRef = useRef<HTMLButtonElement>(null);

  const previewableArtifacts = artifacts.filter(a => PREVIEWABLE_ARTIFACT_TYPES.has(a.type));

  const isResizing = useRef(false);
  const startX = useRef(0);
  const startWidth = useRef(0);

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isResizing.current = true;
    startX.current = e.clientX;
    startWidth.current = panelWidth;
    document.body.classList.add('select-none');

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!isResizing.current) return;
      const delta = startX.current - moveEvent.clientX;
      const maxAvailable = Math.max(MIN_PANEL_WIDTH, window.innerWidth - 480 - 4);
      const clampedMax = Math.min(MAX_PANEL_WIDTH, maxAvailable);
      const newWidth = Math.max(MIN_PANEL_WIDTH, Math.min(clampedMax, startWidth.current + delta));
      dispatch(setPanelWidth(newWidth));
    };

    const handleMouseUp = () => {
      isResizing.current = false;
      document.body.classList.remove('select-none');
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [panelWidth, dispatch]);

  useEffect(() => {
    return () => {
      document.body.classList.remove('select-none');
    };
  }, []);

  useEffect(() => {
    if (!showFileList) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        fileListRef.current && !fileListRef.current.contains(e.target as Node) &&
        toggleBtnRef.current && !toggleBtnRef.current.contains(e.target as Node)
      ) {
        setShowFileList(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showFileList]);

  const handleClose = useCallback(() => dispatch(closePanel()), [dispatch]);
  const handleSelectArtifact = useCallback((id: string) => {
    dispatch(selectArtifact(id));
    setShowFileList(false);
  }, [dispatch]);

  const handleCopy = useCallback(async () => {
    if (selectedArtifact) {
      await navigator.clipboard.writeText(selectedArtifact.content);
      window.dispatchEvent(new CustomEvent('app:showToast', { detail: t('messageCopied') }));
    }
  }, [selectedArtifact]);

  const handleRevealInFolder = useCallback(() => {
    if (!selectedArtifact?.filePath) return;
    window.electron?.shell?.showItemInFolder(selectedArtifact.filePath);
  }, [selectedArtifact]);

  const handleOpenInBrowser = useCallback(() => {
    if (!selectedArtifact) return;

    // Has file on disk: open directly
    if (selectedArtifact.filePath) {
      const fileUrl = `file://${selectedArtifact.filePath}`;
      window.electron?.shell?.openExternal(fileUrl);
      return;
    }

    // No file path: generate HTML and open via temp file
    if (!selectedArtifact.content) return;
    const html = buildBrowserHtml(selectedArtifact);
    if (html) {
      window.electron?.shell?.openHtmlInBrowser(html);
    }
  }, [selectedArtifact]);

  const handleOpenWithApp = useCallback(() => {
    if (selectedArtifact?.filePath) {
      let filePath = selectedArtifact.filePath;
      if (filePath.startsWith('file:///')) {
        filePath = filePath.slice(7);
      } else if (filePath.startsWith('file://')) {
        filePath = filePath.slice(7);
      } else if (filePath.startsWith('file:/')) {
        filePath = filePath.slice(5);
      }
      // Strip leading / before Windows drive letter
      if (/^\/[A-Za-z]:/.test(filePath)) {
        filePath = filePath.slice(1);
      }
      window.electron?.shell?.openPath(filePath);
    }
  }, [selectedArtifact]);

  return (
    <>
      {/* Drag handle */}
      <div
        className="w-1 shrink-0 cursor-col-resize hover:bg-primary/30 active:bg-primary/50 transition-colors"
        onMouseDown={handleResizeStart}
      />
      <aside
        style={{ width: panelWidth, maxWidth: 'calc(100vw - 480px - 4px)' }}
        className="shrink border-l border-border bg-background flex flex-col h-full overflow-hidden relative"
      >
        {/* Floating file list overlay */}
        {showFileList && (
          <div
            ref={fileListRef}
            className="absolute top-10 right-2 z-20 w-[240px] max-h-[60%] bg-background border border-border rounded-lg shadow-lg flex flex-col overflow-hidden"
          >
            <div className="h-9 flex items-center px-3 border-b border-border shrink-0">
              <span className="text-xs font-medium text-secondary">{t('artifactFileList')}</span>
            </div>
            <FileDirectoryView
              artifacts={previewableArtifacts}
              selectedId={selectedArtifactId}
              onSelect={handleSelectArtifact}
              compact
            />
          </div>
        )}

        {selectedArtifact ? (
          <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
            {/* Header: file list toggle + filename + type + actions */}
            <div className="h-10 flex items-center gap-2 px-3 border-b border-border shrink-0">
              <span className="text-sm font-medium truncate">{selectedArtifact.fileName || selectedArtifact.title}</span>
              <span className="flex-1" />
              {selectedArtifact.type !== 'document' && (
                <button
                  onClick={handleCopy}
                  className="p-1 rounded text-secondary hover:text-foreground hover:bg-surface transition-colors"
                  title={t('artifactCopyCode')}
                >
                  <CopyIcon />
                </button>
              )}
              {BROWSER_OPENABLE_TYPES.has(selectedArtifact.type) && (
                <button
                  onClick={handleOpenInBrowser}
                  className="p-1 rounded text-secondary hover:text-foreground hover:bg-surface transition-colors"
                  title={t('artifactOpenInBrowser')}
                >
                  <BrowserIcon />
                </button>
              )}
              {SYSTEM_OPENABLE_TYPES.has(selectedArtifact.type) && selectedArtifact.filePath && (
                <button
                  onClick={handleOpenWithApp}
                  className="p-1 rounded text-secondary hover:text-foreground hover:bg-surface transition-colors"
                  title={t('artifactOpenWithApp')}
                >
                  <OpenExternalIcon />
                </button>
              )}
              {selectedArtifact.filePath && (
                <button
                  onClick={handleRevealInFolder}
                  className="p-1 rounded text-secondary hover:text-foreground hover:bg-surface transition-colors"
                  title={t('artifactOpenFolder')}
                >
                  <FolderIcon />
                </button>
              )}
              <button
                ref={toggleBtnRef}
                onClick={() => setShowFileList(v => !v)}
                className={`p-1 rounded transition-colors ${
                  showFileList
                    ? 'text-primary bg-primary/10'
                    : 'text-secondary hover:text-foreground hover:bg-surface'
                }`}
                title={t('artifactFileList')}
              >
                <FileListIcon />
              </button>
            </div>

            {/* Preview/Code tabs */}
            <div className="flex border-b border-border shrink-0">
              <button
                onClick={() => dispatch(setActiveTab('preview'))}
                className={`px-3 py-1.5 text-xs font-medium transition-colors border-b-2 ${
                  activeTab === 'preview'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-secondary hover:text-foreground'
                }`}
              >
                {t('artifactPreview')}
              </button>
              <button
                onClick={() => dispatch(setActiveTab('code'))}
                className={`px-3 py-1.5 text-xs font-medium transition-colors border-b-2 ${
                  activeTab === 'code'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-secondary hover:text-foreground'
                }`}
              >
                {t('artifactCode')}
              </button>
            </div>

            {/* Render area */}
            <div className="flex-1 min-h-0 overflow-hidden">
              {activeTab === 'preview' ? (
                <ArtifactRenderer artifact={selectedArtifact} sessionArtifacts={artifacts} />
              ) : (
                <CodeRenderer artifact={selectedArtifact} />
              )}
            </div>
          </div>
        ) : (
          /* No artifact selected: show full-width file list */
          <div className="flex-1 flex flex-col h-full overflow-hidden">
            <div className="h-10 flex items-center px-3 border-b border-border shrink-0">
              <span className="text-xs font-medium text-secondary">{t('artifactFiles')}</span>
              <span className="flex-1" />
              <button
                onClick={handleClose}
                className="p-1 rounded text-secondary hover:text-foreground hover:bg-surface transition-colors"
              >
                <CloseIcon />
              </button>
            </div>
            <FileDirectoryView
              artifacts={previewableArtifacts}
              selectedId={selectedArtifactId}
              onSelect={handleSelectArtifact}
            />
          </div>
        )}
      </aside>
    </>
  );
};

const CopyIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="5.5" y="5.5" width="8" height="8" rx="1.5" />
    <path d="M10.5 5.5V3.5a1.5 1.5 0 00-1.5-1.5H3.5A1.5 1.5 0 002 3.5V9a1.5 1.5 0 001.5 1.5h2" />
  </svg>
);

const FolderIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 4.5A1.5 1.5 0 013.5 3h2.879a1.5 1.5 0 011.06.44l.622.62a1.5 1.5 0 001.06.44H12.5A1.5 1.5 0 0114 6v5.5a1.5 1.5 0 01-1.5 1.5h-9A1.5 1.5 0 012 11.5v-7z" />
  </svg>
);

const BrowserIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="8" cy="8" r="6" />
    <ellipse cx="8" cy="8" rx="2.5" ry="6" />
    <path d="M2 8h12" />
  </svg>
);

const OpenExternalIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 9v3.5a1.5 1.5 0 01-1.5 1.5h-7A1.5 1.5 0 012 12.5v-7A1.5 1.5 0 013.5 4H7" />
    <path d="M10 2h4v4" />
    <path d="M7 9l7-7" />
  </svg>
);

const CloseIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
    <path d="M4 4l8 8M12 4l-8 8" />
  </svg>
);

const FileListIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 3.167c0-.644.522-1.167 1.167-1.167h2.48c.323 0 .635.117.878.33l.58.507c.243.213.555.33.878.33h3.35C13.07 3.167 13.667 3.764 13.667 4.5v5.945c0 .49-.398.889-.889.889" />
    <path d="M2 6c0-.736.597-1.333 1.334-1.333h2.313c.323 0 .635.117.878.33l.58.507c.243.213.555.33.877.33h3.351c.737 0 1.334.597 1.334 1.334v4.833c0 .737-.597 1.333-1.334 1.333H3.334C2.597 13.333 2 12.737 2 12V6z" />
  </svg>
);

export default ArtifactPanel;
