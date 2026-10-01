import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';

import ProjectDetailView from './ProjectDetailView';
import type { ProjectDetailViewProps } from '../types';

function makeProps(overrides: Partial<ProjectDetailViewProps> = {}): ProjectDetailViewProps {
  return {
    isNew: false,
    saveLabel: 'Save changes',
    projectName: 'Example project',
    customerId: 'customer-1',
    reference: 'AFAS:13021/100',
    referenceError: '',
    hours: '0h',
    earn: '€0',
    canDelete: false,
    custOpts: [{ id: 'customer-1', name: 'Example customer' }],
    rateRows: [],
    newRateAmount: '',
    newRateFrom: '',
    entryRows: [],
    entriesEmpty: true,
    inputStyle: { minHeight: '44px', fontSize: '16px' },
    labelStyle: {},
    btnPrimaryLg: {},
    onNameChange: vi.fn(),
    onCustomerChange: vi.fn(),
    onReferenceChange: vi.fn(),
    onNewRateAmountChange: vi.fn(),
    onNewRateFromChange: vi.fn(),
    onAddRate: vi.fn(),
    onSave: vi.fn(),
    onDelete: vi.fn(),
    onBack: vi.fn(),
    onExport: vi.fn(),
    onViewEarnings: vi.fn(),
    budget: '',
    budgetSpentLabel: '',
    budgetPct: null,
    onBudgetChange: vi.fn(),
    closed: false,
    effectivelyClosed: false,
    onToggleClosed: vi.fn(),
    ...overrides,
  };
}

describe('ProjectDetailView reference', () => {
  test('renders the saved reference and forwards edits', () => {
    const onReferenceChange = vi.fn();
    render(<ProjectDetailView {...makeProps({ onReferenceChange })} />);

    const input = screen.getByRole('textbox', { name: 'Reference (optional)' });
    expect(input).toHaveValue('AFAS:13021/100');
    expect(input).toHaveAttribute('placeholder', 'AFAS:13021/100');
    expect(input).toHaveAttribute('maxlength', '100');
    expect(input).toHaveStyle({ minHeight: '44px', fontSize: '16px' });
    expect(screen.getByText(/Use <SYSTEM>:<value>/)).toBeInTheDocument();

    fireEvent.change(input, { target: { value: 'JIRA:ABC-123' } });
    expect(onReferenceChange).toHaveBeenCalledOnce();
  });

  test('renders inline validation feedback', () => {
    render(<ProjectDetailView {...makeProps({ reference: 'AFAS:invalid', referenceError: 'AFAS references must use AFAS:<project>/<item>.' })} />);

    expect(screen.getByRole('textbox', { name: 'Reference (optional)' })).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('alert')).toHaveTextContent('AFAS references must use AFAS:<project>/<item>.');
  });
});
