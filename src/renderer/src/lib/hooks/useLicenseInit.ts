import { useEffect } from 'react';
import { useLicenseStore } from '../../store/licenseStore';

/**
 * Hook to initialize license store from main process.
 * Initial load only - event-driven updates handled by useStateInit.
 * Call this once at app root.
 */
export function useLicenseInit() {
  const setLicenseStatus = useLicenseStore((s) => s.setLicenseStatus);

  useEffect(() => {
    // Initial load only
    window.api.license.getStatus().then((status) => {
      setLicenseStatus({
        isLicensed: status.isLicensed,
        email: status.email,
        key: status.key,
      });
    });

    // NOTE: license:changed event is now handled by useStateInit
    // to avoid redundant state updates. This hook only handles initial load.
  }, [setLicenseStatus]);
}

