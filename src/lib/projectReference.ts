import type { Project } from '../types';

const GENERIC_REFERENCE_PATTERN = /^[A-Z][A-Z0-9_]*:\S+$/;
const AFAS_REFERENCE_PATTERN = /^AFAS:([^/\s]+)\/([^/\s]+)$/;
const MAX_REFERENCE_LENGTH = 100;

export interface ProjectReferenceValidation {
  value: string | null;
  error: string;
}

export function validateProjectReference(
  reference: string | null | undefined,
  projects: readonly Project[] = [],
  currentProjectId: string | null = null,
): ProjectReferenceValidation {
  const value = reference?.trim() || null;

  if (value === null) {
    return { value: null, error: '' };
  }

  if (value.length > MAX_REFERENCE_LENGTH) {
    return { value, error: `Reference must be ${MAX_REFERENCE_LENGTH} characters or fewer.` };
  }

  if (!GENERIC_REFERENCE_PATTERN.test(value)) {
    return { value, error: 'Use <SYSTEM>:<value> with an uppercase system name and no spaces.' };
  }

  if (value.startsWith('AFAS:') && !AFAS_REFERENCE_PATTERN.test(value)) {
    return { value, error: 'AFAS references must use AFAS:<project>/<item>.' };
  }

  const conflict = projects.find((project) => (
    project.id !== currentProjectId && project.reference === value
  ));
  if (conflict) {
    return { value, error: `Reference is already used by project “${conflict.name}”.` };
  }

  return { value, error: '' };
}
