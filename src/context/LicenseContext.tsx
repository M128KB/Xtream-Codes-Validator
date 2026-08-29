import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { LicenseTier, LicenseInfo } from '../types';
import { getOrCreateDeviceFingerprint, getFriendlyDeviceName } from '../utils/fingerprint';

interface LicenseContextType {
  tier: LicenseTier;
  isPro: boolean;
  licenseKey: string | null;
  licenseInfo: LicenseInfo | null;
  hwid: string;
  freeScanLimit: number;
  isUpgradeModalOpen: boolean;
  activeModalTab: 'pricing' | 'activate' | 'devices';
  openUpgradeModal: (tab?: 'pricing' | 'activate' | 'devices') => void;
  closeUpgradeModal: () => void;
  activateLicense: (key: string) => Promise<{ success: boolean; error?: string }>;
  deactivateLicense: () => void;
  disconnectDevice: (targetHwid: string) => Promise<{ success: boolean; error?: string }>;
  refreshLicense: () => Promise<void>;
  loading: boolean;
}

const LicenseContext = createContext<LicenseContextType | undefined>(undefined);

export const FREE_SCAN_LIMIT = 5;

export const LicenseProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [hwid] = useState<string>(() => getOrCreateDeviceFingerprint());
  const [licenseKey, setLicenseKey] = useState<string | null>(() => {
    return localStorage.getItem('xval_license_key');
  });
  const [tier, setTier] = useState<LicenseTier>('free');
  const [licenseInfo, setLicenseInfo] = useState<LicenseInfo | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState<boolean>(false);
  const [activeModalTab, setActiveModalTab] = useState<'pricing' | 'activate' | 'devices'>('pricing');

  const refreshLicense = useCallback(async () => {
    const savedKey = localStorage.getItem('xval_license_key');
    if (!savedKey) {
      setTier('free');
      setLicenseInfo(null);
      setLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/license/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: savedKey,
          hwid,
          deviceName: getFriendlyDeviceName(),
        }),
      });

      const data = await res.json();
      if (data.success && data.tier) {
        setTier(data.tier);
        setLicenseKey(savedKey);
        setLicenseInfo({
          key: savedKey,
          tier: data.tier,
          email: data.license?.email || '',
          maxDevices: data.maxDevices || 1,
          devicesCount: data.devicesCount || 1,
          devices: data.devices || [],
          createdAt: data.license?.created_at,
          status: data.license?.status,
        });
      } else {
        // If device limit or invalid, retain free tier
        console.warn('License check failed:', data.error);
        if (data.error && (data.error.includes('banned') || data.error.includes('Invalid'))) {
          localStorage.removeItem('xval_license_key');
          setLicenseKey(null);
        }
        setTier('free');
      }
    } catch (e) {
      console.error('License refresh network error', e);
      // Offline fallback: if key is present, retain standard
      if (savedKey) {
        setTier(savedKey.includes('VIP') ? 'pro_vip' : 'standard');
      }
    } finally {
      setLoading(false);
    }
  }, [hwid]);

  useEffect(() => {
    refreshLicense();
  }, [refreshLicense]);

  const activateLicense = async (key: string): Promise<{ success: boolean; error?: string }> => {
    const cleanKey = (key || '').trim().toUpperCase();
    if (!cleanKey) {
      return { success: false, error: 'Please enter a valid License Key.' };
    }

    try {
      const res = await fetch('/api/license/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: cleanKey,
          hwid,
          deviceName: getFriendlyDeviceName(),
        }),
      });

      const data = await res.json();
      if (data.success) {
        localStorage.setItem('xval_license_key', cleanKey);
        setLicenseKey(cleanKey);
        setTier(data.tier);
        setLicenseInfo({
          key: cleanKey,
          tier: data.tier,
          email: data.license?.email || '',
          maxDevices: data.maxDevices || 1,
          devicesCount: data.devicesCount || 1,
          devices: data.devices || [],
          createdAt: data.license?.created_at,
          status: data.license?.status,
        });
        return { success: true };
      } else {
        return {
          success: false,
          error: data.error || 'Failed to activate license. Check key or device limits.',
        };
      }
    } catch (err: any) {
      return { success: false, error: err.message || 'Network connection failed' };
    }
  };

  const deactivateLicense = () => {
    localStorage.removeItem('xval_license_key');
    setLicenseKey(null);
    setTier('free');
    setLicenseInfo(null);
  };

  const disconnectDevice = async (targetHwid: string): Promise<{ success: boolean; error?: string }> => {
    if (!licenseKey) {
      return { success: false, error: 'No active license.' };
    }

    try {
      const res = await fetch('/api/license/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: licenseKey,
          hwid: targetHwid,
        }),
      });
      const data = await res.json();
      if (data.success) {
        await refreshLicense();
        return { success: true };
      } else {
        return { success: false, error: data.error || 'Could not disconnect device' };
      }
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  };

  const openUpgradeModal = (tab: 'pricing' | 'activate' | 'devices' = 'pricing') => {
    setActiveModalTab(tab);
    setIsUpgradeModalOpen(true);
  };

  const closeUpgradeModal = () => {
    setIsUpgradeModalOpen(false);
  };

  const isPro = tier === 'standard' || tier === 'pro_vip';

  return (
    <LicenseContext.Provider
      value={{
        tier,
        isPro,
        licenseKey,
        licenseInfo,
        hwid,
        freeScanLimit: FREE_SCAN_LIMIT,
        isUpgradeModalOpen,
        activeModalTab,
        openUpgradeModal,
        closeUpgradeModal,
        activateLicense,
        deactivateLicense,
        disconnectDevice,
        refreshLicense,
        loading,
      }}
    >
      {children}
    </LicenseContext.Provider>
  );
};

export const useLicense = (): LicenseContextType => {
  const context = useContext(LicenseContext);
  if (!context) {
    throw new Error('useLicense must be used within a LicenseProvider');
  }
  return context;
};
