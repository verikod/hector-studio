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

import { net } from 'electron'

// LemonSqueezy API base URL
const LEMONSQUEEZY_API_URL = 'https://api.lemonsqueezy.com/v1'

/**
 * Helper to make POST requests using Electron's net module
 * This is more reliable than fetch in Electron's main process
 */
async function makePostRequest(url: string, body: string): Promise<any> {
    return new Promise((resolve, reject) => {
        console.log('[license] Making request to:', url)
        
        const request = net.request({
            method: 'POST',
            url,
        })

        request.setHeader('Accept', 'application/json')
        request.setHeader('Content-Type', 'application/x-www-form-urlencoded')

        let responseData = ''
        let statusCode = 0

        request.on('response', (response) => {
            statusCode = response.statusCode
            console.log('[license] Response status:', statusCode)
            
            response.on('data', (chunk) => {
                responseData += chunk.toString()
            })
            response.on('end', () => {
                try {
                    resolve(JSON.parse(responseData))
                } catch (e) {
                    // Log the first 500 chars of response to debug HTML responses
                    console.error('[license] Failed to parse response (status', statusCode + '):', responseData.substring(0, 500))
                    reject(new Error(`Invalid JSON response (HTTP ${statusCode}): ${responseData.substring(0, 100)}`))
                }
            })
        })

        request.on('error', (error) => {
            console.error('[license] Network request error:', error)
            reject(error)
        })

        request.write(body)
        request.end()
    })
}

// Checkout URL for getting a license
export const CHECKOUT_URL = 'https://hector-studio.lemonsqueezy.com/checkout/buy/3156a964-32ee-41f1-936e-0ed76a56e671'

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
        const body = new URLSearchParams({ license_key: key }).toString()
        const data = await makePostRequest(`${LEMONSQUEEZY_API_URL}/licenses/validate`, body)
        console.log('[license] Validation response:', JSON.stringify(data, null, 2))
        
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
        const errorMessage = error instanceof Error ? error.message : String(error)
        return {
            valid: false,
            code: 'NETWORK_ERROR',
            message: `Failed to validate license: ${errorMessage}`
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
        const body = new URLSearchParams({
            license_key: key,
            instance_name: instanceName
        }).toString()
        
        const data = await makePostRequest(`${LEMONSQUEEZY_API_URL}/licenses/activate`, body)
        console.log('[license] Activation response:', JSON.stringify(data, null, 2))
        
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
