export interface XtreamAccount {
  id?: number;
  domain: string;
  username: string;
  password: string;
  status: 'Active' | 'Expired' | 'Banned' | 'Disabled' | 'Invalid' | 'Server Error' | 'Timeout' | 'Unknown';
  is_valid: boolean;
  exp_date?: string;
  max_connections?: number;
  active_cons?: number;
  is_trial?: boolean;
  server_name?: string;
  timezone?: string;
  response_time_ms?: number;
  last_checked?: string;
  raw_data?: any;
  created_at?: string;
}

export interface ParseResult {
  accounts: Array<{ domain: string; username: string; password: string; lineIndex: number }>;
  totalLines: number;
  validLines: number;
  invalidLines: number;
}

export interface ValidationProgress {
  total: number;
  completed: number;
  valid: number;
  expired: number;
  invalid: number;
  speed: number; // tests per sec
  isRunning: boolean;
  results: XtreamAccount[];
  currentBatchId?: string;
}

export interface DatabaseStats {
  total: number;
  valid: number;
  expired: number;
  invalid: number;
  expiringSoon: number; // in next 7 days
  totalMaxConnections: number;
}

export type LicenseTier = 'free' | 'standard' | 'pro_vip';

export interface LicenseDevice {
  hwid: string;
  name: string;
  lastSeen: string;
  isCurrent: boolean;
}

export interface LicenseInfo {
  key: string;
  tier: 'standard' | 'pro_vip';
  email: string;
  maxDevices: number;
  devicesCount: number;
  devices: LicenseDevice[];
  createdAt?: string;
  status?: string;
}

export interface PaymentOrder {
  orderId: string;
  tier: 'standard' | 'pro_vip';
  email: string;
  amountUsd: number;
  paymentMethod: 'crypto_binance' | 'crypto_cryptocom' | 'crypto_usdt' | 'crypto_btc' | 'payoneer';
  createdAt: number;
}

