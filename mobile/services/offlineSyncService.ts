import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';

export interface SyncOperation {
  id: string;
  type: 'CREATE' | 'UPDATE' | 'DELETE';
  entity: 'lead' | 'campaign';
  data: Record<string, any>;
  timestamp: number;
  entityId?: string;
}

export interface SyncQueue {
  operations: SyncOperation[];
  lastSyncTime: number;
  pendingCount: number;
}

class OfflineSyncService {
  private readonly QUEUE_KEY = 'offline_sync_queue';
  private readonly LAST_SYNC_KEY = 'last_sync_time';
  private isOnline = true;
  private isSyncing = false;
  private syncListeners: Array<(status: 'syncing' | 'synced' | 'offline') => void> = [];

  constructor() {
    this.initializeNetworkListener();
  }

  /**
   * Initialize network status listener
   */
  private initializeNetworkListener(): void {
    NetInfo.addEventListener((state) => {
      const wasOnline = this.isOnline;
      this.isOnline = state.isConnected ?? false;

      if (!wasOnline && this.isOnline) {
        console.log('Device came online, attempting sync');
        this.syncQueue();
      }

      if (this.isOnline !== wasOnline) {
        this.notifyListeners(this.isOnline ? 'offline' : 'offline');
      }
    });
  }

  /**
   * Register a listener for sync status changes
   */
  registerSyncListener(callback: (status: 'syncing' | 'synced' | 'offline') => void): () => void {
    this.syncListeners.push(callback);
    return () => {
      this.syncListeners = this.syncListeners.filter((listener) => listener !== callback);
    };
  }

  /**
   * Notify all listeners of sync status
   */
  private notifyListeners(status: 'syncing' | 'synced' | 'offline'): void {
    this.syncListeners.forEach((listener) => listener(status));
  }

  /**
   * Add operation to offline queue
   */
  async queueOperation(
    type: 'CREATE' | 'UPDATE' | 'DELETE',
    entity: 'lead' | 'campaign',
    data: Record<string, any>,
    entityId?: string
  ): Promise<void> {
    try {
      const queue = await this.getQueue();

      const operation: SyncOperation = {
        id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type,
        entity,
        data,
        timestamp: Date.now(),
        entityId,
      };

      queue.operations.push(operation);
      queue.pendingCount = queue.operations.length;

      await AsyncStorage.setItem(this.QUEUE_KEY, JSON.stringify(queue));
      console.log(`Operation queued: ${type} ${entity}`, operation.id);

      // Try to sync immediately if online
      if (this.isOnline) {
        this.syncQueue();
      }
    } catch (error) {
      console.error('Failed to queue operation:', error);
    }
  }

  /**
   * Get current sync queue
   */
  async getQueue(): Promise<SyncQueue> {
    try {
      const queueData = await AsyncStorage.getItem(this.QUEUE_KEY);
      if (queueData) {
        return JSON.parse(queueData);
      }
      return {
        operations: [],
        lastSyncTime: 0,
        pendingCount: 0,
      };
    } catch (error) {
      console.error('Failed to get queue:', error);
      return {
        operations: [],
        lastSyncTime: 0,
        pendingCount: 0,
      };
    }
  }

  /**
   * Sync queue with backend
   */
  async syncQueue(): Promise<boolean> {
    if (!this.isOnline || this.isSyncing) {
      return false;
    }

    try {
      this.isSyncing = true;
      this.notifyListeners('syncing');

      const queue = await this.getQueue();

      if (queue.operations.length === 0) {
        this.notifyListeners('synced');
        return true;
      }

      let successCount = 0;
      const failedOperations: SyncOperation[] = [];

      for (const operation of queue.operations) {
        try {
          const success = await this.executeOperation(operation);
          if (success) {
            successCount++;
          } else {
            failedOperations.push(operation);
          }
        } catch (error) {
          console.error('Error executing operation:', error);
          failedOperations.push(operation);
        }
      }

      // Update queue with failed operations only
      queue.operations = failedOperations;
      queue.pendingCount = failedOperations.length;
      queue.lastSyncTime = Date.now();

      await AsyncStorage.setItem(this.QUEUE_KEY, JSON.stringify(queue));

      console.log(`Sync completed: ${successCount} succeeded, ${failedOperations.length} failed`);

      this.notifyListeners('synced');
      return failedOperations.length === 0;
    } catch (error) {
      console.error('Failed to sync queue:', error);
      this.notifyListeners('offline');
      return false;
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Execute single operation against backend
   */
  private async executeOperation(operation: SyncOperation): Promise<boolean> {
    try {
      const endpoint = `http://localhost:3000/api/${operation.entity}s`;

      if (operation.type === 'CREATE') {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(operation.data),
        });
        return response.ok;
      } else if (operation.type === 'UPDATE') {
        const response = await fetch(`${endpoint}/${operation.entityId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(operation.data),
        });
        return response.ok;
      } else if (operation.type === 'DELETE') {
        const response = await fetch(`${endpoint}/${operation.entityId}`, {
          method: 'DELETE',
        });
        return response.ok;
      }

      return false;
    } catch (error) {
      console.error('Error executing operation:', error);
      return false;
    }
  }

  /**
   * Clear sync queue
   */
  async clearQueue(): Promise<void> {
    try {
      await AsyncStorage.removeItem(this.QUEUE_KEY);
      console.log('Sync queue cleared');
    } catch (error) {
      console.error('Failed to clear queue:', error);
    }
  }

  /**
   * Get sync status
   */
  async getSyncStatus(): Promise<{ isOnline: boolean; isSyncing: boolean; pendingOperations: number }> {
    try {
      const queue = await this.getQueue();
      return {
        isOnline: this.isOnline,
        isSyncing: this.isSyncing,
        pendingOperations: queue.operations.length,
      };
    } catch (error) {
      console.error('Failed to get sync status:', error);
      return {
        isOnline: this.isOnline,
        isSyncing: this.isSyncing,
        pendingOperations: 0,
      };
    }
  }

  /**
   * Get sync history
   */
  async getSyncHistory(): Promise<SyncOperation[]> {
    try {
      const queue = await this.getQueue();
      return queue.operations;
    } catch (error) {
      console.error('Failed to get sync history:', error);
      return [];
    }
  }

  /**
   * Retry failed operation
   */
  async retryOperation(operationId: string): Promise<boolean> {
    try {
      const queue = await this.getQueue();
      const operation = queue.operations.find((op) => op.id === operationId);

      if (!operation) {
        console.warn('Operation not found:', operationId);
        return false;
      }

      const success = await this.executeOperation(operation);

      if (success) {
        queue.operations = queue.operations.filter((op) => op.id !== operationId);
        queue.pendingCount = queue.operations.length;
        await AsyncStorage.setItem(this.QUEUE_KEY, JSON.stringify(queue));
      }

      return success;
    } catch (error) {
      console.error('Failed to retry operation:', error);
      return false;
    }
  }

  /**
   * Check if device is currently online
   */
  isDeviceOnline(): boolean {
    return this.isOnline;
  }

  /**
   * Manually trigger sync
   */
  async manualSync(): Promise<boolean> {
    console.log('Manual sync triggered');
    return this.syncQueue();
  }

  /**
   * Enable automatic syncing at intervals
   */
  enableAutoSync(intervalMs: number = 30000): () => void {
    const timer = setInterval(() => {
      if (this.isOnline && !this.isSyncing) {
        this.syncQueue();
      }
    }, intervalMs);

    return () => clearInterval(timer);
  }
}

// Export singleton instance
export const offlineSyncService = new OfflineSyncService();
