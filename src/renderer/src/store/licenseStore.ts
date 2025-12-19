import { create } from 'zustand';

interface LicenseState {
  // State
  isLicensed: boolean | null; // null = checking
  email: string | null;
  key: string | null;

  // Actions
  setLicenseStatus: (status: { isLicensed: boolean; email?: string | null; key?: string | null }) => void;
  clearLicense: () => void;
}

export const useLicenseStore = create<LicenseState>()((set) => ({
  isLicensed: null,
  email: null,
  key: null,

  setLicenseStatus: ({ isLicensed, email, key }) =>
    set({
      isLicensed,
      email: email ?? null,
      key: key ?? null,
    }),

  clearLicense: () =>
    set({
      isLicensed: false,
      email: null,
      key: null,
    }),
}));
