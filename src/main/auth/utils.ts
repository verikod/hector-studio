import { createHash, randomBytes } from 'crypto'
import http from 'http'
import { AddressInfo } from 'net'

export interface PKCEPair {
  codeVerifier: string
  codeChallenge: string
}

export function generatePKCE(): PKCEPair {
  const codeVerifier = base64URLEncode(randomBytes(32))
  const codeChallenge = base64URLEncode(createHash('sha256').update(codeVerifier).digest())
  return { codeVerifier, codeChallenge }
}

function base64URLEncode(buffer: Buffer): string {
  return buffer.toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')
}

export interface LoopbackResult {
  code: string
  server: http.Server
  redirectUri: string
}

export function startLoopbackServer(): Promise<LoopbackResult> {
  return new Promise((resolve, reject) => {
    const server = http.createServer(async (req, res) => {
      try {
        const url = new URL(req.url!, `http://127.0.0.1`)
        if (url.pathname !== '/callback') {
            // Very basic 404
            res.writeHead(404)
            res.end('Not found')
            return
        }

        const code = url.searchParams.get('code')
        if (code) {
          res.writeHead(200, { 'Content-Type': 'text/html' })
          res.end('<h1>Login successful!</h1><p>You can close this window now.</p><script>window.close()</script>')
          
          // Close server after response
           // We resolve the promise BEFORE the request comes in, so we can't resolve here. 
           // The structure needs to be: start server -> return port/callbackUrl -> wait for event.
           // Refactoring below.
        } else {
            res.writeHead(400)
            res.end('Missing code')
        }
      } catch (err) {
        console.error('Loopback error', err)
      }
    })

    server.listen(54321, '127.0.0.1', () => {
      const address = server.address() as AddressInfo
      const port = address.port
      resolve({
          code: '', // Placeholder
          server,
          redirectUri: `http://localhost:${port}/callback`
      })
    })

    server.on('error', reject)
  })
}

// Adjusted helper to wait for code
export function waitForCode(server: http.Server): Promise<string> {
    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
            server.close()
            reject(new Error('Timeout waiting for login callback'))
        }, 5 * 60 * 1000) // 5 min timeout

        server.on('request', (req) => {
             const url = new URL(req.url!, `http://127.0.0.1`)
             if (url.pathname === '/callback') {
                 const code = url.searchParams.get('code')
                 const error = url.searchParams.get('error')
                 
                 if (error) {
                     reject(new Error(error))
                 } else if (code) {
                     resolve(code)
                 }

                 // Clean up happens by caller closing server or timeout
                 clearTimeout(timeout)
             }
        })
    })
}
