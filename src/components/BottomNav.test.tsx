import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect } from 'vitest';
import BottomNav from './BottomNav';

describe('BottomNav', () => {
  it('renders all 6 navigation destinations including Dashboard (#183)', () => {
    render(
      <MemoryRouter>
        <BottomNav />
      </MemoryRouter>
    );

    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(6);
  });

  it('links to Log, Dashboard, History, Map, Stations, and Profile', () => {
    render(
      <MemoryRouter>
        <BottomNav />
      </MemoryRouter>
    );

    const hrefs = screen.getAllByRole('link').map((link) => link.getAttribute('href'));
    expect(hrefs).toEqual(['/', '/dashboard', '/history', '/map', '/stations', '/profile']);
  });
});
