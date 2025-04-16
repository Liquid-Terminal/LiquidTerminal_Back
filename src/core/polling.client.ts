export interface PollingClient {
  startPolling(): void;
  stopPolling(): void;
  isPolling(): boolean;
} 