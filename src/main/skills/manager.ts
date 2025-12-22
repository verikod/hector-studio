import { net } from 'electron'
import { join } from 'path'
import { createWriteStream, mkdirSync, existsSync, writeFileSync } from 'fs'
import { pipeline } from 'stream'
import AdmZip from 'adm-zip'
import { app } from 'electron'

export interface Skill {
  name: string
  description: string
  repoUrl: string
  skillPath?: string  // Path within repo (for subdirectory skills)
  author: string
}

const ANTHROPIC_SKILLS_REPO = 'anthropics/claude-code-skills'
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
   * List official Anthropic skills from the claude-code-skills repo
   */
  async listSkills(): Promise<Skill[]> {
    try {
      // Fetch the skills directory contents from GitHub API
      const apiUrl = `https://api.github.com/repos/${ANTHROPIC_SKILLS_REPO}/contents/${ANTHROPIC_SKILLS_PATH}`
      const response = await this.fetchJson(apiUrl)

      if (!Array.isArray(response)) {
        console.error('Unexpected response format from GitHub API')
        return []
      }

      // Filter for directories (each skill is a directory)
      const skillDirs = response.filter((item: any) => item.type === 'dir')

      // Map to Skill interface
      const skills: Skill[] = skillDirs.map((dir: any) => ({
        name: dir.name,
        description: `Official Anthropic skill: ${dir.name}`,
        repoUrl: `https://github.com/${ANTHROPIC_SKILLS_REPO}`,
        skillPath: `${ANTHROPIC_SKILLS_PATH}/${dir.name}`,
        author: 'Anthropic'
      }))

      // Try to fetch README or description for each skill (optional enhancement)
      await Promise.all(skills.map(async (skill) => {
        try {
          const readmeUrl = `https://raw.githubusercontent.com/${ANTHROPIC_SKILLS_REPO}/main/${skill.skillPath}/README.md`
          const readme = await this.fetchText(readmeUrl)
          // Extract first line or paragraph as description
          const firstLine = readme.split('\n').find(line => 
            line.trim() && !line.startsWith('#') && !line.startsWith('!')
          )
          if (firstLine) {
            skill.description = firstLine.trim().slice(0, 150)
          }
        } catch {
          // Keep default description if README fetch fails
        }
      }))

      return skills
    } catch (error) {
      console.error('Failed to fetch Anthropic skills:', error)
      return []
    }
  }

  /**
   * Create a skill from a custom GitHub URL
   */
  createSkillFromUrl(url: string): Skill | null {
    // Parse GitHub URL formats:
    // https://github.com/owner/repo
    // https://github.com/owner/repo/tree/branch/path/to/skill
    
    const simpleMatch = url.match(/github\.com\/([^/]+)\/([^/]+)\/?$/)
    if (simpleMatch) {
      const [, owner, repo] = simpleMatch
      return {
        name: repo.replace(/\.git$/, ''),
        description: `Custom skill from ${owner}/${repo}`,
        repoUrl: `https://github.com/${owner}/${repo}`,
        author: owner
      }
    }

    const treeMatch = url.match(/github\.com\/([^/]+)\/([^/]+)\/tree\/[^/]+\/(.+)/)
    if (treeMatch) {
      const [, owner, repo, path] = treeMatch
      const skillName = path.split('/').pop() || repo
      return {
        name: skillName,
        description: `Custom skill from ${owner}/${repo}`,
        repoUrl: `https://github.com/${owner}/${repo}`,
        skillPath: path,
        author: owner
      }
    }

    return null
  }

  /**
   * Download skill from GitHub repo to destination path
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

  private fetchJson(url: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const request = net.request(url)
      request.setHeader('User-Agent', 'Hector-Studio')
      request.setHeader('Accept', 'application/vnd.github.v3+json')
      
      let data = ''
      request.on('response', (response) => {
        if (response.statusCode && response.statusCode >= 400) {
          reject(new Error(`HTTP ${response.statusCode}`))
          return
        }
        response.on('data', (chunk) => { data += chunk.toString() })
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

  private fetchText(url: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const request = net.request(url)
      request.setHeader('User-Agent', 'Hector-Studio')
      
      let data = ''
      request.on('response', (response) => {
        if (response.statusCode && response.statusCode >= 400) {
          reject(new Error(`HTTP ${response.statusCode}`))
          return
        }
        response.on('data', (chunk) => { data += chunk.toString() })
        response.on('end', () => resolve(data))
      })
      request.on('error', reject)
      request.end()
    })
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
