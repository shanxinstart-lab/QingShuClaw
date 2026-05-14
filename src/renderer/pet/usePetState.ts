import { useEffect, useState } from 'react';

import type { PetRuntimeState } from '../../shared/pet/types';
import { petService } from './petService';

export function usePetState(): PetRuntimeState | null {
  const [state, setState] = useState<PetRuntimeState | null>(() => petService.getState());

  useEffect(() => {
    let active = true;
    void petService.init().then((nextState) => {
      if (active && nextState) setState(nextState);
    });
    const unsubscribe = petService.subscribe((nextState) => {
      if (active) setState(nextState);
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  return state;
}
