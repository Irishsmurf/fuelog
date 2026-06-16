import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ImportOnboardingPrompt from './ImportOnboardingPrompt';

const mockUpdateProfile = vi.fn();
let mockProfile: { hasSeenImportOnboarding?: boolean } | null = {};

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ profile: mockProfile, updateProfile: mockUpdateProfile }),
}));

function renderPrompt() {
  return render(
    <MemoryRouter>
      <ImportOnboardingPrompt />
    </MemoryRouter>
  );
}

describe('ImportOnboardingPrompt (#154)', () => {
  beforeEach(() => {
    mockUpdateProfile.mockClear();
    mockProfile = {};
  });

  it('renders the prompt for a profile that has not seen onboarding', () => {
    renderPrompt();
    expect(screen.getByText('importOnboarding.heading')).toBeInTheDocument();
  });

  it('does not render once hasSeenImportOnboarding is true', () => {
    mockProfile = { hasSeenImportOnboarding: true };
    const { container } = renderPrompt();
    expect(container.firstChild).toBeNull();
  });

  it('does not render when profile is not loaded yet', () => {
    mockProfile = null;
    const { container } = renderPrompt();
    expect(container.firstChild).toBeNull();
  });

  it('persists dismissal via updateProfile when the dismiss button is clicked', () => {
    renderPrompt();
    fireEvent.click(screen.getByLabelText('importOnboarding.dismiss'));
    expect(mockUpdateProfile).toHaveBeenCalledWith({ hasSeenImportOnboarding: true });
  });

  it('persists dismissal via updateProfile when the import CTA is followed', () => {
    renderPrompt();
    fireEvent.click(screen.getByText('importOnboarding.cta'));
    expect(mockUpdateProfile).toHaveBeenCalledWith({ hasSeenImportOnboarding: true });
  });
});
