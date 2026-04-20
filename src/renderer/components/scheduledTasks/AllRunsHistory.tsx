import { CheckCircleIcon, ClockIcon } from '@heroicons/react/24/outline';
import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';

import type { ScheduledTaskRunWithName } from '../../../scheduledTask/types';
import { i18nService } from '../../services/i18n';
import { scheduledTaskService } from '../../services/scheduledTask';
import { RootState } from '../../store';
import RunSessionModal from './RunSessionModal';
import { formatDateTime, formatDuration } from './utils';

const statusConfig: Record<string, { label: string; tone: string; badgeClass: string }> = {
  success: {
    label: 'scheduledTasksStatusSuccess',
    tone: 'text-green-600',
    badgeClass: 'bg-green-500/12',
  },
  error: {
    label: 'scheduledTasksStatusError',
    tone: 'text-red-600',
    badgeClass: 'bg-red-500/12',
  },
  skipped: {
    label: 'scheduledTasksStatusSkipped',
    tone: 'text-yellow-600',
    badgeClass: 'bg-yellow-500/12',
  },
  running: {
    label: 'scheduledTasksStatusRunning',
    tone: 'text-primary',
    badgeClass: 'bg-primary/12',
  },
};

const AllRunsHistory: React.FC = () => {
  const allRuns = useSelector((state: RootState) => state.scheduledTask.allRuns);
  const [viewingRun, setViewingRun] = useState<ScheduledTaskRunWithName | null>(null);

  useEffect(() => {
    scheduledTaskService.loadAllRuns(50);
  }, []);

  const handleLoadMore = () => {
    scheduledTaskService.loadAllRuns(50, allRuns.length);
  };

  const handleViewSession = (run: ScheduledTaskRunWithName) => {
    if (run.sessionId || run.sessionKey) {
      setViewingRun(run);
    }
  };

  if (allRuns.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-6">
        <ClockIcon className="h-12 w-12 text-secondary/40 mb-4" />
        <p className="text-sm font-medium text-secondary">
          {i18nService.t('scheduledTasksHistoryEmpty')}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {allRuns.map((run) => {
        const cfg = statusConfig[run.status] || {
          label: 'scheduledTasksStatusIdle',
          tone: 'text-secondary',
          badgeClass: 'bg-surface-raised',
        };
        const hasSession = run.sessionId || run.sessionKey;
        return (
          <div
            key={run.id}
            className={`rounded-[24px] border border-border bg-surface p-5 shadow-subtle transition-colors ${
              hasSession
                ? 'cursor-pointer hover:border-primary/25 hover:bg-surface-raised/60'
                : ''
            }`}
            onClick={() => handleViewSession(run)}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/12 text-primary">
                    <CheckCircleIcon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-base font-semibold text-foreground">
                      {run.taskName}
                    </div>
                    <div className="mt-1 text-sm text-secondary">
                      {formatDateTime(new Date(run.startedAt))}
                    </div>
                  </div>
                </div>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-medium ${cfg.tone} ${cfg.badgeClass}`}>
                {i18nService.t(cfg.label)}
              </span>
            </div>

            <div className="mt-5 grid gap-3 text-sm md:grid-cols-2">
              <div className="rounded-2xl bg-background px-4 py-3">
                <div className="text-xs font-medium text-secondary">
                  {i18nService.t('scheduledTasksHistoryColTime')}
                </div>
                <div className="mt-1 text-sm text-foreground">
                  {formatDateTime(new Date(run.startedAt))}
                </div>
              </div>
              <div className="rounded-2xl bg-background px-4 py-3">
                <div className="text-xs font-medium text-secondary">
                  {i18nService.t('scheduledTasksHistoryColStatus')}
                </div>
                <div className="mt-1 text-sm text-foreground">
                  {run.durationMs !== null
                    ? formatDuration(run.durationMs)
                    : i18nService.t(cfg.label)}
                </div>
              </div>
            </div>
          </div>
        );
      })}

      {allRuns.length >= 50 && allRuns.length % 50 === 0 && (
        <button
          type="button"
          onClick={handleLoadMore}
          className="w-full rounded-2xl border border-border bg-surface px-4 py-3 text-sm text-primary transition-colors hover:bg-surface-raised hover:text-primary-hover"
        >
          {i18nService.t('scheduledTasksLoadMore')}
        </button>
      )}

      {viewingRun && (
        <RunSessionModal
          sessionId={viewingRun.sessionId}
          sessionKey={viewingRun.sessionKey}
          onClose={() => setViewingRun(null)}
        />
      )}
    </div>
  );
};

export default AllRunsHistory;
