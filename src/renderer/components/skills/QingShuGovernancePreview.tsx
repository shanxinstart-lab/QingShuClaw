import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  CheckCircleIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { qingshuGovernanceService } from '../../services/qingshuGovernance';
import { i18nService } from '../../services/i18n';
import type { QingShuSkillGovernanceResult } from '../../types/qingshuGovernance';

interface QingShuGovernancePreviewProps {
  skillId?: string;
  governance?: QingShuSkillGovernanceResult | null;
  title?: string;
  onClose: () => void;
}

const VALIDATION_BADGE_STYLES = {
  error: 'bg-red-500/12 text-red-600 border-red-500/20 dark:text-red-300',
  warn: 'bg-amber-500/12 text-amber-700 border-amber-500/20 dark:text-amber-300',
  info: 'bg-sky-500/12 text-sky-700 border-sky-500/20 dark:text-sky-300',
} as const;

const VALIDATION_ICONS = {
  error: ExclamationTriangleIcon,
  warn: ExclamationTriangleIcon,
  info: InformationCircleIcon,
} as const;

const QingShuGovernancePreview: React.FC<QingShuGovernancePreviewProps> = ({
  skillId,
  governance: providedGovernance,
  title,
  onClose,
}) => {
  const [loading, setLoading] = useState(!providedGovernance);
  const [governance, setGovernance] = useState<QingShuSkillGovernanceResult | null>(providedGovernance ?? null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (providedGovernance) {
      setGovernance(providedGovernance);
      setLoading(false);
      setError(null);
      return;
    }
    if (!skillId) {
      setGovernance(null);
      setLoading(false);
      setError(i18nService.t('skillGovernancePreviewEmpty'));
      return;
    }
    let active = true;
    setLoading(true);
    setError(null);
    setGovernance(null);

    void qingshuGovernanceService.analyzeSkillById(skillId).then((result) => {
      if (!active) {
        return;
      }
      if (!result) {
        setError(i18nService.t('skillGovernancePreviewLoadFailed'));
        setLoading(false);
        return;
      }
      setGovernance(result);
      setLoading(false);
    }).catch((reason) => {
      if (!active) {
        return;
      }
      setError(reason instanceof Error ? reason.message : i18nService.t('skillGovernancePreviewLoadFailed'));
      setLoading(false);
    });

    return () => {
      active = false;
    };
  }, [providedGovernance, skillId]);

  const renderContent = () => {
    if (loading) {
      return (
        <div className="px-5 py-12 text-sm text-secondary">
          {i18nService.t('skillGovernancePreviewLoading')}
        </div>
      );
    }

    if (error || !governance) {
      return (
        <div className="px-5 py-12 text-sm text-red-500 dark:text-red-300">
          {error || i18nService.t('skillGovernancePreviewEmpty')}
        </div>
      );
    }

    return (
      <div className="px-5 py-4 space-y-5 max-h-[70vh] overflow-y-auto">
        <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-border bg-backgroundSecondary px-4 py-3">
            <div className="text-[11px] uppercase tracking-[0.16em] text-tertiary">
              {i18nService.t('skillGovernancePreviewDeclared')}
            </div>
            <div className="mt-2 text-2xl font-semibold text-foreground">
              {governance.dependencies.hasDeclarations ? 'Yes' : 'No'}
            </div>
          </div>
          <div className="rounded-2xl border border-border bg-backgroundSecondary px-4 py-3">
            <div className="text-[11px] uppercase tracking-[0.16em] text-tertiary">
              {i18nService.t('skillGovernancePreviewIssues')}
            </div>
            <div className="mt-2 text-2xl font-semibold text-foreground">
              {governance.validation.issues.length}
            </div>
          </div>
          <div className="rounded-2xl border border-border bg-backgroundSecondary px-4 py-3">
            <div className="text-[11px] uppercase tracking-[0.16em] text-tertiary">
              {i18nService.t('skillGovernancePreviewSharedTools')}
            </div>
            <div className="mt-2 text-2xl font-semibold text-foreground">
              {governance.catalog.tools.length}
            </div>
          </div>
        </section>

        <section className="space-y-2">
          <div className="text-sm font-medium text-foreground">
            {i18nService.t('skillGovernancePreviewDependencies')}
          </div>
          <div className="rounded-2xl border border-border bg-backgroundSecondary p-4 space-y-3 text-sm">
            <div>
              <div className="text-xs text-tertiary mb-1">
                {i18nService.t('skillGovernancePreviewToolBundles')}
              </div>
              <div className="text-foreground break-all">
                {governance.dependencies.dependencies.toolBundles.join(', ') || i18nService.t('skillGovernancePreviewNone')}
              </div>
            </div>
            <div>
              <div className="text-xs text-tertiary mb-1">
                {i18nService.t('skillGovernancePreviewToolRefs')}
              </div>
              <div className="text-foreground break-all">
                {governance.dependencies.dependencies.toolRefs.join(', ') || i18nService.t('skillGovernancePreviewNone')}
              </div>
            </div>
            <div>
              <div className="text-xs text-tertiary mb-1">
                {i18nService.t('skillGovernancePreviewCapabilityRefs')}
              </div>
              <div className="text-foreground break-all">
                {governance.dependencies.dependencies.capabilityRefs.join(', ') || i18nService.t('skillGovernancePreviewNone')}
              </div>
            </div>
          </div>
        </section>

        <section className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <CheckCircleIcon className="h-4 w-4 text-green-500" />
            {i18nService.t('skillGovernancePreviewValidation')}
          </div>
          {governance.validation.issues.length === 0 ? (
            <div className="rounded-2xl border border-green-500/20 bg-green-500/8 px-4 py-3 text-sm text-green-700 dark:text-green-300">
              {i18nService.t('skillGovernancePreviewNoIssues')}
            </div>
          ) : (
            <div className="space-y-2">
              {governance.validation.issues.map((issue, index) => {
                const Icon = VALIDATION_ICONS[issue.level];
                return (
                  <div
                    key={`${issue.code}-${issue.ref || index}`}
                    className={`rounded-2xl border px-4 py-3 text-sm ${VALIDATION_BADGE_STYLES[issue.level]}`}
                  >
                    <div className="flex items-start gap-2">
                      <Icon className="mt-0.5 h-4 w-4 flex-shrink-0" />
                      <div className="min-w-0">
                        <div className="font-medium break-all">{issue.code}</div>
                        <div className="mt-1 break-all">{issue.message}</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-border bg-backgroundSecondary p-4">
            <div className="text-sm font-medium text-foreground">
              {i18nService.t('skillGovernancePreviewMarkdown')}
            </div>
            <pre className="mt-3 max-h-64 overflow-auto rounded-xl bg-black/5 dark:bg-white/5 p-3 text-xs leading-5 text-secondary whitespace-pre-wrap break-words">
              {governance.contracts.markdown}
            </pre>
          </div>
          <div className="rounded-2xl border border-border bg-backgroundSecondary p-4">
            <div className="text-sm font-medium text-foreground">
              {i18nService.t('skillGovernancePreviewJson')}
            </div>
            <pre className="mt-3 max-h-64 overflow-auto rounded-xl bg-black/5 dark:bg-white/5 p-3 text-xs leading-5 text-secondary whitespace-pre-wrap break-words">
              {governance.contracts.json}
            </pre>
          </div>
        </section>
      </div>
    );
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center modal-backdrop" onClick={onClose}>
      <div
        className="modal-content w-full max-w-5xl mx-4 rounded-3xl border border-border bg-surface shadow-modal overflow-hidden"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <div className="text-xs uppercase tracking-[0.18em] text-tertiary">
              {i18nService.t('skillGovernancePreviewEyebrow')}
            </div>
            <div className="mt-1 text-lg font-semibold text-foreground">
              {title || i18nService.t('skillGovernancePreviewTitle').replace('{id}', skillId || 'unknown')}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-secondary transition-colors hover:bg-backgroundSecondary hover:text-foreground"
            aria-label={i18nService.t('close')}
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>
        {renderContent()}
      </div>
    </div>,
    document.body,
  );
};

export default QingShuGovernancePreview;
