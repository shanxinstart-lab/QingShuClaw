import React, { useEffect, useState } from 'react';

import type { Artifact } from '@/types/artifact';

interface HtmlRendererProps {
  artifact: Artifact;
}

const HtmlRenderer: React.FC<HtmlRendererProps> = ({ artifact }) => {
  const [processedHtml, setProcessedHtml] = useState<string | null>(null);

  useEffect(() => {
    if (!artifact.content) {
      setProcessedHtml(null);
      return;
    }

    let cancelled = false;

    const process = async () => {
      try {
        let html = artifact.content;
        if (artifact.filePath) {
          html = await inlineLocalResources(html, artifact.filePath);
        }
        if (!cancelled) setProcessedHtml(html);
      } catch {
        if (!cancelled) setProcessedHtml(artifact.content);
      }
    };

    process();
    return () => { cancelled = true; };
  }, [artifact.content, artifact.filePath]);

  if (!artifact.content) {
    return (
      <div className="flex items-center justify-center h-full text-muted text-sm">
        Loading...
      </div>
    );
  }

  return (
    <iframe
      srcDoc={processedHtml || artifact.content}
      className="w-full h-full border-0"
      sandbox="allow-scripts"
      title={artifact.title}
    />
  );
};

async function readLocalFileAsDataUrl(absPath: string): Promise<string | null> {
  if (typeof window.electron?.dialog?.readFileAsDataUrl !== 'function') return null;
  try {
    const res = await window.electron.dialog.readFileAsDataUrl(absPath);
    return res?.success && res.dataUrl ? res.dataUrl : null;
  } catch {
    return null;
  }
}

function resolveRelativePath(src: string, htmlDir: string): string | null {
  if (!src || src.startsWith('http://') || src.startsWith('https://') || src.startsWith('data:') || src.startsWith('blob:')) {
    return null;
  }
  return src.startsWith('/') ? src : htmlDir + src;
}

async function inlineLocalResources(html: string, filePath: string): Promise<string> {
  const lastSlash = Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\'));
  if (lastSlash <= 0) return html;
  const dir = filePath.slice(0, lastSlash + 1);

  const srcAttrs = /(?:src|data)=["']([^"']+)["']/gi;
  const matches = [...html.matchAll(srcAttrs)];
  const replacements: Array<[string, string]> = [];

  for (const match of matches) {
    const originalSrc = match[1];
    const absPath = resolveRelativePath(originalSrc, dir);
    if (!absPath) continue;

    const dataUrl = await readLocalFileAsDataUrl(absPath);
    if (dataUrl) {
      replacements.push([originalSrc, dataUrl]);
    }
  }

  let result = html;
  for (const [original, replacement] of replacements) {
    result = result.split(original).join(replacement);
  }

  return result;
}

export default HtmlRenderer;
