import { net } from 'electron'

// SkillsMP API Configuration
// This key is embedded for distribution - read-only search operations
const SKILLSMP_API_URL = 'https://skillsmp.com/api/v1'
const SKILLSMP_API_KEY = 'sk_live_skillsmp_-i_fPp3aHl4FXkGuL1aUB3KY61wTFsfFFyArNzd6JeM'

// Response types based on SkillsMP API (actual response structure)
export interface SkillsMPSkill {
  id: string
  name: string
  description: string
  githubUrl: string
  skillUrl?: string
  category?: string
  stars?: number
  author?: string
  updatedAt?: number
}

export interface SkillsMPPagination {
  page: number
  limit: number
  total: number
  totalPages: number
  hasNext: boolean
  hasPrev: boolean
}

export interface SkillsMPSearchResult {
  skills: SkillsMPSkill[]
  pagination: SkillsMPPagination
}

interface SkillsMPResponse {
  success: boolean
  data?: {
    skills: SkillsMPSkill[]
    pagination?: SkillsMPPagination
  }
  error?: {
    code: string
    message: string
  }
}

export interface SearchOptions {
  query?: string        // Search query (use '*' for browse all)
  page?: number         // Page number (default: 1)
  limit?: number        // Results per page (default: 20)
  sortBy?: 'stars' | 'recent' | 'relevance'  // Sort order
  useAI?: boolean       // Use AI semantic search
}

/**
 * Helper to make authenticated requests to SkillsMP API
 */
function fetchSkillsMP(endpoint: string): Promise<SkillsMPResponse> {
  return new Promise((resolve, reject) => {
    const url = `${SKILLSMP_API_URL}${endpoint}`
    console.log('[SkillsMP] Fetching:', url)
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
 * Search or browse skills with pagination
 */
export async function searchSkills(options: SearchOptions = {}): Promise<SkillsMPSearchResult> {
  const {
    query = '*',
    page = 1,
    limit = 20,
    sortBy = 'stars',
    useAI = false
  } = options

  const encodedQuery = encodeURIComponent(query)
  const endpoint = useAI ? '/skills/ai-search' : '/skills/search'
  const params = `q=${encodedQuery}&page=${page}&limit=${limit}&sortBy=${sortBy}`
  
  const response = await fetchSkillsMP(`${endpoint}?${params}`)
  
  if (!response.success) {
    console.error('SkillsMP search error:', response.error)
    return {
      skills: [],
      pagination: { page: 1, limit, total: 0, totalPages: 0, hasNext: false, hasPrev: false }
    }
  }
  
  return {
    skills: response.data?.skills || [],
    pagination: response.data?.pagination || { page: 1, limit, total: 0, totalPages: 0, hasNext: false, hasPrev: false }
  }
}

/**
 * Browse popular skills (default view)
 */
export async function browsePopular(page: number = 1, limit: number = 20): Promise<SkillsMPSearchResult> {
  return searchSkills({ query: '*', page, limit, sortBy: 'stars' })
}

/**
 * Search skills using keywords
 */
export async function keywordSearch(query: string, page: number = 1, limit: number = 20): Promise<SkillsMPSearchResult> {
  return searchSkills({ query, page, limit, sortBy: 'relevance' })
}

/**
 * Search skills using AI semantic search
 */
export async function aiSearch(query: string, page: number = 1, limit: number = 20): Promise<SkillsMPSearchResult> {
  return searchSkills({ query, page, limit, useAI: true })
}
