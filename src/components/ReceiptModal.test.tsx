import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import ReceiptModal from './ReceiptModal';

// Mock react-i18next so tests don't need a real i18n instance
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) => {
      const strings: Record<string, string> = {
        'logCard.receipt': 'Receipt',
      };
      return strings[key] ?? options?.defaultValue ?? key;
    },
  }),
}));

describe('ReceiptModal', () => {
  afterEach(() => {
    document.body.style.overflow = '';
  });

  it('renders the receipt image', () => {
    render(<ReceiptModal url="https://example.com/receipt.jpg" onClose={vi.fn()} />);

    const img = screen.getByAltText('Receipt');
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', 'https://example.com/receipt.jpg');
  });

  it('locks body scroll while open and restores it on unmount', () => {
    const { unmount } = render(<ReceiptModal url="https://example.com/receipt.jpg" onClose={vi.fn()} />);

    expect(document.body.style.overflow).toBe('hidden');

    unmount();

    expect(document.body.style.overflow).toBe('');
  });

  it('calls onClose when the close button is clicked', () => {
    const onClose = vi.fn();
    render(<ReceiptModal url="https://example.com/receipt.jpg" onClose={onClose} />);

    fireEvent.click(screen.getByLabelText('Close'));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when the backdrop is clicked', () => {
    const onClose = vi.fn();
    render(<ReceiptModal url="https://example.com/receipt.jpg" onClose={onClose} />);

    fireEvent.click(screen.getByRole('dialog'));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not call onClose when the image itself is clicked', () => {
    const onClose = vi.fn();
    render(<ReceiptModal url="https://example.com/receipt.jpg" onClose={onClose} />);

    fireEvent.click(screen.getByAltText('Receipt'));

    expect(onClose).not.toHaveBeenCalled();
  });

  it('calls onClose when the Escape key is pressed', () => {
    const onClose = vi.fn();
    render(<ReceiptModal url="https://example.com/receipt.jpg" onClose={onClose} />);

    fireEvent.keyDown(window, { key: 'Escape' });

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
