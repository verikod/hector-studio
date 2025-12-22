import { net } from 'electron'
import { join } from 'path'
import { createWriteStream, mkdirSync, existsSync, writeFileSync } from 'fs'
import { pipeline } from 'stream'
import AdmZip from 'adm-zip'
import { app } from 'electron'
import { 
  browsePopular, 
  keywordSearch, 
  aiSearch, 
  SkillsMPSkill, 
  SkillsMPSearchResult 
} from './skillsmp'

export interface Skill {
  name: string
  description: string
  repoUrl: string         // Full GitHub repo URL
  skillPath?: string      // Path within repo (for tree URLs)
  author: string
  category?: string
  stars?: number
  source: 'skillsmp' | 'local'
}

export interface SkillSearchResult {
  skills: Skill[]
  pagination: {
    page: number
    limit: number
    total: number
    hasNext: boolean
  }
}

export class SkillManager {
  private cachePath: string

  constructor() {
    this.cachePath = join(app.getPath('userData'), 'skill-cache')
    if (!existsSync(this.cachePath)) {
      mkdirSync(this.cachePath, { recursive: true })
    }
  }

  /**
   * Browse popular skills (default view - sorted by stars)
   */
  async browsePopular(page: number = 1, limit: number = 20): Promise<SkillSearchResult> {
    try {
      const result = await browsePopular(page, limit)
      return this.mapSearchResult(result)
    } catch (error) {
      console.error('Failed to browse skills:', error)
      return this.emptyResult()
    }
  }

  /**
   * Search skills using keywords
   */
  async searchSkills(query: string, page: number = 1, limit: number = 20): Promise<SkillSearchResult> {
    try {
      const result = await keywordSearch(query, page, limit)
      return this.mapSearchResult(result)
    } catch (error) {
      console.error('SkillsMP search failed:', error)
      return this.emptyResult()
    }
  }

  /**
   * Search skills using AI semantic search
   */
  async aiSearchSkills(query: string, page: number = 1, limit: number = 20): Promise<SkillSearchResult> {
    try {
      const result = await aiSearch(query, page, limit)
      return this.mapSearchResult(result)
    } catch (error) {
      console.error('SkillsMP AI search failed:', error)
      return this.emptyResult()
    }
  }

  /**
   * Legacy listSkills - now returns popular skills for backward compatibility
   */
  async listSkills(): Promise<Skill[]> {
    const result = await this.browsePopular(1, 20)
    return result.skills
  }

  private mapSearchResult(result: SkillsMPSearchResult): SkillSearchResult {
    return {
      skills: result.skills.map(r => this.mapSkill(r)),
      pagination: {
        page: result.pagination.page,
        limit: result.pagination.limit,
        total: result.pagination.total,
        hasNext: result.pagination.hasNext
      }
    }
  }

  private mapSkill(r: SkillsMPSkill): Skill {
    // Parse GitHub URL to extract skill path for tree URLs
    // e.g., https://github.com/user/repo/tree/main/path/to/skill
    let repoUrl = r.githubUrl
    let skillPath: string | undefined

    const treeMatch = r.githubUrl.match(/github\.com\/([^/]+)\/([^/]+)\/tree\/[^/]+\/(.+)/)
    if (treeMatch) {
      const [, owner, repo, path] = treeMatch
      repoUrl = `https://github.com/${owner}/${repo}`
      skillPath = path
    }

    return {
      name: r.name,
      description: r.description || `Skill from ${r.author || 'community'}`,
      repoUrl,
      skillPath,
      author: r.author || 'unknown',
      category: r.category,
      stars: r.stars,
      source: 'skillsmp'
    }
  }

  private emptyResult(): SkillSearchResult {
    return {
      skills: [],
      pagination: { page: 1, limit: 20, total: 0, hasNext: false }
    }
  }

  /**
   * Download skill from any GitHub repo
   */
  async downloadSkill(skill: Skill, destPath: string): Promise<void> {
    // Parse GitHub URL to extract owner/repo
    const match = skill.repoUrl.match(/github\.com\/([^/]+)\/([^/]+)/)
    if (!match) {
      throw new Error(`Invalid GitHub URL: ${skill.repoUrl}`)
    }
    
    const [, owner, repo] = match
    const repoName = repo.replace(/\.git$/, '')
    
    // Download repository zipball
    const zipPath = join(this.cachePath, `${owner}-${repoName}.zip`)
    const zipUrl = `https://api.github.com/repos/${owner}/${repoName}/zipball/main`

    await this.downloadFile(zipUrl, zipPath)

    // Extract to destination
    const zip = new AdmZip(zipPath)
    const zipEntries = zip.getEntries()
    
    let found = false
    
    // Determine what to extract based on skillPath
    const skillPathPrefix = skill.skillPath ? `${skill.skillPath}/` : ''
    
    for (const entry of zipEntries) {
      const parts = entry.entryName.split('/')
      if (parts.length < 2) continue
      
      const internalPath = parts.slice(1).join('/')
      
      const shouldExtract = skillPathPrefix 
        ? internalPath.startsWith(skillPathPrefix)
        : true
      
      if (!shouldExtract) continue
      
      const relativePath = skillPathPrefix 
        ? internalPath.replace(skillPathPrefix, '')
        : internalPath
      
      if (!relativePath) continue
      
      if (entry.isDirectory) {
        mkdirSync(join(destPath, relativePath), { recursive: true })
        continue
      }
      
      const targetPath = join(destPath, relativePath)
      const fileDir = join(destPath, relativePath.substring(0, relativePath.lastIndexOf('/') + 1))
      mkdirSync(fileDir, { recursive: true })
      
      const content = zip.readFile(entry)
      if (content) {
        writeFileSync(targetPath, content)
        found = true
      }
    }
    
    if (!found) {
      throw new Error('No files found in repository archive')
    }
  }

  private downloadFile(url: string, dest: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = net.request(url)
      request.setHeader('User-Agent', 'Hector-Studio')
      request.on('response', (response) => {
        if (response.statusCode && response.statusCode >= 400) {
          reject(new Error(`Failed to download: ${response.statusCode}`))
          return
        }
        
        const fileStream = createWriteStream(dest)
        
        pipeline(
          response as unknown as NodeJS.ReadableStream,
          fileStream,
          (err) => {
            if (err) {
              fileStream.close()
              reject(err)
            } else {
              resolve()
            }
          }
        )
      })
      request.on('error', reject)
      request.end()
    })
  }
}

export const skillManager = new SkillManager()
