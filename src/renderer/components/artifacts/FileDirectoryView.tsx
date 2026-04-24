import React from 'react';

import { i18nService } from '@/services/i18n';
import type { Artifact, ArtifactType } from '@/types/artifact';

const t = (key: string) => i18nService.t(key);

const TYPE_ICONS: Record<ArtifactType, string> = {
  html: '🌐',
  svg: '🎨',
  image: '🖼',
  mermaid: '📊',
  react: '⚛',
  code: '📄',
};

function getShortPath(filePath: string): string {
  const parts = filePath.replace(/\\/g, '/').split('/');
  return parts.length > 2
    ? `.../${parts.slice(-2).join('/')}`
    : parts.join('/');
}

interface FileDirectoryViewProps {
  artifacts: Artifact[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

const FileDirectoryView: React.FC<FileDirectoryViewProps> = ({ artifacts, selectedId, onSelect }) => {
  if (artifacts.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted text-sm p-4">
        {t('artifactEmptyFiles')}
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      {artifacts.map(artifact => (
        <div
          key={artifact.id}
          onClick={() => onSelect(artifact.id)}
          className={`flex items-center gap-2 px-3 py-2 cursor-pointer text-sm transition-colors
            ${artifact.id === selectedId ? 'bg-primary/10 text-primary' : 'hover:bg-surface text-foreground'}`}
        >
          <span className="shrink-0 text-base">{TYPE_ICONS[artifact.type] || '📄'}</span>
          <div className="flex-1 min-w-0">
            <div className="truncate">
              {artifact.fileName || artifact.title}
            </div>
            {artifact.filePath && (
              <div className="text-[10px] text-muted truncate">
                {getShortPath(artifact.filePath)}
              </div>
            )}
            {!artifact.filePath && artifact.source === 'codeblock' && (
              <div className="text-[10px] text-muted">code block</div>
            )}
          </div>
          <span className="shrink-0 text-xs text-muted uppercase">
            {artifact.type}
          </span>
        </div>
      ))}
    </div>
  );
};

export default FileDirectoryView;
