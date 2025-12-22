import { join } from 'path'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { Skill } from './manager'

export class ConfigGenerator {
  generateConfig(workspacePath: string, skill: Skill): void {
    const skillMdPath = join(workspacePath, 'SKILL.md')
    const configPath = join(workspacePath, 'hector.yaml')

    if (!existsSync(skillMdPath)) {
      console.warn(`SKILL.md not found at ${skillMdPath}, skipping config generation.`)
      return
    }

    try {
      const content = readFileSync(skillMdPath, 'utf-8')
      const systemPrompt = this.extractSystemPrompt(content)

      const config = `name: "${skill.name}"
description: "${skill.description}"
version: "0.0.1"

agents:
  default:
    model: "claude-3-5-sonnet-latest"
    system_prompt: |
${systemPrompt.split('\n').map(line => `      ${line}`).join('\n')}
    
    tools:
      fs:
        work_dir: "./"
        allowed_paths: ["./"]
      command:
        allowed_commands: ["*"]
        deny_by_default: false
`

      writeFileSync(configPath, config)
      console.log(`Generated hector.yaml for skill ${skill.name}`)
    } catch (error) {
      console.error('Failed to generate hector.yaml:', error)
    }
  }

  private extractSystemPrompt(content: string): string {
    // SKILL.md usually starts with metadata (if any YAML frontmatter) or titles.
    // We want to capture the main instruction body.
    // For now, we'll try to strip out common headers or metadata if present, 
    // but the simplest approach is to use the whole file content or content after the first header.
    
    // Simple heuristic: If it has frontmatter (---), strip it.
    // Otherwise use content.
    
    const parts = content.split('---')
    if (parts.length >= 3) {
      // Has frontmatter, return the rest
      return parts.slice(2).join('---').trim()
    }

    return content.trim()
  }
}

export const configGenerator = new ConfigGenerator()
