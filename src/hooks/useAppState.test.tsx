import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import type { ChangeEvent } from 'react';

import { useAppState } from './useAppState';
import type { AppSettings, AppViewModel, PersistedData } from '../types';

const settings: AppSettings = {
  accentColor: '#2563eb',
  hoursPerDay: 8,
  showWeekend: true,
};

const initialData: PersistedData = {
  customers: [{ id: 'customer-1', name: 'Example customer', color: '#2563eb' }],
  projects: [{
    id: 'project-1',
    name: 'Example project',
    customerId: 'customer-1',
    rates: [{ id: 'rate-1', amount: 600, from: '2026-01-01', to: null }],
  }],
  services: [],
  entries: [],
};

function referenceEvent(value: string): ChangeEvent<HTMLInputElement> {
  return { target: { value } } as ChangeEvent<HTMLInputElement>;
}

function persistedProjectReference(): string | null | undefined {
  const stored = JSON.parse(localStorage.getItem('state.v1') || '{}') as PersistedData;
  return stored.projects?.[0]?.reference;
}

function openExistingProject(result: { current: AppViewModel }): void {
  act(() => result.current.sidebarProps.onNavProjects());
  act(() => result.current.projectsProps?.activeRows[0]?.onClick());
}

describe('useAppState project reference persistence', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('state.v1', JSON.stringify(initialData));
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ clientPrincipal: { userDetails: 'owner', userRoles: ['owner'] } }),
    }));
  });

  test('sets, reloads, changes, validates, and clears a project reference', async () => {
    const first = renderHook(() => useAppState(settings));
    openExistingProject(first.result);

    expect(first.result.current.projectDetailProps?.reference).toBe('');
    act(() => first.result.current.projectDetailProps?.onReferenceChange(referenceEvent('  AFAS:13021/100  ')));
    expect(first.result.current.projectDetailProps?.referenceError).toBe('');
    act(() => first.result.current.projectDetailProps?.onSave());

    expect(first.result.current.projectDetailProps?.reference).toBe('AFAS:13021/100');
    await waitFor(() => expect(persistedProjectReference()).toBe('AFAS:13021/100'));
    first.unmount();

    const reloaded = renderHook(() => useAppState(settings));
    openExistingProject(reloaded.result);
    expect(reloaded.result.current.projectDetailProps?.reference).toBe('AFAS:13021/100');

    act(() => reloaded.result.current.projectDetailProps?.onReferenceChange(referenceEvent('AFAS:invalid')));
    expect(reloaded.result.current.projectDetailProps?.referenceError).toContain('AFAS:<project>/<item>');
    act(() => reloaded.result.current.projectDetailProps?.onSave());
    await waitFor(() => expect(persistedProjectReference()).toBe('AFAS:13021/100'));

    act(() => reloaded.result.current.projectDetailProps?.onReferenceChange(referenceEvent('JIRA:ABC-123')));
    act(() => reloaded.result.current.projectDetailProps?.onSave());
    await waitFor(() => expect(persistedProjectReference()).toBe('JIRA:ABC-123'));

    act(() => reloaded.result.current.projectDetailProps?.onReferenceChange(referenceEvent('   ')));
    act(() => reloaded.result.current.projectDetailProps?.onSave());
    expect(reloaded.result.current.projectDetailProps?.reference).toBe('');
    await waitFor(() => expect(persistedProjectReference()).toBeNull());
  });
});
