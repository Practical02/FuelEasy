import '@testing-library/jest-dom';
import { beforeAll, afterEach, afterAll, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import { QueryClient } from '@tanstack/react-query';

// Mock apiRequest
vi.mock('@/lib/queryClient', () => ({
  apiRequest: vi.fn(),
  queryClient: new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  }),
}));

// Mock Drizzle ORM for backend tests
vi.mock('drizzle-orm', async (importOriginal) => {
  const mod = await importOriginal();
  return {
    ...(mod as object),
    eq: vi.fn(),
    desc: vi.fn(),
    sql: vi.fn(() => ({})), // Mock sql template literal function
  };
});

vi.mock('drizzle-orm/neon-http', () => ({
  drizzle: vi.fn(() => ({
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        orderBy: vi.fn(() => []), // Default empty array for select queries
        where: vi.fn(() => ({
          limit: vi.fn(() => []),
        })),
        leftJoin: vi.fn(() => ({
          orderBy: vi.fn(() => []),
          where: vi.fn(() => ({})),
        })),
      })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: vi.fn(() => [{ id: 'mock-id' }]), // Default mock ID for inserts
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => ({
          returning: vi.fn(() => [{ id: 'mock-id' }]),
        })),
      })),
    })),
    delete: vi.fn(() => ({
      where: vi.fn(() => ({
        returning: vi.fn(() => [{ id: 'mock-id' }]),
      })),
    })),
  })),
  neon: vi.fn(),
}));

// runs just once before all tests
beforeAll(() => {
  // Optional: setup for all tests
});

// runs after each test file
afterEach(() => {
  cleanup(); // Clean up DOM after each test
  vi.clearAllMocks(); // Clear mocks after each test
});

// runs just once after all tests
afterAll(() => {
  // Optional: teardown after all tests
});

// Mock matchMedia for Ant Design components
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // Deprecated
    removeListener: vi.fn(), // Deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});