import React from 'react';
import { i18nService } from '@/services/i18n';
import type { AgreementConfig } from '@/services/brandRuntime';
import { resolveLocalizedText } from '@/services/brandRuntime';

interface PrivacyDialogProps {
  agreement: AgreementConfig;
  onAccept: () => void;
  onReject: () => void;
}

const PrivacyDialog: React.FC<PrivacyDialogProps> = ({ agreement, onAccept, onReject }) => {
  const language = i18nService.getLanguage();
  const title = resolveLocalizedText(agreement.title, language);
  const description = resolveLocalizedText(agreement.descriptionTemplate, language);
  const linkText = resolveLocalizedText(agreement.linkText, language);
  const linkUrl = agreement.linkUrl;

  const handleLinkClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    await window.electron.shell.openExternal(linkUrl);
  };

  const parts = description.includes('{link}')
    ? description.split('{link}')
    : [description, ''];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center modal-backdrop">
      <div className="modal-content w-full max-w-md mx-4 bg-surface rounded-2xl shadow-modal overflow-hidden">
        {/* Header */}
        <div className="px-6 pt-6 pb-2">
          <h2 className="text-lg font-semibold text-foreground text-center">
            {title}
          </h2>
        </div>

        {/* Content */}
        <div className="px-6 py-4">
          <p className="text-sm text-secondary text-center leading-relaxed">
            {parts[0]}
            <a
              href={linkUrl}
              onClick={handleLinkClick}
              className="text-primary hover:text-primary-hover underline"
            >
              {linkText}
            </a>
            {parts[1]}
          </p>
        </div>

        {/* Buttons */}
        <div className="px-6 pb-6 pt-2 flex gap-3">
          <button
            onClick={onReject}
            className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium text-secondary bg-surface-raised hover:opacity-80 transition-opacity"
          >
            {i18nService.t('privacyDialogReject')}
          </button>
          <button
            onClick={onAccept}
            className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium text-white bg-primary hover:bg-primary-hover transition-colors"
          >
            {i18nService.t('privacyDialogAccept')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PrivacyDialog;
