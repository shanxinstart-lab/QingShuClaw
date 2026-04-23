import { CheckCircleIcon, XCircleIcon, ClockIcon, PlayCircleIcon } from '@heroicons/react/24/outline';
import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';

import type { ScheduledTaskRunWithName } from '../../../scheduledTask/types';
import { i18nService } from '../../services/i18n';
import { scheduledTaskService } from '../../services/scheduledTask';
import { RootState } from '../../store';
import RunSessionModal from './RunSessionModal';
import { formatDateTime, formatDuration } from './utils';

const statusConfig: Record<string, { label: string; tone: string; badgeClass: string; icon: React.ReactNode }> = {
  success: {
    label: 'scheduledTasksStatusSuccess',
    tone: 'text-green-600 dark:text-green-500',
    badgeClass: 'bg-green-50 dark:bg-green-500/10',
    icon: <CheckCircleIcon className="h-5 w-5" />,
  },
  error: {
    label: 'scheduledTasksStatusError',
    tone: 'text-red-500 dark:text-red-400',
    badgeClass: 'bg-red-50 dark:bg-red-500/10',
    icon: <XCircleIcon className="h-5 w-5" />,
  },
  skipped: {
    label: 'scheduledTasksStatusSkipped',
    tone: 'text-yellow-600 dark:text-yellow-500',
    badgeClass: 'bg-yellow-50 dark:bg-yellow-500/10',
    icon: <PlayCircleIcon className="h-5 w-5" />,
  },
  running: {
    label: 'scheduledTasksStatusRunning',
    tone: 'text-primary dark:text-primary-hover',
    badgeClass: 'bg-primary/10 dark:bg-primary/20',
    icon: <ClockIcon className="h-5 w-5 animate-pulse" />,
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
    <div className="space-y-2">
      {allRuns.map((run) => {
        const cfg = statusConfig[run.status] || {
          label: 'scheduledTasksStatusIdle',
          tone: 'text-secondary',
          badgeClass: 'bg-surface-raised',
          icon: <ClockIcon className="h-5 w-5" />,
        };
        const hasSession = run.sessionId || run.sessionKey;
        
        return (
          <div
            key={run.id}
            className={`flex items-center justify-between gap-4 py-3 px-4 rounded-xl transition-colors ${
              hasSession
                ? 'cursor-pointer hover:bg-surface-raised'
                : ''
            }`}
            onClick={() => handleViewSession(run)}
          >
            {/* Left Side: Icon + Title + Time */}
            <div className="flex items-center gap-4 min-w-0 flex-1">
              {/* Dynamic Status Icon Container */}
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${cfg.badgeClass} ${cfg.tone}`}>
                {cfg.icon}
              </div>
              
              <div className="min-w-0 flex flex-col justify-center">
                <div className="truncate text-[14px] font-semibold text-foreground">
                  {run.taskName}
                </div>
                <div className="mt-0.5 text-[12px] text-secondary/80">
                  {formatDateTime(new Date(run.startedAt))}
                </div>
              </div>
            </div>

            {/* Right Side: Execution Metric & Result */}
            <div className="flex items-center gap-6 shrink-0 text-right">
              <div className="flex flex-col items-end">
                <div className="text-[14px] text-foreground font-mono">
                  {run.durationMs !== null ? formatDuration(run.durationMs) : '-'}
                </div>
                <div className="mt-0.5 text-[11px] text-secondary/70 uppercase">
                  {i18nService.t('duration') || 'Duration'}
                </div>
              </div>
              <div className="w-20 flex justify-end">
                <span className={`px-2 py-0.5 text-[11px] uppercase tracking-wider font-bold rounded-md ${cfg.tone} ${cfg.badgeClass}`}>
                  {i18nService.t(cfg.label)}
                </span>
              </div>
            </div>
          </div>
        );
      })}

      {allRuns.length >= 50 && allRuns.length % 50 === 0 && (
        <button
          type="button"
          onClick={handleLoadMore}
          className="w-full mt-4 rounded-xl border border-border bg-surface px-4 py-3 text-sm text-primary transition-colors hover:bg-surface-raised"
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
