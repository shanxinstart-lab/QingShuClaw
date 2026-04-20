import React from 'react';

import { i18nService } from '../../services/i18n';
import McpManager from '../mcp/McpManager';
import WindowTitleBar from '../window/WindowTitleBar';

const ApplicationsView: React.FC = () => {
  const isMac = window.electron.platform === 'darwin';

  return (
    <div className="flex h-full flex-col bg-background">
      <div className="draggable flex h-12 items-center justify-between border-b border-border px-4 shrink-0">
        <div className={`min-w-0 ${isMac ? 'pl-[68px]' : ''}`}>
          <h1 className="text-lg font-semibold text-foreground">
            {i18nService.t('workbenchApplicationMcpTitle')}
          </h1>
        </div>
        <WindowTitleBar inline />
      </div>

      <div className="flex-1 overflow-y-auto min-h-0 [scrollbar-gutter:stable]">
        <div className="max-w-3xl mx-auto px-4 py-6">
          <McpManager />
        </div>
      </div>
    </div>
  );
};

export default ApplicationsView;
