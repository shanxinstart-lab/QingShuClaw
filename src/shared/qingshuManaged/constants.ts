export const QingShuObjectSourceType = {
  QingShuManaged: 'qingshu-managed',
  LocalCustom: 'local-custom',
  Preset: 'preset',
} as const;

export type QingShuObjectSourceType =
  typeof QingShuObjectSourceType[keyof typeof QingShuObjectSourceType];

export const QingShuManagedInstaller = {
  QingShuSync: 'qingshu-sync',
} as const;

export type QingShuManagedInstaller =
  typeof QingShuManagedInstaller[keyof typeof QingShuManagedInstaller];

export const QingShuManagedToolRuntime = {
  ServerName: 'qingshu-managed',
} as const;
