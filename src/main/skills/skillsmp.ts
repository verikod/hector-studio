import { net } from 'electron'

// SkillsMP API Configuration
// This key is embedded for distribution - read-only search operations
const SKILLSMP_API_URL = 'https://skillsmp.com/api/v1'
const SKILLSMP_API_KEY = 'sk_live_skillsmp_-i_fPp3aHl4FXkGuL1aUB3KY61wTFsfFFyArNzd6JeM'

// Response types based on SkillsMP API
export interface SkillsMPSkill {
  name: string
  description: string
  repo_url: string        // Full GitHub URL
  category: string
  stars?: number
  author?: string
  updated_at?: string
}

interface SkillsMPResponse {
  success: boolean
  data?: SkillsMPSkill[]
  error?: {
    code: string
    message: string
  }
}

/**
 * Helper to make authenticated requests to SkillsMP API
 */
function fetchSkillsMP(endpoint: string): Promise<SkillsMPResponse> {
  return new Promise((resolve, reject) => {
    const url = `${SKILLSMP_API_URL}${endpoint}`
    const request = net.request(url)
    
    request.setHeader('Authorization', `Bearer ${SKILLSMP_API_KEY}`)
    request.setHeader('User-Agent', 'Hector-Studio')
    request.setHeader('Accept', 'application/json')
    
    request.on('response', (response) => {
      let data = ''
      response.on('data', (chunk) => {
        data += chunk.toString()
      })
      response.on('end', () => {
        try {
          const parsed = JSON.parse(data)
          resolve(parsed)
        } catch (e) {
          reject(new Error(`Failed to parse SkillsMP response: ${e}`))
        }
      })
    })
    
    request.on('error', (error) => {
      reject(new Error(`SkillsMP request failed: ${error.message}`))
    })
    
    request.end()
  })
}

/**
 * Search skills using keywords
 * @param query - Search query string
 * @returns Array of matching skills
 */
export async function searchSkills(query: string): Promise<SkillsMPSkill[]> {
  const encodedQuery = encodeURIComponent(query)
  const response = await fetchSkillsMP(`/skills/search?q=${encodedQuery}`)
  
  if (!response.success) {
    console.error('SkillsMP search error:', response.error)
    return []
  }
  
  return response.data || []
}

/**
 * Search skills using AI semantic search
 * @param query - Natural language query
 * @returns Array of semantically matching skills
 */
export async function aiSearchSkills(query: string): Promise<SkillsMPSkill[]> {
  const encodedQuery = encodeURIComponent(query)
  const response = await fetchSkillsMP(`/skills/ai-search?q=${encodedQuery}`)
  
  if (!response.success) {
    console.error('SkillsMP AI search error:', response.error)
    return []
  }
  
  return response.data || []
}
