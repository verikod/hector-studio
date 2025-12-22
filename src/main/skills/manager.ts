import { net } from 'electron'
import { join } from 'path'
import { createWriteStream, mkdirSync, existsSync, writeFileSync } from 'fs'
import { pipeline } from 'stream'
import AdmZip from 'adm-zip'
import { app } from 'electron'

export interface Skill {
  name: string
  description: string
  path: string // Path in the repo
  author: string
}

const REPO_OWNER = 'anthropics'
const REPO_NAME = 'skills'
const SKILLS_PATH = 'skills' // Directory in repo containing skills

export class SkillManager {
  private cachePath: string

  constructor() {
    this.cachePath = join(app.getPath('userData'), 'skill-cache')
    if (!existsSync(this.cachePath)) {
      mkdirSync(this.cachePath, { recursive: true })
    }
  }

  async listSkills(): Promise<Skill[]> {
    try {
      // 1. Fetch directory listing from GitHub API
      const response = await this.fetchJson(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${SKILLS_PATH}`)
      
      if (!Array.isArray(response)) {
        return []
      }

      // 2. Map folders to skills
      return response
        .filter((item: any) => item.type === 'dir')
        .map((item: any) => ({
          name: item.name,
          description: `Skill from ${REPO_OWNER}/${REPO_NAME}`,
          path: item.path,
          author: REPO_OWNER
        }))
    } catch (error) {
      console.error('Failed to list skills:', error)
      return []
    }
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

  async downloadSkill(skill: Skill, destPath: string): Promise<void> {
    // 1. Download repository zipball
    const zipPath = join(this.cachePath, `${REPO_NAME}.zip`)
    const zipUrl = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/zipball/main`

    await this.downloadFile(zipUrl, zipPath)

    // 2. Extract specific directory to destPath
    const zip = new AdmZip(zipPath)
    const zipEntries = zip.getEntries()
    
    let found = false
    const skillPathNormalized = `${SKILLS_PATH}/${skill.name}/`

    for (const entry of zipEntries) {
        // Entry name includes root folder, e.g. "anthropics-skills-hash/skills/react/SKILL.md"
        const parts = entry.entryName.split('/')
        if (parts.length < 2) continue
        
        const internalPath = parts.slice(1).join('/')
        
        if (internalPath.startsWith(skillPathNormalized)) {
            if (entry.isDirectory) {
               mkdirSync(join(destPath, internalPath.replace(skillPathNormalized, '')), { recursive: true })
               continue
            }
            
            // Extract file
            const relativePath = internalPath.replace(skillPathNormalized, '')
            const targetPath = join(destPath, relativePath)
            
            const fileDir = join(destPath, relativePath.substring(0, relativePath.lastIndexOf('/') + 1))
            mkdirSync(fileDir, { recursive: true })
            
            const content = zip.readFile(entry)
            if (content) {
                writeFileSync(targetPath, content)
                found = true
            }
        }
    }
    
    if (!found) {
        throw new Error('Skill not found in repository archive')
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
                        // fileStream.close() is called automatically by pipeline on finish
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
