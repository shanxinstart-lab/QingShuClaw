import { store } from '../store';
import { setSkills } from '../store/slices/skillSlice';
import { agentService } from './agent';
import { skillService } from './skill';

class QingShuManagedService {
  async syncCatalog(): Promise<void> {
    const result = await window.electron.qingshuManaged.syncCatalog();
    if (!result.success) {
      throw new Error(result.error || 'Failed to sync QingShu managed catalog');
    }

    const skills = await skillService.loadSkills();
    store.dispatch(setSkills(skills));
    await agentService.loadAgents();
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
