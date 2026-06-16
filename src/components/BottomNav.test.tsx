import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect } from 'vitest';
import BottomNav from './BottomNav';

describe('BottomNav', () => {
  it('renders exactly 5 destinations to keep tap targets comfortable on mobile (#141)', () => {
    render(
      <MemoryRouter>
        <BottomNav />
      </MemoryRouter>
    );

    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(5);
  });

  it('links to Log, History, Map, Stations, and Profile, but not Dashboard', () => {
    render(
      <MemoryRouter>
        <BottomNav />
      </MemoryRouter>
    );

    const hrefs = screen.getAllByRole('link').map((link) => link.getAttribute('href'));
    expect(hrefs).toEqual(['/', '/history', '/map', '/stations', '/profile']);
    expect(hrefs).not.toContain('/dashboard');
  });
});
