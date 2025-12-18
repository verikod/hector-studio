import { authStore } from './store'
import { net, shell } from 'electron'
import { EventEmitter } from 'events'
import { generatePKCE, startLoopbackServer, waitForCode } from './utils'

export interface AuthConfig {
  enabled: boolean
  type: string
  issuer: string
  audience: string
  clientId?: string
}

import http from 'http'

export class AuthManager extends EventEmitter {
  private activeLoopbackServer: http.Server | null = null

  async discoverAuth(serverUrl: string): Promise<AuthConfig | null> {
    try {
      const response = await net.fetch(`${serverUrl}/health`)
      if (!response.ok) return null
      
      const data = await response.json() as any
      if (data && data.auth && data.auth.enabled) {
        return {
          enabled: true,
          type: data.auth.type || 'jwt',
          issuer: data.auth.issuer,
          audience: data.auth.audience,
          clientId: data.auth.client_id
        }
      }
      return null
    } catch (error: any) {
      // Suppress connection refused errors during startup/polling
      if (error.message && (error.message.includes('ERR_CONNECTION_REFUSED') || error.code === 'ECONNREFUSED')) {
        return null
      }
      console.error('Failed to discover auth:', error)
      return null
    }
  }

  async login(serverUrl: string, defaultClientId: string): Promise<void> {
    const config = await this.discoverAuth(serverUrl)
    if (!config) {
      throw new Error('Server does not support authentication')
    }

    // Use server-provided client ID if available, otherwise use default
    const clientId = config.clientId || defaultClientId

    if (config.type === 'jwt') {
      // 1. Fetch OIDC config
      // Ensure no double slash issues
      const issuer = config.issuer.endsWith('/') ? config.issuer.slice(0, -1) : config.issuer
      const oidcConfigUrl = `${issuer}/.well-known/openid-configuration`
      
      console.log('Fetching OIDC config from:', oidcConfigUrl)
      
      const oidcRes = await net.fetch(oidcConfigUrl)
      if (!oidcRes.ok) throw new Error(`Failed to fetch OIDC configuration: ${oidcRes.status} ${oidcRes.statusText}`)
      const oidcConfig = await oidcRes.json() as any

      // 2. Generate PKCE
      const { codeVerifier, codeChallenge } = generatePKCE()

      // 3. Start Loopback
      // Ensure any previous server is closed to avoid EADDRINUSE
      if (this.activeLoopbackServer) {
        try {
            console.log('Closing previous loopback server...')
            this.activeLoopbackServer.close()
        } catch (e) {
            console.error('Error closing previous server:', e)
        }
        this.activeLoopbackServer = null
      }

      const { server, redirectUri } = await startLoopbackServer()
      this.activeLoopbackServer = server

      try {
        // 4. Build Auth URL
        const authUrl = new URL(oidcConfig.authorization_endpoint)
        authUrl.searchParams.set('response_type', 'code')
        authUrl.searchParams.set('client_id', clientId)
        authUrl.searchParams.set('redirect_uri', redirectUri)
        authUrl.searchParams.set('scope', 'openid profile email offline_access')
        authUrl.searchParams.set('code_challenge', codeChallenge)
        authUrl.searchParams.set('code_challenge_method', 'S256')
        if (config.audience) {
          authUrl.searchParams.set('audience', config.audience)
        }

        // 5. Open Browser
        await shell.openExternal(authUrl.toString())

        // 6. Wait for Code
        const code = await waitForCode(server)

        // 7. Exchange Code
        const tokenParams = new URLSearchParams()
        tokenParams.set('grant_type', 'authorization_code')
        tokenParams.set('client_id', clientId)
        tokenParams.set('code', code)
        tokenParams.set('redirect_uri', redirectUri)
        tokenParams.set('code_verifier', codeVerifier)

        const tokenRes = await net.fetch(oidcConfig.token_endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: tokenParams.toString()
        })

        if (!tokenRes.ok) throw new Error('Failed to exchange code for token')
        const tokens = await tokenRes.json() as any

        // DECODE & LOG ROLE (for verification)
        try {
            const payload = JSON.parse(Buffer.from(tokens.access_token.split('.')[1], 'base64').toString());
            console.log('--- LOGIN SUCCESS ---');
            console.log('User:', payload.email || payload.sub);
            console.log('Role Claim:', payload.role || payload['https://hector.dev/role'] || 'NONE FOUND');
            console.log('---------------------');
        } catch (e) {
            console.error('Failed to decode token for logging', e);
        }

        // 8. Store Token
        await authStore.setToken(serverUrl, tokens.access_token)
        this.emit('auth-changed', { serverUrl, authenticated: true })

      } finally {
        server.close()
        this.activeLoopbackServer = null
      }
    }
  }

  async logout(serverUrl: string): Promise<void> {
    await authStore.deleteToken(serverUrl)
    this.emit('auth-changed', { serverUrl, authenticated: false })
  }

  async isAuthenticated(serverUrl: string): Promise<boolean> {
    const token = await authStore.getToken(serverUrl)
    return !!token
  }
  
  async getToken(serverUrl: string): Promise<string | null> {
    return authStore.getToken(serverUrl)
  }
}

export const authManager = new AuthManager()
