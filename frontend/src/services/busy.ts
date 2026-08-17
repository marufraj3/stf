import { useSyncExternalStore } from 'react';

export type BusyState = {
  /** Number of in-flight write requests (POST/PUT/PATCH/DELETE). */
  mutations: number;
  /** Number of in-flight requests of any kind. */
  requests: number;
  /** Label shown inside the blocking overlay. */
  label: string;
};

type Listener = () => void;

const IDLE: BusyState = { mutations: 0, requests: 0, label: '' };

/**
 * Tiny global request tracker.
 *
 * Every API call funnels through here so the UI can always tell the admin that
 * something is happening: a thin progress bar for reads and a blocking overlay
 * with a spinner for writes. Blocking the screen while a write is running also
 * stops impatient double clicks from creating duplicate records.
 */
class BusyTracker {
  private state: BusyState = IDLE;
  private listeners = new Set<Listener>();
  private labels: string[] = [];

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = (): BusyState => this.state;

  start(kind: 'read' | 'write', label = ''): void {
    if (kind === 'write' && label) this.labels.push(label);
    this.publish({
      requests: this.state.requests + 1,
      mutations: this.state.mutations + (kind === 'write' ? 1 : 0),
    });
  }

  finish(kind: 'read' | 'write', label = ''): void {
    if (kind === 'write' && label) {
      const index = this.labels.indexOf(label);
      if (index >= 0) this.labels.splice(index, 1);
    }
    this.publish({
      requests: Math.max(0, this.state.requests - 1),
      mutations: Math.max(0, this.state.mutations - (kind === 'write' ? 1 : 0)),
    });
  }

  /** Wrap any promise so the global overlay covers non-HTTP work too. */
  async track<T>(label: string, work: () => Promise<T>): Promise<T> {
    this.start('write', label);
    try {
      return await work();
    } finally {
      this.finish('write', label);
    }
  }

  private publish(next: { requests: number; mutations: number }): void {
    this.state = {
      requests: next.requests,
      mutations: next.mutations,
      label: this.labels[this.labels.length - 1] || 'Working…',
    };
    this.listeners.forEach(listener => listener());
  }
}

export const busyTracker = new BusyTracker();

export function useBusyState(): BusyState {
  return useSyncExternalStore(busyTracker.subscribe, busyTracker.getSnapshot, busyTracker.getSnapshot);
}
