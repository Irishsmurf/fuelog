import { describe, it, expect } from 'vitest';

describe('Leaflet Setup', () => {
  it('injects L into the global window object', async () => {
    // Dynamically import the setup file to simulate the entrypoint behavior
    await import('./leaflet-setup');

    // Leaflet's L object should now be attached to the global window
    expect(window.L).toBeDefined();
    
    // Verify it's actually the Leaflet object by checking for core methods
    expect(window.L).toHaveProperty('map');
    expect(window.L).toHaveProperty('marker');

  });
});
