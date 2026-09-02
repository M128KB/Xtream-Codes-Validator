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
  userId?: string;
  dbFilename?: string;
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
  id?: number;
  order_id: string;
  email: string;
  tier: 'standard' | 'pro_vip';
  amount_usd: number;
  payment_type: 'okx_internal' | 'okx_trc20';
  tx_hash: string;
  status: 'pending' | 'approved' | 'rejected';
  license_key?: string | null;
  created_at: string;
  notes?: string;
}

export interface AdminSubscriptionStats {
  totalRevenueUsd: number;
  totalLicenses: number;
  activeLicenses: number;
  bannedLicenses: number;
  standardLicenses: number;
  vipLicenses: number;
  totalDevices: number;
  pendingOrders: number;
  approvedOrders: number;
  rejectedOrders: number;
}

export interface AdminLicenseItem {
  key: string;
  tier: 'standard' | 'pro_vip';
  email: string;
  max_devices: number;
  created_at: string;
  status: 'active' | 'banned' | 'expired';
  payment_method: string;
  payment_ref: string;
  notes?: string;
  devices_count: number;
  devices?: Array<{
    id: number;
    license_key: string;
    device_hwid: string;
    device_name: string;
    last_ip: string;
    last_seen_at: string;
    created_at: string;
  }>;
}

export interface StreamCategory {
  category_id: string;
  category_name: string;
  parent_id?: number;
}

export interface LiveStreamItem {
  num: number;
  name: string;
  stream_type: string;
  stream_id: number;
  stream_icon: string;
  epg_channel_id: string;
  added: string;
  category_id: string;
  custom_sid: string;
  tv_archive: number;
  direct_source: string;
  tv_archive_duration: number;
}

export interface VodStreamItem {
  num: number;
  name: string;
  stream_type: string;
  stream_id: number;
  stream_icon: string;
  rating?: string;
  rating_5based?: number;
  added: string;
  category_id: string;
  container_extension: string;
  custom_sid: string;
  direct_source: string;
}

export interface EpgProgram {
  id: string;
  epg_id: string;
  title: string;
  lang: string;
  start: string;
  end: string;
  description: string;
  channel_id: string;
  start_timestamp: string;
  stop_timestamp: string;
  now_playing?: boolean;
}




