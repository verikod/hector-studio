/**
 * LemonSqueezy License API Client
 * 
 * Handles license validation for Hector Studio.
 * Users get licenses via LemonSqueezy checkout, then validate here.
 * 
 * Note: The License API endpoints don't require an API key!
 * The license_key itself is the authentication.
 * See: https://docs.lemonsqueezy.com/api/license-api
 */

// LemonSqueezy API base URL
const LEMONSQUEEZY_API_URL = 'https://api.lemonsqueezy.com/v1'

// Checkout URL for getting a license
export const CHECKOUT_URL = 'https://hector-studio.lemonsqueezy.com/checkout/buy/856e3874-0c11-4a1d-9c23-bc72a458b3a3'

export interface License {
    key: string
    email: string
    status: 'active' | 'inactive' | 'expired' | 'disabled'
    createdAt: string
    expiresAt: string | null
}

export interface LicenseValidation {
    valid: boolean
    code: string
    message: string
    license?: License
}

/**
 * Validate a license key with LemonSqueezy API.
 * No API key required - just the license_key.
 * https://docs.lemonsqueezy.com/api/license-api/validate-license-key
 */
export async function validateLicenseOnline(key: string): Promise<LicenseValidation> {
    try {
        const response = await fetch(`${LEMONSQUEEZY_API_URL}/licenses/validate`, {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: new URLSearchParams({
                license_key: key
            })
        })

        const data = await response.json()
        console.log('[license] Validation response:', data)
        
        if (data.valid === true) {
            const licenseKey = data.license_key || {}
            return {
                valid: true,
                code: 'VALID',
                message: 'License is valid',
                license: {
                    key: key,
                    email: licenseKey.customer_email || data.meta?.customer_email || '',
                    status: licenseKey.status || 'active',
                    createdAt: licenseKey.created_at || new Date().toISOString(),
                    expiresAt: licenseKey.expires_at || null
                }
            }
        } else {
            return {
                valid: false,
                code: data.error || 'INVALID',
                message: data.error || 'License validation failed'
            }
        }
    } catch (error) {
        console.error('[license] Validation error:', error)
        return {
            valid: false,
            code: 'NETWORK_ERROR',
            message: 'Failed to validate license. Please check your internet connection.'
        }
    }
}

/**
 * Activate a license key (increment activation count).
 * Call this after successful validation to track activations.
 * https://docs.lemonsqueezy.com/api/license-api/activate-license-key
 */
export async function activateLicense(key: string, instanceName: string = 'Hector Studio'): Promise<LicenseValidation> {
    try {
        const response = await fetch(`${LEMONSQUEEZY_API_URL}/licenses/activate`, {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: new URLSearchParams({
                license_key: key,
                instance_name: instanceName
            })
        })

        const data = await response.json()
        console.log('[license] Activation response:', data)
        
        if (data.activated === true) {
            const licenseKey = data.license_key || {}
            return {
                valid: true,
                code: 'ACTIVATED',
                message: 'License activated successfully',
                license: {
                    key: key,
                    email: licenseKey.customer_email || data.meta?.customer_email || '',
                    status: 'active',
                    createdAt: licenseKey.created_at || new Date().toISOString(),
                    expiresAt: licenseKey.expires_at || null
                }
            }
        } else {
            // If activation fails (maybe already activated), try validation
            return validateLicenseOnline(key)
        }
    } catch (error) {
        console.error('[license] Activation error:', error)
        // Fall back to validation only
        return validateLicenseOnline(key)
    }
}

/**
 * Get the checkout URL for acquiring a license.
 */
export function getCheckoutUrl(): string {
    return CHECKOUT_URL
}
