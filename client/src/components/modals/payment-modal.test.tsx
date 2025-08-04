import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import PaymentModal from './payment-modal';
import { QueryClientProvider, QueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

// Mock the useToast hook
const toastMock = vi.fn();
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: toastMock,
  }),
}));

const queryClient = new QueryClient();

const mockSale = {
  id: 'sale-123',
  clientId: 'client-456',
  lpoNumber: 'LPO-001',
  totalAmount: '1000.00',
  saleStatus: 'Invoiced',
  client: { name: 'Test Client' },
  project: null,
  saleDate: new Date().toISOString(),
  quantityGallons: '100',
  salePricePerGallon: '10',
  purchasePricePerGallon: '5',
  vatPercentage: '5',
  subtotal: '950',
  vatAmount: '50',
  cogs: '500',
  grossProfit: '450',
  createdAt: new Date().toISOString(),
};

const mockPayments = [
  {
    id: 'payment-001',
    saleId: 'sale-123',
    paymentDate: new Date().toISOString(),
    amountReceived: '200.00',
    paymentMethod: 'Cash',
    chequeNumber: null,
    createdAt: new Date().toISOString(),
  },
];

type ApiRequestMock = import('vitest').MockInstance<any>;
describe('PaymentModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    toastMock.mockClear(); // Clear mock calls before each test
  });

  it('renders correctly and shows sale details when saleId is provided', async () => {
    // Mock API responses
    (apiRequest as unknown as ApiRequestMock).mockImplementation((...args) => {
      const [method, url] = args;
      if (url === '/api/sales/sale-123') {
        return Promise.resolve({ json: () => Promise.resolve(mockSale) });
      }
      if (url === '/api/payments/sale/sale-123') {
        return Promise.resolve({ json: () => Promise.resolve(mockPayments) });
      }
      return Promise.reject(new Error('Unknown API route'));
    });

    render(
      <QueryClientProvider client={queryClient}>
        <PaymentModal open={true} onOpenChange={vi.fn()} saleId="sale-123" />
      </QueryClientProvider>
    );

    expect(screen.getByRole('heading', { name: /Record Payment/i })).toBeInTheDocument();
    await screen.findByText('Sale Details');
    expect(screen.getByText('Client:')).toBeInTheDocument();
    expect(screen.getByText('Test Client')).toBeInTheDocument();
    expect(screen.getByText('LPO Number:')).toBeInTheDocument();
    expect(screen.getByText('LPO-001')).toBeInTheDocument();
    expect(screen.getByText('Total Amount:')).toBeInTheDocument();
    expect(screen.getByText('Already Paid:')).toBeInTheDocument();
    expect(screen.getByText('Remaining:')).toBeInTheDocument();

    await screen.findByText(/AED\s*1,000\.00/);
    await screen.findByText(/AED\s*200\.00/);
    await screen.findByText(/AED\s*800\.00/);
  });

  it('handles form submission and calls createPaymentMutation', async () => {
    const onOpenChangeMock = vi.fn();

    // Mock API responses
    (apiRequest as unknown as ApiRequestMock).mockImplementation((...args) => {
      const [method, url, data] = args;
      if (url === '/api/sales/sale-123') {
        return Promise.resolve({ json: () => Promise.resolve(mockSale) });
      }
      if (url === '/api/payments/sale/sale-123') {
        return Promise.resolve({ json: () => Promise.resolve(mockPayments) });
      }
      if (url === '/api/payments' && method === 'POST') {
        return Promise.resolve({ json: () => Promise.resolve({ id: 'new-payment-id', ...(typeof data === 'object' && data !== null ? data : {}) }) });
      }
      return Promise.reject(new Error('Unknown API route'));
    });

    render(
      <QueryClientProvider client={queryClient}>
        <PaymentModal open={true} onOpenChange={onOpenChangeMock} saleId="sale-123" />
      </QueryClientProvider>
    );

    // Wait for sale details to load
    await screen.findByText(/AED\s*800\.00/);

    // Fill the form
    fireEvent.change(screen.getByLabelText(/Amount Received/i), { target: { value: '500' } });
    fireEvent.change(screen.getByLabelText(/Payment Method/i), { target: { value: 'Bank Transfer' } });

    // Submit the form
    fireEvent.click(screen.getByRole('button', { name: /Record Payment/i }));

    await waitFor(() => {
      expect(apiRequest).toHaveBeenCalledWith(
        'POST',
        '/api/payments',
        expect.objectContaining({
          saleId: 'sale-123',
          amountReceived: 500,
          paymentMethod: 'Bank Transfer',
        })
      );
      expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ title: 'Payment Recorded' }));
      expect(onOpenChangeMock).toHaveBeenCalledWith(false);
    });
  });

  it('shows validation error for amountReceived', async () => {
    const onOpenChangeMock = vi.fn();

    // Mock API responses
    (apiRequest as unknown as ApiRequestMock).mockImplementation((...args) => {
      const [method, url] = args;
      if (url === '/api/sales/sale-123') {
        return Promise.resolve({ json: () => Promise.resolve(mockSale) });
      }
      if (url === '/api/payments/sale/sale-123') {
        return Promise.resolve({ json: () => Promise.resolve(mockPayments) });
      }
      return Promise.reject(new Error('Unknown API route'));
    });

    render(
      <QueryClientProvider client={queryClient}>
        <PaymentModal open={true} onOpenChange={onOpenChangeMock} saleId="sale-123" />
      </QueryClientProvider>
    );

    // Wait for sale details to load
    await screen.findByText(/AED\s*800\.00/);

    // Set amount to 0
    fireEvent.change(screen.getByLabelText(/Amount Received/i), { target: { value: '0' } });

    // Submit the form
    fireEvent.click(screen.getByRole('button', { name: /Record Payment/i }));

    await waitFor(() => {
      expect(screen.getByText('Amount must be greater than 0.')).toBeInTheDocument();
    });
  });
});