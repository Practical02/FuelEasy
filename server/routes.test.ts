import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { registerRoutes } from './routes';
import { storage } from './storage';

// Mock the storage module with specific functions
vi.mock('./storage', () => ({
  storage: {
    getAccountHeads: vi.fn(),
    createAccountHead: vi.fn(),
    createPayment: vi.fn(),
    getSale: vi.fn(),
    getPaymentsBySale: vi.fn(),
    updateSaleStatus: vi.fn(),
    createStock: vi.fn(),
    getCashbookEntries: vi.fn(),
    createCashbookEntry: vi.fn(),
    markDebtAsPaid: vi.fn(),
  },
}));

describe('API Routes', () => {
  let app: express.Express;

  beforeEach(async () => {
    app = express();
    app.use(express.json());
    await registerRoutes(app);
    vi.clearAllMocks();
  });

  describe('/api/account-heads', () => {
    it('GET /api/account-heads should return a list of account heads', async () => {
      const mockAccountHeads = [
        { id: 'ah1', name: 'Client A', type: 'Client' },
        { id: 'ah2', name: 'Maintenance', type: 'Expense' },
      ];
      (storage.getAccountHeads as vi.Mock).mockResolvedValue(mockAccountHeads);

      const res = await request(app).get('/api/account-heads');

      expect(res.statusCode).toEqual(200);
      expect(res.body).toEqual(mockAccountHeads);
    });
  });

  // ... (other tests remain the same)
});