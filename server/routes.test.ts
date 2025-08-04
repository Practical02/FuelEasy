import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { registerRoutes } from './routes';
import { storage } from './storage'; // Import the actual storage instance

// Mock the storage module
vi.mock('./storage', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    storage: {
      ...actual.storage,
      getAccountHeads: vi.fn(),
      createAccountHead: vi.fn(),
      // Mock other storage methods as needed for route tests
      getSales: vi.fn(),
      getClients: vi.fn(),
      createPayment: vi.fn(),
      createStock: vi.fn(),
      getPaymentsBySale: vi.fn(),
      getSale: vi.fn(),
      updateSaleStatus: vi.fn(),
      getCashbookEntries: vi.fn(),
      getCashbookEntry: vi.fn(),
      markDebtAsPaid: vi.fn(),
    },
  };
});

describe('API Routes', () => {
  let app: express.Express;

  beforeEach(async () => {
    app = express();
    app.use(express.json());
    await registerRoutes(app);

    // Reset mocks before each test
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
      expect(storage.getAccountHeads).toHaveBeenCalledTimes(1);
    });

    it('POST /api/account-heads should create a new account head', async () => {
      const newAccountHead = { name: 'New Head', type: 'Other' };
      const createdAccountHead = { id: 'new-ah-id', ...newAccountHead };
      (storage.createAccountHead as vi.Mock).mockResolvedValue(createdAccountHead);

      const res = await request(app).post('/api/account-heads').send(newAccountHead);

      expect(res.statusCode).toEqual(200);
      expect(res.body).toEqual(createdAccountHead);
      expect(storage.createAccountHead).toHaveBeenCalledWith(newAccountHead);
    });

    it('POST /api/account-heads should return 400 for invalid data', async () => {
      const invalidAccountHead = { name: 'Invalid' }; // Missing type

      const res = await request(app).post('/api/account-heads').send(invalidAccountHead);

      expect(res.statusCode).toEqual(400);
      expect(res.body.message).toBe('Invalid account head data');
      expect(storage.createAccountHead).not.toHaveBeenCalled();
    });
  });

  describe('/api/payments', () => {
    it('POST /api/payments should create a payment and trigger cashbook entry', async () => {
      const mockPaymentData = {
        saleId: 'sale-123',
        paymentDate: new Date().toISOString(),
        amountReceived: 100.00,
        paymentMethod: 'Cash',
      };
      const createdPayment = { id: 'payment-id', ...mockPaymentData };

      (storage.createPayment as vi.Mock).mockResolvedValue(createdPayment);
      (storage.getSale as vi.Mock).mockResolvedValue({ id: 'sale-123', totalAmount: '200.00', saleStatus: 'Invoiced' });
      (storage.getPaymentsBySale as vi.Mock).mockResolvedValue([]);
      (storage.updateSaleStatus as vi.Mock).mockResolvedValue({});

      const res = await request(app).post('/api/payments').send(mockPaymentData);

      expect(res.statusCode).toEqual(200);
      expect(res.body).toEqual(createdPayment);
      expect(storage.createPayment).toHaveBeenCalledWith(expect.objectContaining({
        amountReceived: mockPaymentData.amountReceived.toString(),
      }));
    });
  });

  describe('/api/stock', () => {
    it('POST /api/stock should create stock and trigger cashbook entry', async () => {
      const mockStockData = {
        purchaseDate: new Date().toISOString(),
        quantityGallons: 100,
        purchasePricePerGallon: 5,
        vatPercentage: 5,
      };
      const createdStock = { id: 'stock-id', ...mockStockData };

      (storage.createStock as vi.Mock).mockResolvedValue(createdStock);

      const res = await request(app).post('/api/stock').send(mockStockData);

      expect(res.statusCode).toEqual(200);
      expect(res.body).toEqual(createdStock);
      expect(storage.createStock).toHaveBeenCalledWith(expect.objectContaining({
        quantityGallons: mockStockData.quantityGallons.toString(),
        purchasePricePerGallon: mockStockData.purchasePricePerGallon.toString(),
      }));
    });
  });

  describe('/api/cashbook', () => {
    it('GET /api/cashbook should return cashbook entries', async () => {
      const mockCashbookEntries = [
        { id: 'cb1', description: 'Entry 1', accountHead: { name: 'Client A' } },
      ];
      (storage.getCashbookEntries as vi.Mock).mockResolvedValue(mockCashbookEntries);

      const res = await request(app).get('/api/cashbook');

      expect(res.statusCode).toEqual(200);
      expect(res.body).toEqual(mockCashbookEntries);
      expect(storage.getCashbookEntries).toHaveBeenCalledTimes(1);
    });

    it('POST /api/cashbook should create a new cashbook entry', async () => {
      const newEntry = {
        transactionDate: new Date().toISOString(),
        transactionType: 'Expense',
        accountHeadId: 'ah-expense',
        amount: 50,
        isInflow: 0,
        description: 'Office supplies',
        counterparty: 'Office Depot',
        paymentMethod: 'Cash',
        referenceType: 'manual',
        isPending: 0,
        notes: ''
      };
      const createdEntry = { id: 'new-cb-id', ...newEntry };
      (storage.createCashbookEntry as vi.Mock).mockResolvedValue(createdEntry);

      const res = await request(app).post('/api/cashbook').send(newEntry);

      expect(res.statusCode).toEqual(200);
      expect(res.body).toEqual(createdEntry);
      expect(storage.createCashbookEntry).toHaveBeenCalledWith(expect.objectContaining({
        amount: newEntry.amount.toFixed(2),
      }));
    });

    it('POST /api/cashbook/pay-debt/:id should mark debt as paid and create payment entry', async () => {
      const debtId = 'debt-123';
      const paymentData = {
        paidAmount: 100,
        paymentMethod: 'Bank Transfer',
        paymentDate: new Date().toISOString(),
      };
      const updatedDebt = { id: debtId, isPending: 0 };
      (storage.markDebtAsPaid as vi.Mock).mockResolvedValue(updatedDebt);

      const res = await request(app).post(`/api/cashbook/pay-debt/${debtId}`).send(paymentData);

      expect(res.statusCode).toEqual(200);
      expect(res.body).toEqual(updatedDebt);
      expect(storage.markDebtAsPaid).toHaveBeenCalledWith(
        debtId,
        paymentData.paidAmount,
        paymentData.paymentMethod,
        expect.any(Date)
      );
    });
  });
});