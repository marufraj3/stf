import { apiRequest } from './api';
import { db } from './db';

export interface ScanResult {
  scannedCount: number;
  generatedCount: number;
  duplicateCount: number;
  skippedCount: number;
}

class ExpiryReminderEngine {
  async runScan(): Promise<ScanResult> {
    const selected = db.getSelectedCompanyId();
    const result = await apiRequest<ScanResult>('/reminders/scan', {
      method: 'POST',
      body: JSON.stringify({ companyId: selected === 'all' ? null : Number(selected) }),
    });
    await db.initialize();
    return result;
  }

  async scanAndDispatch(): Promise<{ dispatched: number; skipped: number }> {
    const result = await this.runScan();
    return {
      dispatched: result.generatedCount,
      skipped: result.duplicateCount + result.skippedCount,
    };
  }
}

export const reminderEngine = new ExpiryReminderEngine();
