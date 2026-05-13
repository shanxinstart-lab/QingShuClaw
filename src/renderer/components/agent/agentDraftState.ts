export interface CreateAgentDraftState {
  name: string;
  description: string;
  systemPrompt: string;
  identity: string;
  icon: string;
  skillIds: readonly string[];
  toolBundleIds?: readonly string[];
  boundBindingKeys?: Iterable<string>;
}

const normalizeDraftText = (value: string | undefined): string => (value ?? '').trim();
const normalizeSelection = <T>(value: readonly T[] | undefined): readonly T[] => (
  value ?? ([] as readonly T[])
);
const normalizeBindingSet = (value: Iterable<string> | undefined): Set<string> => {
  if (!value) return new Set<string>();
  return new Set(
    [...value]
      .map((entry) => entry.trim())
      .filter(Boolean),
  );
};

export const hasOrderedSelectionChanges = <T>(
  current: readonly T[] | undefined,
  initial: readonly T[] | undefined,
): boolean => {
  const nextCurrent = normalizeSelection(current);
  const nextInitial = normalizeSelection(initial);
  return (
    nextCurrent.length !== nextInitial.length
    || nextCurrent.some((value, index) => value !== nextInitial[index])
  );
};

export const hasBindingSelectionChanges = (
  current: Iterable<string> | undefined,
  initial: Iterable<string> | undefined,
): boolean => {
  const nextCurrent = normalizeBindingSet(current);
  const nextInitial = normalizeBindingSet(initial);
  return (
    nextCurrent.size !== nextInitial.size
    || [...nextCurrent].some((value) => !nextInitial.has(value))
  );
};

export const hasCreateAgentDraftChanges = (
  current: CreateAgentDraftState,
  initial?: Partial<CreateAgentDraftState>,
): boolean => {
  if (normalizeDraftText(current.name) !== normalizeDraftText(initial?.name)) {
    return true;
  }
  if (normalizeDraftText(current.description) !== normalizeDraftText(initial?.description)) {
    return true;
  }
  if (normalizeDraftText(current.systemPrompt) !== normalizeDraftText(initial?.systemPrompt)) {
    return true;
  }
  if (normalizeDraftText(current.identity) !== normalizeDraftText(initial?.identity)) {
    return true;
  }
  if (normalizeDraftText(current.icon) !== normalizeDraftText(initial?.icon)) {
    return true;
  }
  if (hasOrderedSelectionChanges(current.skillIds, initial?.skillIds)) {
    return true;
  }
  if (hasOrderedSelectionChanges(current.toolBundleIds, initial?.toolBundleIds)) {
    return true;
  }
  return hasBindingSelectionChanges(current.boundBindingKeys, initial?.boundBindingKeys);
};
