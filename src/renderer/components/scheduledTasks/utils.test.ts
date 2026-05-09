import { describe, expect, test } from 'vitest';

import type { Schedule } from '../../../scheduledTask/types';
import { formatScheduleLabel, scheduleToPlanInfo } from './utils';

describe('scheduled task utils', () => {
  test('parses hourly cron plans', () => {
    const schedule: Schedule = { kind: 'cron', expr: '15 * * * *' };

    expect(scheduleToPlanInfo(schedule)).toMatchObject({
      planType: 'hourly',
      minute: 15,
    });
    expect(formatScheduleLabel(schedule)).toContain('15');
  });

  test('parses weekly multi-day cron plans', () => {
    const schedule: Schedule = { kind: 'cron', expr: '30 9 * * 1,3,5' };

    expect(scheduleToPlanInfo(schedule)).toMatchObject({
      planType: 'weekly',
      hour: 9,
      minute: 30,
      weekdays: [1, 3, 5],
    });
    expect(formatScheduleLabel(schedule)).toContain('09:30');
  });
});
