import { store } from '../store';
import { setSkills } from '../store/slices/skillSlice';
import { agentService } from './agent';
import { skillService } from './skill';

class QingShuManagedService {
  async syncCatalog(options?: { shouldApply?: () => boolean }): Promise<void> {
    const shouldApply = options?.shouldApply;
    const result = await window.electron.qingshuManaged.syncCatalog();
    if (!result.success) {
      throw new Error(result.error || 'Failed to sync QingShu managed catalog');
    }
    if (shouldApply && !shouldApply()) {
      return;
    }

    const skills = await skillService.loadSkills();
    if (shouldApply && !shouldApply()) {
      return;
    }
    store.dispatch(setSkills(skills));
    if (shouldApply && !shouldApply()) {
      return;
    }
    await agentService.loadAgents({ shouldApply });
  }

  async getCatalog() {
    const result = await window.electron.qingshuManaged.getCatalog();
    if (!result.success) {
      throw new Error(result.error || 'Failed to get QingShu managed catalog');
    }
    return result.snapshot ?? null;
  }
}

export const qingshuManagedService = new QingShuManagedService();
