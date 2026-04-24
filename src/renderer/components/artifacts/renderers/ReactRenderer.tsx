import React, { useMemo } from 'react';

import type { Artifact } from '@/types/artifact';

interface ReactRendererProps {
  artifact: Artifact;
}

function buildReactIframeHtml(jsxSource: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    body { margin: 0; font-family: system-ui, -apple-system, sans-serif; }
    #root { padding: 16px; }
    .error { color: #ef4444; padding: 16px; font-family: monospace; white-space: pre-wrap; }
  </style>
  <script src="https://unpkg.com/react@18/umd/react.production.min.js"><\/script>
  <script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"><\/script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"><\/script>
</head>
<body>
  <div id="root"></div>
  <script type="text/babel" data-type="module">
    try {
      ${jsxSource}

      const components = {};
      try { components.App = App; } catch(e) {}
      try { components.default = typeof exports !== 'undefined' ? exports.default : undefined; } catch(e) {}

      const Component = components.App || components.default || (() => React.createElement('div', {className: 'error'}, 'No App component found'));
      ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(Component));
    } catch (err) {
      document.getElementById('root').innerHTML = '<div class="error">' + err.message + '</div>';
    }
  <\/script>
</body>
</html>`;
}

const ReactRenderer: React.FC<ReactRendererProps> = ({ artifact }) => {
  const iframeHtml = useMemo(() => buildReactIframeHtml(artifact.content), [artifact.content]);

  return (
    <iframe
      className="w-full h-full border-0"
      srcDoc={iframeHtml}
      sandbox="allow-scripts"
      title={artifact.title}
    />
  );
};

export default ReactRenderer;
