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

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        queryFn: async ({ queryKey }) => {
          const url = queryKey[0] as string;
          const res = await (apiRequest as unknown as (m: string, u: string) => Promise<Response>)(
            "GET",
            url,
          );
          return res.json();
        },
      },
    },
  });
}

const mockSales = [
  {
    id: 'sale-1',
    clientId: 'client-1',
    projectId: 'project-1',
    lpoNumber: 'LPO-001',
    totalAmount: '1000.00',
    saleStatus: 'Invoiced',
    client: { id: 'client-1', name: 'Client A' },
    project: {
      id: 'project-1',
      clientId: 'client-1',
      name: 'North Site',
      location: 'Zone A',
      description: null,
      status: 'Active',
      createdAt: new Date().toISOString(),
    },
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
    projectId: 'project-2',
    lpoNumber: 'LPO-002',
    totalAmount: '500.00',
    saleStatus: 'Pending LPO',
    client: { id: 'client-2', name: 'Client B' },
    project: {
      id: 'project-2',
      clientId: 'client-2',
      name: 'South Yard',
      location: '',
      description: null,
      status: 'Active',
      createdAt: new Date().toISOString(),
    },
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
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = createTestQueryClient();
    (apiRequest as unknown as import('vitest').MockInstance<any>).mockImplementation((...args) => {
      const [, url] = args;
      if (typeof url === 'string' && url.includes('/api/notifications/overdue-clients')) {
        return Promise.resolve({ json: () => Promise.resolve({ days: 30, data: [] }) });
      }
      if (typeof url === 'string' && url.startsWith('/api/sales?') && url.includes('page=')) {
        return Promise.resolve({
          json: () =>
            Promise.resolve({
              data: mockSales,
              pagination: { total: mockSales.length, totalPages: 1, page: 1, limit: 50 },
            }),
        });
      }
      if (url === '/api/clients') {
        return Promise.resolve({ json: () => Promise.resolve(mockClients) });
      }
      if (url === '/api/projects') {
        return Promise.resolve({ json: () => Promise.resolve([]) });
      }
      return Promise.reject(new Error('Unknown API route'));
    });
  });

  it('opens New Sale modal when "New Sale" button is clicked', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <Sales />
      </QueryClientProvider>,
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
      expect(screen.getByText('Client A')).toBeInTheDocument();
    });

    const editButton = screen.getAllByRole('button', { name: /Edit/i })[0];
    fireEvent.click(editButton);

    await waitFor(() => {
      expect(screen.getByText(/Edit Sale/)).toBeInTheDocument();
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
      expect(screen.getByText('Client A')).toBeInTheDocument();
    });

    const viewButton = screen.getAllByRole('button', { name: /View/i })[0];
    fireEvent.click(viewButton);

    await waitFor(() => {
      expect(screen.getByText('Sale Details')).toBeInTheDocument();
      // Ensure PaymentModal is not open
      expect(screen.queryByText('Record Payment')).not.toBeInTheDocument();
    });
  });

  it('opens Payment modal when a payment-related button is clicked', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <Sales />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Client A')).toBeInTheDocument();
    });

    // Assuming a button that triggers payment modal exists and can be identified
    // For demonstration, let's say a button with "Pay" text exists for invoiced sales
    const payButton = screen.getAllByRole('button', { name: /credit-card/i })[0]; // Simplified selector
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
      expect(screen.getByText('Client A')).toBeInTheDocument();
    });

    const payButton = screen.getAllByRole('button', { name: /credit-card/i })[0]; // Simplified selector
    fireEvent.click(payButton);

    await waitFor(() => {
      expect(screen.getByText('Record Payment')).toBeInTheDocument();
    });

    // Close the payment modal (assuming a close button/action)
    const cancelButton = screen.getAllByRole('button', { name: /cancel/i })[0];
    fireEvent.click(cancelButton);

    await waitFor(() => {
      expect(screen.queryByText('Record Payment')).not.toBeInTheDocument();
    });

    // Now try to open another modal (e.g., Edit Sale) and ensure PaymentModal doesn't pop up
    const editButton = screen.getAllByRole('button', { name: /Edit/i })[0];
    fireEvent.click(editButton);

    await waitFor(() => {
      expect(screen.getByText(/Edit Sale/)).toBeInTheDocument();
      expect(screen.queryByText('Record Payment')).not.toBeInTheDocument();
    });
  });
});