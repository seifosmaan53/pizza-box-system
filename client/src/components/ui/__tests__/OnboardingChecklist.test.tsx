import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { OnboardingChecklist } from '../OnboardingChecklist';

function renderChecklist(props: { storeCount: number; inventoryCount: number; invoiceCount: number }) {
  return render(
    <MemoryRouter>
      <OnboardingChecklist {...props} />
    </MemoryRouter>
  );
}

describe('OnboardingChecklist', () => {
  it('shows all steps for a fresh system', () => {
    renderChecklist({ storeCount: 0, inventoryCount: 0, invoiceCount: 0 });
    expect(screen.getByText('Getting Started')).toBeInTheDocument();
    expect(screen.getByText('Create your first store')).toBeInTheDocument();
    expect(screen.getByText('Add inventory items')).toBeInTheDocument();
    expect(screen.getByText('Create your first invoice')).toBeInTheDocument();
    expect(screen.getByText('0/3')).toBeInTheDocument();
  });

  it('marks completed steps', () => {
    renderChecklist({ storeCount: 1, inventoryCount: 0, invoiceCount: 0 });
    expect(screen.getByText('1/3')).toBeInTheDocument();
  });

  it('hides when all steps are complete', () => {
    const { container } = renderChecklist({ storeCount: 1, inventoryCount: 10, invoiceCount: 5 });
    expect(container.innerHTML).toBe('');
  });
});
