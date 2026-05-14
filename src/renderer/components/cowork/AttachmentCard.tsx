import React, { useEffect, useState } from 'react';

import { i18nService } from '../../services/i18n';
import type { DraftAttachment } from '../../store/slices/coworkSlice';
import FileTypeIcon from '../icons/fileTypes/FileTypeIcon';
import { getFileTypeInfo, ImageFileIcon } from '../icons/fileTypes/index';
import XMarkIcon from '../icons/XMarkIcon';
import ImagePreviewModal, { type ImagePreviewSource } from './ImagePreviewModal';

interface AttachmentCardProps {
  attachment: DraftAttachment;
  onRemove: (path: string) => void;
}

const AttachmentCard: React.FC<AttachmentCardProps> = ({ attachment, onRemove }) => {
  if (attachment.isImage) {
    return <ImageCard attachment={attachment} onRemove={onRemove} />;
  }
  return <FileCard attachment={attachment} onRemove={onRemove} />;
};

const ImageCard: React.FC<AttachmentCardProps> = ({ attachment, onRemove }) => {
  const [thumbUrl, setThumbUrl] = useState<string | null>(attachment.dataUrl ?? null);
  const [imgError, setImgError] = useState(false);
  const [loading, setLoading] = useState(!attachment.dataUrl);
  const [previewImage, setPreviewImage] = useState<ImagePreviewSource | null>(null);

  useEffect(() => {
    if (attachment.dataUrl) {
      setThumbUrl(attachment.dataUrl);
      setLoading(false);
      return;
    }
    if (!attachment.path || attachment.path.startsWith('inline:')) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const result = await window.electron.dialog.readFileAsDataUrl(attachment.path);
        if (!cancelled && result.success && result.dataUrl) {
          setThumbUrl(result.dataUrl);
        }
      } catch {
        // ignore and use fallback icon
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [attachment.dataUrl, attachment.path]);

  const showFallback = imgError || (!thumbUrl && !loading);

  return (
    <div
      className="group relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg border border-claude-border bg-claude-surface dark:border-claude-darkBorder dark:bg-claude-darkSurface"
      title={attachment.path}
    >
      {loading ? (
        <div className="flex h-full w-full items-center justify-center">
          <ImageFileIcon className="h-6 w-6 animate-pulse text-blue-400" />
        </div>
      ) : showFallback ? (
        <div className="flex h-full w-full items-center justify-center">
          <ImageFileIcon className="h-6 w-6 text-blue-400" />
        </div>
      ) : (
        <button
          type="button"
          className="block h-full w-full cursor-zoom-in"
          onClick={() => setPreviewImage({
            src: thumbUrl!,
            alt: attachment.name,
            name: attachment.name,
          })}
          aria-label={i18nService.t('coworkAttachmentPreviewImage')}
          title={i18nService.t('coworkAttachmentPreviewImage')}
        >
          <img
            src={thumbUrl!}
            alt={attachment.name}
            className="h-full w-full object-cover"
            draggable={false}
            onError={() => setImgError(true)}
          />
        </button>
      )}

      <div className="absolute inset-x-0 bottom-0 bg-black/50 px-1 py-0.5">
        <span className="block truncate text-[10px] leading-tight text-white">
          {attachment.name}
        </span>
      </div>

      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onRemove(attachment.path);
        }}
        className="absolute right-0.5 top-0.5 hidden h-4 w-4 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80 group-hover:flex"
        aria-label={i18nService.t('coworkAttachmentRemove')}
        title={i18nService.t('coworkAttachmentRemove')}
      >
        <XMarkIcon className="h-2.5 w-2.5" />
      </button>
      <ImagePreviewModal
        image={previewImage}
        onClose={() => setPreviewImage(null)}
      />
    </div>
  );
};

const FileCard: React.FC<AttachmentCardProps> = ({ attachment, onRemove }) => {
  const { label } = getFileTypeInfo(attachment.name);

  return (
    <div
      className="group relative flex h-16 w-40 flex-shrink-0 items-center gap-2 rounded-lg border border-claude-border bg-claude-surface px-2 dark:border-claude-darkBorder dark:bg-claude-darkSurface"
      title={attachment.path}
    >
      <FileTypeIcon fileName={attachment.name} className="h-8 w-8 flex-shrink-0" />
      <div className="flex min-w-0 flex-1 flex-col justify-center">
        <span className="truncate text-xs font-medium text-claude-text dark:text-claude-darkText">
          {attachment.name}
        </span>
        <span className="text-[10px] text-claude-textSecondary dark:text-claude-darkTextSecondary">
          {label}
        </span>
      </div>
      <button
        type="button"
        onClick={() => onRemove(attachment.path)}
        className="absolute right-1 top-1 hidden h-4 w-4 items-center justify-center rounded-full bg-claude-surfaceHover text-claude-textSecondary hover:text-claude-text group-hover:flex dark:bg-claude-darkSurfaceHover dark:text-claude-darkTextSecondary dark:hover:text-claude-darkText"
        aria-label={i18nService.t('coworkAttachmentRemove')}
        title={i18nService.t('coworkAttachmentRemove')}
      >
        <XMarkIcon className="h-2.5 w-2.5" />
      </button>
    </div>
  );
};

export default AttachmentCard;
