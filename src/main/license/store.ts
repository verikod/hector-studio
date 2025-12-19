/**
 * Local License Storage
 * 
 * Stores license information locally for offline validation
 * and persistence across app restarts.
 */

import Store from 'electron-store'

interface StoredLicense {
    key: string
    email: string
    activatedAt: string
    lastValidated: string
    status: 'active' | 'inactive' | 'expired' | 'suspended'
}

interface LicenseStoreSchema {
    license: StoredLicense | null
}

const store = new Store<LicenseStoreSchema>({
    name: 'hector-license',
    defaults: {
        license: null
    }
})

/**
 * Get the stored license, if any.
 */
export function getStoredLicense(): StoredLicense | null {
    return store.get('license')
}

/**
 * Store a license after successful activation.
 */
export function storeLicense(key: string, email: string, status: StoredLicense['status'] = 'active'): void {
    const now = new Date().toISOString()
    store.set('license', {
        key,
        email,
        activatedAt: now,
        lastValidated: now,
        status
    })
    console.log('[license] Stored license for:', email)
}

/**
 * Update the last validated timestamp.
 */
export function updateLastValidated(): void {
    const license = store.get('license')
    if (license) {
        store.set('license.lastValidated', new Date().toISOString())
    }
}

/**
 * Update license status (e.g., if it expires or is suspended).
 */
export function updateLicenseStatus(status: StoredLicense['status']): void {
    const license = store.get('license')
    if (license) {
        store.set('license.status', status)
    }
}

/**
 * Remove the stored license (deactivation).
 */
export function removeLicense(): void {
    store.delete('license')
    console.log('[license] License removed')
}

/**
 * Check if the stored license can be used offline.
 * We allow offline use for up to 30 days since last validation.
 */
export function isOfflineValidationAllowed(): boolean {
    const license = getStoredLicense()
    if (!license) return false
    if (license.status !== 'active') return false

    const lastValidated = new Date(license.lastValidated)
    const now = new Date()
    const daysSinceValidation = (now.getTime() - lastValidated.getTime()) / (1000 * 60 * 60 * 24)

    // Allow offline use for 30 days
    return daysSinceValidation < 30
}

/**
 * Get license status summary for UI.
 */
export function getLicenseStatus(): {
    isLicensed: boolean
    email: string | null
    key: string | null
    activatedAt: string | null
    status: string | null
} {
    const license = getStoredLicense()
    if (!license) {
        return {
            isLicensed: false,
            email: null,
            key: null,
            activatedAt: null,
            status: null
        }
    }

    return {
        isLicensed: license.status === 'active',
        email: license.email,
        key: license.key,
        activatedAt: license.activatedAt,
        status: license.status
    }
}
