import { db } from './db';

class NotificationDispatcher {
  async retryNotification(logId: string): Promise<void> {
    await db.retryNotification(logId);
  }
}

export const notificationDispatcher = new NotificationDispatcher();
