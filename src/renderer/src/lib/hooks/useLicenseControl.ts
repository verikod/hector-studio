import { useCallback, useState } from 'react';

export function useLicenseControl() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activate = useCallback(async (key: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await (window as any).api.license.activate(key);
      if (!result.success) {
        throw new Error(result.error || 'Invalid license key');
      }
      return result.license;
    } catch (err) {
      setError(String(err));
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const deactivate = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
        await (window as any).api.license.deactivate();
        return true;
    } catch (err) {
        setError(String(err));
        console.error('Failed to deactivate license:', err);
        throw err;
    } finally {
        setIsLoading(false);
    }
  }, []);

  const getStatus = useCallback(async () => {
      try {
          return await (window as any).api.license.getStatus();
      } catch (err) {
          console.error('Failed to get license status:', err);
          return null;
      }
  }, []);

  return {
    activate,
    deactivate,
    getStatus,
    isLoading,
    error
  };
}
