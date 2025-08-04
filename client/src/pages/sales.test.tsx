import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Sales from './sales';
import { QueryClientProvider, QueryClient } from '@tanstack/react-query';
import '@testing-library/jest-dom';
import { apiRequest } from '@/lib/queryClient'; // Import apiRequest for mocking

// Mock the useToast hook
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

const queryClient = new QueryClient();

const mockSales = [
  {
    id: 'sale-1',
    clientId: 'client-1',
    lpoNumber: 'LPO-001',
    totalAmount: '1000.00',
    saleStatus: 'Invoiced',
    client: { id: 'client-1', name: 'Client A' },
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
  },
  {
    id: 'sale-2',
    clientId: 'client-2',
    lpoNumber: 'LPO-002',
    totalAmount: '500.00',
    saleStatus: 'Pending LPO',
    client: { id: 'client-2', name: 'Client B' },
    project: null,
    saleDate: new Date().toISOString(),
    quantityGallons: '50',
    salePricePerGallon: '10',
    purchasePricePerGallon: '5',
    vatPercentage: '5',
    subtotal: '475',
    vatAmount: '25',
    cogs: '250',
    grossProfit: '225',
    createdAt: new Date().toISOString(),
  },
];

const mockClients = [
  { id: 'client-1', name: 'Client A' },
  { id: 'client-2', name: 'Client B' },
];

describe('Sales Page', () => {
  beforeEach(() => {
    // Reset mocks before each test
    vi.clearAllMocks();
    (apiRequest as vi.Mock).mockImplementation((method, url) => {
      if (url === '/api/sales') {
        return Promise.resolve({ json: () => Promise.resolve(mockSales) });
      }
      if (url === '/api/clients') {
        return Promise.resolve({ json: () => Promise.resolve(mockClients) });
      }
      return Promise.reject(new Error('Unknown API route'));
    });

    beforeEach(() => {
    // Reset mocks before each test
    vi.clearAllMocks();
    (apiRequest as vi.Mock).mockImplementation((method, url) => {
      if (url === '/api/sales') {
        return Promise.resolve({ json: () => Promise.resolve(mockSales) });
      }
      if (url === '/api/clients') {
        return Promise.resolve({ json: () => Promise.resolve(mockClients) });
      }
      return Promise.reject(new Error('Unknown API route'));
    });
  });
  });

  it('opens New Sale modal when "New Sale" button is clicked', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <Sales />
      </QueryClientProvider>
    );

    const newSaleButton = screen.getByRole('button', { name: /New Sale/i });
    fireEvent.click(newSaleButton);

    await waitFor(() => {
      expect(screen.getByText('Record New Sale')).toBeInTheDocument();
    });
  });

  it('opens Edit Sale modal when "Edit" button is clicked and closes PaymentModal', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <Sales />
      </QueryClientProvider>
    );

    // Wait for sales data to load and render
    await waitFor(() => {
      expect(screen.getByText('LPO-001')).toBeInTheDocument();
    });

    const editButton = screen.getAllByRole('button', { name: /Edit/i })[0];
    fireEvent.click(editButton);

    await waitFor(() => {
      expect(screen.getByText('Edit Sale')).toBeInTheDocument();
      // Ensure PaymentModal is not open
      expect(screen.queryByText('Record Payment')).not.toBeInTheDocument();
    });
  });

  it('opens View Sale modal when "View" button is clicked and closes PaymentModal', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <Sales />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('LPO-001')).toBeInTheDocument();
    });

    const viewButton = screen.getAllByRole('button', { name: /View/i })[0];
    fireEvent.click(viewButton);

    await waitFor(() => {
      expect(screen.getByText('Sale Details')).toBeInTheDocument();
      // Ensure PaymentModal is not open
      expect(screen.queryByText('Record Payment')).not.toBeInTheDocument();
    });
  });

  it('opens Payment modal when "Pay" button is clicked', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <Sales />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('LPO-001')).toBeInTheDocument();
    });

    const payButton = screen.getByRole('button', { name: /Pay/i });
    fireEvent.click(payButton);

    await waitFor(() => {
      expect(screen.getByText('Record Payment')).toBeInTheDocument();
    });
  });

  it('clears selectedSaleId when any modal is closed', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <Sales />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('LPO-001')).toBeInTheDocument();
    });

    const payButton = screen.getByRole('button', { name: /Pay/i });
    fireEvent.click(payButton);

    await waitFor(() => {
      expect(screen.getByText('Record Payment')).toBeInTheDocument();
    });

    // Close the payment modal
    fireEvent.click(screen.getByRole('button', { name: /Cancel/i }));

    await waitFor(() => {
      expect(screen.queryByText('Record Payment')).not.toBeInTheDocument();
    });

    // Now try to open another modal (e.g., Edit Sale) and ensure PaymentModal doesn't pop up
    const editButton = screen.getAllByRole('button', { name: /Edit/i })[0];
    fireEvent.click(editButton);

    await waitFor(() => {
      expect(screen.getByText('Edit Sale')).toBeInTheDocument();
      expect(screen.queryByText('Record Payment')).not.toBeInTheDocument();
    });
  });
});