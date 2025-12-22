import Store from 'electron-store'

interface EnvVarsStore {
  globalEnvVars: Record<string, string>
}

const store = new Store<EnvVarsStore>({
  name: 'env-vars',
  defaults: {
    globalEnvVars: {}
  }
})

/**
 * Get global environment variables.
 * These serve as defaults for all workspaces.
 */
export function getGlobalEnvVars(): Record<string, string> {
  return store.get('globalEnvVars')
}

/**
 * Set global environment variables.
 * These serve as defaults for all workspaces.
 */
export function setGlobalEnvVars(envVars: Record<string, string>): void {
  store.set('globalEnvVars', envVars)
}

/**
 * Merge global and workspace env vars.
 * Workspace vars override globals with the same key.
 */
export function mergeEnvVars(
  workspaceEnvVars: Record<string, string> = {}
): Record<string, string> {
  const globalVars = getGlobalEnvVars()
  return {
    ...globalVars,      // base layer
    ...workspaceEnvVars // override layer
  }
}

/**
 * Convert env vars object to .env file format.
 */
export function formatAsEnvFile(envVars: Record<string, string>): string {
  const lines: string[] = []
  
  for (const [key, value] of Object.entries(envVars)) {
    // Quote values that contain special characters
    const needsQuotes = /[\s#=]/.test(value) || value.includes("'") || value.includes('"')
    const formattedValue = needsQuotes ? `"${value.replace(/"/g, '\\"')}"` : value
    lines.push(`${key}=${formattedValue}`)
  }
  
  return lines.join('\n') + '\n'
}
