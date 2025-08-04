import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Sales from './sales';
import { QueryClientProvider, QueryClient } from '@tanstack/react-query';
import '@testing-library/jest-dom';
import { apiRequest } from '@/lib/queryClient';

// ... (mock setup remains the same)

describe('Sales Page', () => {
  // ... (beforeEach setup)

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

  it('opens Edit Sale modal when "Edit" button is clicked', async () => {
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
      expect(screen.getByText(/Edit Sale/)).toBeInTheDocument();
    });
  });

  // ... (add waitFor to other tests as well)
});