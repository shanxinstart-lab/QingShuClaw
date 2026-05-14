export const ArtifactIpcChannel = {
  OpenHtmlInBrowser: 'shell:openHtmlInBrowser',
  WriteImageFromFile: 'clipboard:writeImageFromFile',
  WatchFile: 'artifact:watchFile',
  UnwatchFile: 'artifact:unwatchFile',
  FileChanged: 'artifact:file:changed',
} as const;

export type ArtifactIpcChannel = typeof ArtifactIpcChannel[keyof typeof ArtifactIpcChannel];
