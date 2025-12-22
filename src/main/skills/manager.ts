import { net } from 'electron'
import { join } from 'path'
import { createWriteStream, mkdirSync, existsSync, writeFileSync } from 'fs'
import { pipeline } from 'stream'
import AdmZip from 'adm-zip'
import { app } from 'electron'
import { searchSkills as skillsMPSearch, aiSearchSkills as skillsMPAISearch, SkillsMPSkill } from './skillsmp'

export interface Skill {
  name: string
  description: string
  repoUrl: string         // Full GitHub repo URL (e.g., https://github.com/user/repo)
  skillPath?: string      // Path within repo (e.g., "skills/react") - optional for single-skill repos
  author: string
  category?: string
  source: 'skillsmp' | 'official' | 'local'
}

// Official Anthropic skills repo (fallback/featured)
const ANTHROPIC_REPO_OWNER = 'anthropics'
const ANTHROPIC_REPO_NAME = 'skills'
const ANTHROPIC_SKILLS_PATH = 'skills'

export class SkillManager {
  private cachePath: string

  constructor() {
    this.cachePath = join(app.getPath('userData'), 'skill-cache')
    if (!existsSync(this.cachePath)) {
      mkdirSync(this.cachePath, { recursive: true })
    }
  }

  /**
   * Search skills using SkillsMP keyword search
   */
  async searchSkills(query: string): Promise<Skill[]> {
    try {
      const results = await skillsMPSearch(query)
      return this.mapSkillsMPResults(results)
    } catch (error) {
      console.error('SkillsMP search failed:', error)
      return []
    }
  }

  /**
   * Search skills using SkillsMP AI semantic search
   */
  async aiSearchSkills(query: string): Promise<Skill[]> {
    try {
      const results = await skillsMPAISearch(query)
      return this.mapSkillsMPResults(results)
    } catch (error) {
      console.error('SkillsMP AI search failed:', error)
      return []
    }
  }

  /**
   * Map SkillsMP API results to our Skill interface
   */
  private mapSkillsMPResults(results: SkillsMPSkill[]): Skill[] {
    return results.map(r => ({
      name: r.name,
      description: r.description || `Skill from ${r.author || 'community'}`,
      repoUrl: r.githubUrl,
      author: r.author || 'unknown',
      category: r.category,
      source: 'skillsmp' as const
    }))
  }

  /**
   * List official Anthropic skills (fallback/featured)
   */
  async listOfficialSkills(): Promise<Skill[]> {
    try {
      const response = await this.fetchJson(
        `https://api.github.com/repos/${ANTHROPIC_REPO_OWNER}/${ANTHROPIC_REPO_NAME}/contents/${ANTHROPIC_SKILLS_PATH}`
      )
      
      if (!Array.isArray(response)) {
        return []
      }

      return response
        .filter((item: any) => item.type === 'dir')
        .map((item: any) => ({
          name: item.name,
          description: `Official skill from Anthropic`,
          repoUrl: `https://github.com/${ANTHROPIC_REPO_OWNER}/${ANTHROPIC_REPO_NAME}`,
          skillPath: item.path,
          author: ANTHROPIC_REPO_OWNER,
          source: 'official' as const
        }))
    } catch (error) {
      console.error('Failed to list official skills:', error)
      return []
    }
  }

  /**
   * Legacy listSkills - now returns official skills for backward compatibility
   */
  async listSkills(): Promise<Skill[]> {
    return this.listOfficialSkills()
  }

  // fetchJson helper using Electron net
  private fetchJson(url: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const request = net.request(url)
      request.setHeader('User-Agent', 'Hector-Studio')
      
      request.on('response', (response) => {
        let data = ''
        response.on('data', (chunk) => {
          data += chunk.toString()
        })
        response.on('end', () => {
          try {
            resolve(JSON.parse(data))
          } catch (e) {
            reject(e)
          }
        })
      })
      request.on('error', reject)
      request.end()
    })
  }

  /**
   * Download skill from any GitHub repo
   * Supports both:
   * - Full repo skills (skill at root)
   * - Subpath skills (skill in a subdirectory like anthropics/skills)
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
      // Entry name includes root folder, e.g. "owner-repo-hash/path/to/file"
      const parts = entry.entryName.split('/')
      if (parts.length < 2) continue
      
      // Remove the root folder (owner-repo-hash)
      const internalPath = parts.slice(1).join('/')
      
      // If skillPath is specified, only extract that subdirectory
      // If not specified, extract everything (root skill)
      const shouldExtract = skillPathPrefix 
        ? internalPath.startsWith(skillPathPrefix)
        : true
      
      if (!shouldExtract) continue
      
      // Calculate relative path for destination
      const relativePath = skillPathPrefix 
        ? internalPath.replace(skillPathPrefix, '')
        : internalPath
      
      if (!relativePath) continue // Skip the skill folder itself
      
      if (entry.isDirectory) {
        mkdirSync(join(destPath, relativePath), { recursive: true })
        continue
      }
      
      // Extract file
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
