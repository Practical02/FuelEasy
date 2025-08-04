import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DatabaseStorage } from './storage';
import { eq, desc, sql } from 'drizzle-orm';

// Mock the UUID generation
vi.mock('crypto', () => ({
  randomUUID: vi.fn(() => 'mock-uuid'),
}));

describe('DatabaseStorage', () => {
  let storage: DatabaseStorage;

  beforeEach(() => {
    storage = new DatabaseStorage();
    // Reset all mocks on db before each test
    vi.clearAllMocks();
    // Re-mock db methods to return predictable values
    (db.select as vi.Mock).mockReturnValue({
      from: vi.fn(() => ({
        orderBy: vi.fn(() => []),
        where: vi.fn(() => ({
          limit: vi.fn(() => []),
        })),
        leftJoin: vi.fn(() => ({
          orderBy: vi.fn(() => []),
          where: vi.fn(() => ({})),
        })),
      })),
    });
    (db.insert as vi.Mock).mockReturnValue({
      values: vi.fn(() => ({
        returning: vi.fn(() => [{ id: 'mock-id' }]),
      })),
    });
    (db.update as vi.Mock).mockReturnValue({
      set: vi.fn(() => ({
        where: vi.fn(() => ({
          returning: vi.fn(() => [{ id: 'mock-id' }]),
        })),
      })),
    });
    (db.delete as vi.Mock).mockReturnValue({
      where: vi.fn(() => ({
        returning: vi.fn(() => [{ id: 'mock-id' }]),
      })),
    });
  });

  describe('createClient', () => {
    it('should create a client and an associated account head', async () => {
      const mockClient = {
        name: 'Test Client',
        contactPerson: 'John Doe',
        phoneNumber: '1234567890',
        email: 'john@example.com',
        address: '123 Test St',
      };

      const createAccountHeadSpy = vi.spyOn(storage, 'createAccountHead');

      const result = await storage.createClient(mockClient);

      expect(db.insert).toHaveBeenCalledWith(expect.anything()); // clients table
      expect(db.insert).toHaveBeenCalledTimes(1);
      expect(result).toEqual(expect.objectContaining({ id: 'mock-id', ...mockClient }));
      expect(createAccountHeadSpy).toHaveBeenCalledWith({
        name: 'Test Client',
        type: 'Client',
      });
    });
  });

  describe('createPayment', () => {
    it('should create a payment and a cashbook entry', async () => {
      const mockPayment = {
        saleId: 'sale-123',
        paymentDate: new Date(),
        amountReceived: '100.00',
        paymentMethod: 'Cash',
        chequeNumber: null,
      };

      const mockSale = {
        id: 'sale-123',
        clientId: 'client-456',
        totalAmount: '200.00',
        saleStatus: 'Invoiced',
      };

      const mockClient = {
        id: 'client-456',
        name: 'Test Client',
      };

      // Mock getSale and getClient
      vi.spyOn(storage, 'getSale').mockResolvedValue(mockSale as any);
      vi.spyOn(storage, 'getClient').mockResolvedValue(mockClient as any);
      vi.spyOn(storage, 'getPaymentsBySale').mockResolvedValue([]);
      vi.spyOn(storage, 'updateSaleStatus').mockResolvedValue(mockSale as any);

      const createAccountHeadSpy = vi.spyOn(storage, 'createAccountHead');
      const createCashbookEntrySpy = vi.spyOn(storage, 'createCashbookEntry');

      const result = await storage.createPayment(mockPayment);

      expect(db.insert).toHaveBeenCalledWith(expect.anything()); // payments table
      expect(createAccountHeadSpy).toHaveBeenCalledWith({
        name: 'Test Client',
        type: 'Client',
      });
      expect(createCashbookEntrySpy).toHaveBeenCalledWith(expect.objectContaining({
        transactionType: 'Sale Revenue',
        amount: '100.00',
        isInflow: 1,
        description: expect.stringContaining('Payment received from Test Client'),
        counterparty: 'Test Client',
        paymentMethod: 'Cash',
        referenceType: 'payment',
        referenceId: 'mock-id',
        isPending: 0,
      }));
      expect(result).toEqual(expect.objectContaining({ id: 'mock-id', ...mockPayment }));
    });
  });

  describe('createStock', () => {
    it('should create stock and a cashbook entry for supplier', async () => {
      const mockStock = {
        purchaseDate: new Date(),
        quantityGallons: '100',
        purchasePricePerGallon: '5',
        vatPercentage: '5',
      };

      const createAccountHeadSpy = vi.spyOn(storage, 'createAccountHead');
      const createCashbookEntrySpy = vi.spyOn(storage, 'createCashbookEntry');

      const result = await storage.createStock(mockStock);

      expect(db.insert).toHaveBeenCalledWith(expect.anything()); // stock table
      expect(createAccountHeadSpy).toHaveBeenCalledWith({
        name: 'Sigma Diesel Trading Pvt Ltd',
        type: 'Supplier',
      });
      expect(createCashbookEntrySpy).toHaveBeenCalledWith(expect.objectContaining({
        transactionType: 'Stock Purchase',
        amount: expect.any(String),
        isInflow: 0,
        description: expect.stringContaining('Stock purchase'),
        counterparty: 'Sigma Diesel Trading Pvt Ltd',
        paymentMethod: 'Credit',
        referenceType: 'stock',
        referenceId: 'mock-id',
        isPending: 1,
      }));
      expect(result).toEqual(expect.objectContaining({ id: 'mock-id' }));
    });
  });

  describe('getCashbookEntries', () => {
    it('should fetch cashbook entries with account head details', async () => {
      const mockAccountHead = { id: 'head-1', name: 'Test Head', type: 'Other' };
      const mockCashbookEntry = {
        id: 'entry-1',
        transactionDate: new Date(),
        transactionType: 'Expense',
        accountHeadId: 'head-1',
        amount: '50.00',
        isInflow: 0,
        description: 'Test expense',
        counterparty: 'Test Counterparty',
        paymentMethod: 'Cash',
        referenceType: 'manual',
        referenceId: null,
        isPending: 0,
        notes: null,
        createdAt: new Date(),
      };

      // Mock the db.select().from().leftJoin().orderBy() chain
      (db.select as vi.Mock).mockReturnValue({
        from: vi.fn(() => ({
          leftJoin: vi.fn(() => ({
            orderBy: vi.fn(() => [
              { ...mockCashbookEntry, accountHead: mockAccountHead },
            ]),
          })),
        })),
      });

      const result = await storage.getCashbookEntries();

      expect(result).toEqual([
        { ...mockCashbookEntry, accountHead: mockAccountHead },
      ]);
      expect(db.select).toHaveBeenCalledWith(expect.objectContaining({
        accountHead: expect.anything(),
      }));
      expect(db.select().from).toHaveBeenCalledWith(expect.anything()); // cashbook table
      expect(db.select().from().leftJoin).toHaveBeenCalledWith(expect.anything(), eq(expect.anything(), expect.anything())); // accountHeads table
    });
  });

  describe('markDebtAsPaid', () => {
    it('should update debt status and create a new payment entry', async () => {
      const debtId = 'debt-123';
      const paidAmount = 100;
      const paymentMethod = 'Bank Transfer';
      const paymentDate = new Date();

      const mockOriginalDebt = {
        id: debtId,
        transactionDate: new Date(),
        transactionType: 'Stock Purchase',
        accountHeadId: 'supplier-head-id',
        amount: '150.00',
        isInflow: 0,
        description: 'Stock purchase debt',
        counterparty: 'Supplier A',
        paymentMethod: 'Credit',
        referenceType: 'stock',
        referenceId: 'stock-abc',
        isPending: 1,
        notes: null,
        createdAt: new Date(),
      };

      vi.spyOn(storage, 'getCashbookEntry').mockResolvedValue(mockOriginalDebt as any);

      const updateSpy = vi.spyOn(db, 'update');
      const insertSpy = vi.spyOn(db, 'insert');

      const result = await storage.markDebtAsPaid(debtId, paidAmount, paymentMethod, paymentDate);

      expect(updateSpy).toHaveBeenCalledWith(expect.anything()); // cashbook table
      expect(updateSpy().set).toHaveBeenCalledWith({ isPending: 0 });
      expect(updateSpy().set().where).toHaveBeenCalledWith(eq(expect.anything(), debtId));

      expect(insertSpy).toHaveBeenCalledWith(expect.anything()); // cashbook table
      expect(insertSpy().values).toHaveBeenCalledWith(expect.objectContaining({
        transactionDate: paymentDate,
        transactionType: 'Stock Payment',
        accountHeadId: 'supplier-head-id',
        amount: paidAmount.toFixed(2),
        isInflow: 0,
        description: expect.stringContaining('Debt payment for Supplier A'),
        paymentMethod: paymentMethod,
        referenceType: 'debt_payment',
        referenceId: debtId,
        isPending: 0,
        counterparty: 'Supplier A',
      }));
      expect(result).toEqual(expect.objectContaining({ id: 'mock-id' }));
    });
  });
});