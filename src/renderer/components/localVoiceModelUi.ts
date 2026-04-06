import type { VoiceLocalModelInstallStatus } from '../../shared/voice/constants';

export const canOpenLocalModelPath = (
  status?: Pick<VoiceLocalModelInstallStatus, 'installed' | 'resolvedPath'> | null,
): boolean => {
  return Boolean(status?.installed && status.resolvedPath.trim());
};

export const isLocalModelInstallBusy = (options: {
  status?: Pick<VoiceLocalModelInstallStatus, 'downloading'> | null;
  pending: boolean;
}): boolean => {
  return options.pending || options.status?.downloading === true;
};
