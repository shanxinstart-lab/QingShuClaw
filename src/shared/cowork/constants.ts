export const CoworkIpcChannel = {
  ForkSession: 'cowork:session:fork',
} as const;

export type CoworkIpcChannel = typeof CoworkIpcChannel[keyof typeof CoworkIpcChannel];
