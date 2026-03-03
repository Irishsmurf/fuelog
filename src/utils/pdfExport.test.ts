import { describe, it, expect, vi, beforeEach } from 'vitest';
import { exportLogsToPDF } from './pdfExport';
import { Log } from './types';
import { Timestamp } from 'firebase/firestore';

// Define the mock functions at the top level
const mockSave = vi.fn();
const mockText = vi.fn();
const mockSetFontSize = vi.fn();
const mockSetTextColor = vi.fn();
const mockGetNumberOfPages = vi.fn().mockReturnValue(1);

// Mock jspdf - Use a class for constructor support
vi.mock('jspdf', () => {
  return {
    default: function() {
      return {
        save: mockSave,
        text: mockText,
        setFontSize: mockSetFontSize,
        setTextColor: mockSetTextColor,
        internal: {
          getNumberOfPages: mockGetNumberOfPages,
          pageSize: { height: 297, getWidth: () => 210, getHeight: () => 297 }
        }
      };
    }
  };
});

// Mock jspdf-autotable
vi.mock('jspdf-autotable', () => ({
  default: vi.fn()
}));

import autoTable from 'jspdf-autotable';

describe('pdfExport utility', () => {
  const mockLogs: Log[] = [
    {
      id: '1',
      userId: 'user1',
      timestamp: Timestamp.fromDate(new Date('2024-01-01')),
      brand: 'Circle K',
      cost: 60.00,
      distanceKm: 500,
      fuelAmountLiters: 40,
    }
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should instantiate jsPDF and call autoTable', () => {
    exportLogsToPDF(mockLogs, 'Test User', 'Jan 2024');

    // Verify autoTable was called
    expect(autoTable).toHaveBeenCalled();

    const autoTableArgs = vi.mocked(autoTable).mock.calls[0][1];
    expect(autoTableArgs?.body).toHaveLength(1);
    
    // Check first row data
    const firstRow = autoTableArgs?.body ? autoTableArgs.body[0] : [];
    expect(firstRow).toContain('Circle K');
    expect(firstRow).toContain('€60.00');
    
    // Check that save was called
    expect(mockSave).toHaveBeenCalled();
  });
});
