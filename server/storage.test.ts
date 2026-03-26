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

  describe('incremental FIFO replay', () => {
    it('updateSale should trigger anchor-based FIFO replay from updated sale', async () => {
      const now = new Date('2026-01-10T10:00:00.000Z');
      const updatedSaleRow = {
        id: 'sale-updated',
        saleDate: now,
        createdAt: now,
      };

      (db.update as vi.Mock).mockReturnValue({
        set: vi.fn(() => ({
          where: vi.fn(() => ({
            returning: vi.fn(() => [updatedSaleRow]),
          })),
        })),
      });
      (db.select as vi.Mock).mockReturnValue({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(() => [updatedSaleRow]),
          })),
        })),
      });

      const replaySpy = vi
        .spyOn(storage as any, 'reapplyFIFOCostsFromAnchor')
        .mockResolvedValue(undefined);

      const payload = {
        clientId: 'c1',
        projectId: 'p1',
        saleDate: now,
        quantityGallons: '100',
        salePricePerGallon: '10',
        purchasePricePerGallon: '8',
        lpoNumber: 'LPO-1',
        deliveryNoteNumber: 'DN-1',
        saleStatus: 'LPO Received',
        vatPercentage: '5.00',
      } as any;

      await storage.updateSale('sale-updated', payload);

      expect(replaySpy).toHaveBeenCalledWith({
        saleDate: now,
        createdAt: now,
        id: 'sale-updated',
      });
    });

    it('anchor replay should fail when stock is insufficient', async () => {
      // First select() chain for stock batches: none available
      (db.select as vi.Mock)
        .mockReturnValueOnce({
          from: vi.fn(() => ({
            orderBy: vi.fn(() => []),
          })),
        })
        // Second select() chain for sales list: one sale requiring stock
        .mockReturnValueOnce({
          from: vi.fn(() => ({
            orderBy: vi.fn(() => [
              {
                id: 'sale-1',
                saleDate: new Date('2026-01-01T00:00:00.000Z'),
                createdAt: new Date('2026-01-01T00:00:01.000Z'),
                quantityGallons: '50',
                subtotal: '500',
              },
            ]),
          })),
        });

      await expect(
        (storage as any).computeReplayedFifoCostsFromAnchor({
          saleDate: new Date('2026-01-01T00:00:00.000Z'),
          createdAt: new Date('2026-01-01T00:00:01.000Z'),
          id: 'sale-1',
        }),
      ).rejects.toMatchObject({
        name: 'FifoInsufficientStockError',
        code: 'FIFO_INSUFFICIENT_STOCK',
      });
    });
  });

  describe('createInvoiceForLPO concurrency guards', () => {
    it('returns existing invoice for duplicate invoice number', async () => {
      const existingInvoice = {
        id: 'inv-existing',
        saleId: 'sale-1',
        invoiceNumber: 'INV-1001',
      };

      (db.select as vi.Mock).mockReturnValueOnce({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(() => [existingInvoice]),
          })),
        })),
      });

      const result = await storage.createInvoiceForLPO({
        lpoNumber: 'LPO-1',
        invoiceNumber: 'INV-1001',
        invoiceDate: new Date(),
      });

      expect(result).toEqual(existingInvoice);
      expect(db.insert).not.toHaveBeenCalled();
    });

    it('rolls back created invoice when a sale becomes ineligible mid-process', async () => {
      (db.select as vi.Mock)
        // Existing invoice lookup by invoice number
        .mockReturnValueOnce({
          from: vi.fn(() => ({
            where: vi.fn(() => ({
              limit: vi.fn(() => []),
            })),
          })),
        })
        // Candidate sales lookup
        .mockReturnValueOnce({
          from: vi.fn(() => ({
            where: vi.fn(() => [
              {
                id: 'sale-1',
                saleStatus: 'LPO Received',
                totalAmount: '120.00',
                vatAmount: '6.00',
              },
              {
                id: 'sale-2',
                saleStatus: 'Pending LPO',
                totalAmount: '180.00',
                vatAmount: '9.00',
              },
            ]),
          })),
        });

      const updateReturning = vi
        .fn()
        .mockReturnValueOnce([{ id: 'sale-1' }]) // first sale transition succeeds
        .mockReturnValueOnce([]); // second sale transition fails (concurrency case)
      const updateWhere = vi.fn(() => ({ returning: updateReturning }));
      (db.update as vi.Mock).mockReturnValue({
        set: vi.fn(() => ({ where: updateWhere })),
      });

      const deleteWhere = vi.fn(() => ({ returning: vi.fn(() => []) }));
      (db.delete as vi.Mock).mockReturnValue({ where: deleteWhere });

      await expect(
        storage.createInvoiceForLPO({
          lpoNumber: 'LPO-ROLLBACK',
          invoiceNumber: 'INV-ROLLBACK',
          invoiceDate: new Date(),
        }),
      ).rejects.toThrow(/no longer eligible/i);

      expect(db.delete).toHaveBeenCalled();
      expect(deleteWhere).toHaveBeenCalled();
      // First update transitions sale-1 to Invoiced; rollback should restore it.
      expect((db.update as vi.Mock).mock.calls.length).toBeGreaterThan(2);
    });

    it('handles candidate sale deleted in-between by failing safely and cleaning up invoice artifacts', async () => {
      (db.select as vi.Mock)
        .mockReturnValueOnce({
          from: vi.fn(() => ({
            where: vi.fn(() => ({
              limit: vi.fn(() => []),
            })),
          })),
        })
        .mockReturnValueOnce({
          from: vi.fn(() => ({
            where: vi.fn(() => [
              {
                id: 'sale-1',
                saleStatus: 'LPO Received',
                totalAmount: '100.00',
                vatAmount: '5.00',
              },
              {
                id: 'sale-2',
                saleStatus: 'Pending LPO',
                totalAmount: '200.00',
                vatAmount: '10.00',
              },
            ]),
          })),
        });

      const updateReturning = vi
        .fn()
        .mockReturnValueOnce([{ id: 'sale-1' }])
        // Simulate "sale-2 was deleted between read and update"
        .mockReturnValueOnce([])
        // Rollback call for sale-1
        .mockReturnValueOnce([{ id: 'sale-1' }]);
      const updateWhere = vi.fn(() => ({ returning: updateReturning }));
      (db.update as vi.Mock).mockReturnValue({
        set: vi.fn(() => ({ where: updateWhere })),
      });

      const deleteWhere = vi.fn(() => ({ returning: vi.fn(() => []) }));
      (db.delete as vi.Mock).mockReturnValue({ where: deleteWhere });

      await expect(
        storage.createInvoiceForLPO({
          lpoNumber: 'LPO-DELETED',
          invoiceNumber: 'INV-DELETED',
          invoiceDate: new Date(),
        }),
      ).rejects.toThrow(/no longer eligible/i);

      // Invoice row and invoice_sales rows should be cleaned up.
      expect(db.delete).toHaveBeenCalledTimes(2);
      expect(deleteWhere).toHaveBeenCalledTimes(2);
    });

    it('fails fast when no eligible sales remain for the LPO', async () => {
      (db.select as vi.Mock)
        .mockReturnValueOnce({
          from: vi.fn(() => ({
            where: vi.fn(() => ({
              limit: vi.fn(() => []),
            })),
          })),
        })
        .mockReturnValueOnce({
          from: vi.fn(() => ({
            where: vi.fn(() => []),
          })),
        });

      await expect(
        storage.createInvoiceForLPO({
          lpoNumber: 'LPO-NONE',
          invoiceNumber: 'INV-NONE',
          invoiceDate: new Date(),
        }),
      ).rejects.toThrow(/No eligible sales found/i);
    });
  });
});