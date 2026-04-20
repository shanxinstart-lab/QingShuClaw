import {
  BoltIcon,
  ClockIcon,
  EllipsisVerticalIcon,
  PlayCircleIcon,
} from '@heroicons/react/24/outline';
import React from 'react';
import { useDispatch, useSelector } from 'react-redux';

import type { ScheduledTask } from '../../../scheduledTask/types';
import { i18nService } from '../../services/i18n';
import { scheduledTaskService } from '../../services/scheduledTask';
import { RootState } from '../../store';
import { selectTask, setViewMode } from '../../store/slices/scheduledTaskSlice';
import { formatDateTime, formatScheduleLabel, getStatusLabelKey, getStatusTone } from './utils';

interface TaskListItemProps {
  task: ScheduledTask;
  onRequestDelete: (taskId: string, taskName: string) => void;
}

const TaskListItem: React.FC<TaskListItemProps> = ({ task, onRequestDelete }) => {
  const dispatch = useDispatch();
  const [showMenu, setShowMenu] = React.useState(false);
  const menuRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };
    if (showMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showMenu]);

  const effectiveStatus = task.state.runningAtMs ? 'running' : task.state.lastStatus;
  const statusLabel = i18nService.t(getStatusLabelKey(effectiveStatus));
  const statusTone = getStatusTone(effectiveStatus);
  const statusBadgeClass = effectiveStatus === 'running'
    ? 'bg-primary/12 text-primary'
    : 'bg-surface-raised text-secondary';

  return (
    <div
      className="rounded-[24px] border border-border bg-surface p-5 shadow-subtle transition-colors hover:border-primary/25 hover:bg-surface-raised/60"
      onClick={() => dispatch(selectTask(task.id))}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/12 text-primary">
              {effectiveStatus === 'running' ? <BoltIcon className="h-5 w-5" /> : <PlayCircleIcon className="h-5 w-5" />}
            </div>
            <div className="min-w-0">
              <div className={`truncate text-base font-semibold ${task.enabled ? 'text-foreground' : 'text-secondary'}`}>
                {task.name}
              </div>
              {task.description && (
                <div className="mt-1 truncate text-sm text-secondary">
                  {task.description}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className={`rounded-full px-3 py-1 text-xs font-medium ${statusTone} ${statusBadgeClass}`}>
            {statusLabel}
          </span>
          <button
            type="button"
          onClick={(event) => {
            event.stopPropagation();
            void scheduledTaskService.toggleTask(task.id, !task.enabled);
          }}
          className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${
            task.enabled ? 'bg-primary' : 'bg-border'
          }`}
          aria-label={i18nService.t('scheduledTasksFormEnabled')}
          >
            <span
              className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white transition-transform shadow-sm ${
                task.enabled ? 'translate-x-4' : 'translate-x-0'
              }`}
            />
          </button>
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                setShowMenu((value) => !value);
              }}
              className="rounded-xl p-2 text-secondary transition-colors hover:bg-background hover:text-foreground"
              aria-label={i18nService.t('scheduledTasksListColMore')}
            >
              <EllipsisVerticalIcon className="h-5 w-5" />
            </button>
            {showMenu && (
              <div className="absolute right-0 top-full z-50 mt-2 w-32 rounded-2xl border border-border bg-surface py-1 shadow-lg">
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    setShowMenu(false);
                    void scheduledTaskService.runManually(task.id);
                  }}
                  disabled={Boolean(task.state.runningAtMs)}
                  className="w-full px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-surface-raised disabled:opacity-50"
                >
                  {i18nService.t('scheduledTasksRun')}
                </button>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    setShowMenu(false);
                    dispatch(selectTask(task.id));
                    dispatch(setViewMode('edit'));
                  }}
                  className="w-full px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-surface-raised"
                >
                  {i18nService.t('scheduledTasksEdit')}
                </button>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    setShowMenu(false);
                    onRequestDelete(task.id, task.name);
                  }}
                  className="w-full px-3 py-2 text-left text-sm text-red-500 transition-colors hover:bg-surface-raised"
                >
                  {i18nService.t('scheduledTasksDelete')}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-3 text-sm md:grid-cols-2">
        <div className="rounded-2xl bg-background px-4 py-3">
          <div className="text-xs font-medium text-secondary">
            {i18nService.t('scheduledTasksListColSchedule')}
          </div>
          <div className="mt-1 text-sm text-foreground">
            {formatScheduleLabel(task.schedule)}
          </div>
        </div>
        <div className="rounded-2xl bg-background px-4 py-3">
          <div className="text-xs font-medium text-secondary">
            {task.state.runningAtMs
              ? i18nService.t('scheduledTasksStatusRunning')
              : i18nService.t('scheduledTasksHistoryColTime')}
          </div>
          <div className="mt-1 text-sm text-foreground">
            {task.state.runningAtMs
              ? formatDateTime(new Date(task.state.runningAtMs))
              : (
                task.state.lastRunAtMs
                  ? formatDateTime(new Date(task.state.lastRunAtMs))
                  : i18nService.t('scheduledTasksStatusIdle')
              )}
          </div>
        </div>
      </div>
    </div>
  );
};

interface TaskListProps {
  onRequestDelete: (taskId: string, taskName: string) => void;
  tasks?: ScheduledTask[];
}

const TaskList: React.FC<TaskListProps> = ({ onRequestDelete, tasks: providedTasks }) => {
  const allTasks = useSelector((state: RootState) => state.scheduledTask.tasks);
  const loading = useSelector((state: RootState) => state.scheduledTask.loading);
  const tasks = providedTasks ?? allTasks;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="text-secondary">
          {i18nService.t('loading')}
        </div>
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-6">
        <ClockIcon className="h-12 w-12 text-secondary/40 mb-4" />
        <p className="text-sm font-medium text-secondary mb-1">
          {i18nService.t('scheduledTasksEmptyState')}
        </p>
        <p className="text-xs text-secondary/70 text-center">
          {i18nService.t('scheduledTasksEmptyHint')}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {tasks.map((task) => (
        <TaskListItem key={task.id} task={task} onRequestDelete={onRequestDelete} />
      ))}
    </div>
  );
};

export default TaskList;
