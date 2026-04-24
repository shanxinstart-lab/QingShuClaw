import React, { useEffect, useState } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';

import type { Artifact } from '@/types/artifact';

const MAX_HIGHLIGHT_SIZE = 50_000;

function useIsDark() {
  const [isDark, setIsDark] = useState(() =>
    document.documentElement.classList.contains('dark')
  );
  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains('dark'));
    });
    observer.observe(document.documentElement, { attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);
  return isDark;
}

const LANGUAGE_MAP: Record<string, string> = {
  html: 'html',
  svg: 'xml',
  mermaid: 'markdown',
  react: 'jsx',
  jsx: 'jsx',
  tsx: 'tsx',
};

interface CodeRendererProps {
  artifact: Artifact;
}

const CodeRenderer: React.FC<CodeRendererProps> = ({ artifact }) => {
  const isDark = useIsDark();

  if (!artifact.content) {
    return (
      <div className="flex items-center justify-center h-full text-muted text-sm">
        No content
      </div>
    );
  }

  if (artifact.content.length > MAX_HIGHLIGHT_SIZE) {
    return (
      <div className="h-full overflow-auto">
        <pre className={`text-xs font-mono leading-relaxed p-4 m-0 whitespace-pre-wrap break-words ${
          isDark ? 'bg-[#282c34] text-[#abb2bf]' : 'bg-[#f0f2f5] text-[#383a42]'
        }`}>
          {artifact.content}
        </pre>
      </div>
    );
  }

  const language = artifact.language || LANGUAGE_MAP[artifact.type] || 'text';
  const style = isDark ? oneDark : oneLight;

  return (
    <div className="h-full overflow-auto">
      <SyntaxHighlighter
        language={language}
        style={style}
        showLineNumbers
        customStyle={{
          margin: 0,
          borderRadius: 0,
          fontSize: '13px',
          lineHeight: '1.5',
          minHeight: '100%',
        }}
      >
        {artifact.content}
      </SyntaxHighlighter>
    </div>
  );
};

export default CodeRenderer;
