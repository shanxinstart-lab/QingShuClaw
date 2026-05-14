export async function triggerSystemDictation(): Promise<{ success: boolean; error?: string }> {
  try {
    console.debug('[Voice] Requesting system dictation.');
    const result = await window.electron.voice.triggerDictation();
    if (!result.success) {
      console.warn('[Voice] Dictation shortcut failed:', result.error);
    }
    return result;
  } catch (error) {
    console.warn('[Voice] Dictation shortcut threw:', error);
    return { success: false, error: 'unknown' };
  }
}
