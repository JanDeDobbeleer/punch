import { describe, expect, test } from 'vitest';

import { validateProjectReference } from './projectReference';
import type { Project } from '../types';

function project(overrides: Partial<Project> = {}): Project {
  return {
    id: 'project-1',
    name: 'Example project',
    customerId: 'customer-1',
    rates: [],
    ...overrides,
  };
}

describe('validateProjectReference', () => {
  test.each([
    'AFAS:13021/100',
    'AFAS:13666/175',
    'AFAS:0073/815',
    'AFAS:PROJECT-1/ITEM_2',
    'JIRA:ABC-123',
    'CRM_2:account/project',
  ])('accepts valid reference %s', (reference) => {
    expect(validateProjectReference(reference)).toEqual({ value: reference, error: '' });
  });

  test.each([
    ['afas:13021/100', 'uppercase system'],
    ['1AFAS:13021/100', 'uppercase system'],
    ['AFAS', 'uppercase system'],
    ['AFAS:', 'uppercase system'],
    ['SYS:value with spaces', 'uppercase system'],
    ['AFAS:13021', 'AFAS:<project>/<item>'],
    ['AFAS:/100', 'AFAS:<project>/<item>'],
    ['AFAS:13021/', 'AFAS:<project>/<item>'],
    ['AFAS:13021/100/2', 'AFAS:<project>/<item>'],
    ['AFAS: 13021/100', 'uppercase system'],
    ['13021/100', 'uppercase system'],
  ])('rejects invalid reference %s', (reference, message) => {
    expect(validateProjectReference(reference).error).toContain(message);
  });

  test('trims outer whitespace and maps empty, null, and undefined to null', () => {
    expect(validateProjectReference('  AFAS:13021/100\n')).toEqual({ value: 'AFAS:13021/100', error: '' });
    expect(validateProjectReference('   ')).toEqual({ value: null, error: '' });
    expect(validateProjectReference(null)).toEqual({ value: null, error: '' });
    expect(validateProjectReference(undefined)).toEqual({ value: null, error: '' });
  });

  test('enforces the 100-character limit after trimming', () => {
    const exactly100 = `SYS:${'x'.repeat(96)}`;
    const tooLong = `SYS:${'x'.repeat(97)}`;

    expect(validateProjectReference(` ${exactly100} `)).toEqual({ value: exactly100, error: '' });
    expect(validateProjectReference(tooLong).error).toContain('100 characters or fewer');
  });

  test('compares references exactly and case-sensitively', () => {
    const projects = [project({ reference: 'JIRA:ABC-123' })];

    expect(validateProjectReference('JIRA:ABC-123', projects).error).toContain('Example project');
    expect(validateProjectReference('JIRA:abc-123', projects)).toEqual({ value: 'JIRA:abc-123', error: '' });
  });

  test('excludes the current project when editing itself', () => {
    const projects = [project({ reference: 'AFAS:13021/100' })];

    expect(validateProjectReference('AFAS:13021/100', projects, 'project-1')).toEqual({
      value: 'AFAS:13021/100',
      error: '',
    });
  });

  test('detects a duplicate on a closed project and names it', () => {
    const projects = [project({ name: 'Closed project', reference: 'AFAS:13021/100', closed: true })];

    expect(validateProjectReference('AFAS:13021/100', projects, 'another-project').error)
      .toBe('Reference is already used by project “Closed project”.');
  });
});
