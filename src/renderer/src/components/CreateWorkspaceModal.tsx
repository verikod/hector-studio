import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from './ui/tabs';
import { Search, FolderPlus, Download, Check, Loader2, FileCode, Link } from 'lucide-react';
import { Input } from './ui/input';
import { cn } from '../lib/utils';
import { useServersStore } from '../store/serversStore';

interface Skill {
    name: string;
    description: string;
    repoUrl: string;
    skillPath?: string;
    author: string;
}

interface CreateWorkspaceModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function CreateWorkspaceModal({ open, onOpenChange }: CreateWorkspaceModalProps) {
    const [skills, setSkills] = useState<Skill[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedSkill, setSelectedSkill] = useState<Skill | null>(null);
    const [filterQuery, setFilterQuery] = useState('');
    const [creating, setCreating] = useState(false);
    const [customUrl, setCustomUrl] = useState('');
    const [customUrlError, setCustomUrlError] = useState('');
    const { addServer, selectServer } = useServersStore();

    // Load skills on open
    useEffect(() => {
        if (open) {
            loadSkills();
            setSelectedSkill(null);
            setCustomUrl('');
            setCustomUrlError('');
        }
    }, [open]);

    const loadSkills = async () => {
        setLoading(true);
        try {
            const api = (window as any).api;
            const result: Skill[] = await api.skills.list();
            setSkills(result);
        } catch (e) {
            console.error('Failed to load skills', e);
        } finally {
            setLoading(false);
        }
    };

    // Client-side filtering
    const filteredSkills = skills.filter(skill =>
        filterQuery === '' ||
        skill.name.toLowerCase().includes(filterQuery.toLowerCase()) ||
        skill.description.toLowerCase().includes(filterQuery.toLowerCase())
    );

    const handleCreateBlank = async () => {
        setCreating(true);
        try {
            const path = await (window as any).api.workspace.browse();
            if (!path) {
                setCreating(false);
                return;
            }
            const name = path.split(/[\\/]/).pop() || 'Workspace';
            const workspace = await (window as any).api.workspace.add(name, path);
            if (workspace) {
                addServer(workspace);
                await (window as any).api.workspace.start(workspace.id);
                selectServer(workspace.id);
                onOpenChange(false);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setCreating(false);
        }
    };

    const handleCreateFromSkill = async () => {
        if (!selectedSkill) return;
        setCreating(true);
        try {
            const path = await (window as any).api.workspace.browse();
            if (!path) {
                setCreating(false);
                return;
            }
            const name = path.split(/[\\/]/).pop() || selectedSkill.name;

            const workspace = await (window as any).api.workspace.createFromSkill(name, path, selectedSkill);

            if (workspace) {
                addServer(workspace);
                selectServer(workspace.id);
                onOpenChange(false);
            }
        } catch (e) {
            console.error(e);
            alert(`Failed to create workspace: ${e}`);
        } finally {
            setCreating(false);
        }
    };

    const handleCustomUrlChange = (url: string) => {
        setCustomUrl(url);
        setCustomUrlError('');

        if (url.trim()) {
            // Validate GitHub URL format
            const isValid = /github\.com\/[^/]+\/[^/]+/.test(url);
            if (!isValid) {
                setCustomUrlError('Enter a valid GitHub URL (e.g., https://github.com/owner/repo)');
            } else {
                // Create a skill from the custom URL and select it
                const urlSkill: Skill = parseGitHubUrl(url);
                setSelectedSkill(urlSkill);
            }
        } else {
            // If URL is cleared, deselect if it was a custom URL skill
            if (selectedSkill && !skills.find(s => s.repoUrl === selectedSkill.repoUrl)) {
                setSelectedSkill(null);
            }
        }
    };

    const parseGitHubUrl = (url: string): Skill => {
        // Parse GitHub URL formats:
        // https://github.com/owner/repo
        // https://github.com/owner/repo/tree/branch/path/to/skill

        const treeMatch = url.match(/github\.com\/([^/]+)\/([^/]+)\/tree\/[^/]+\/(.+)/);
        if (treeMatch) {
            const [, owner, repo, path] = treeMatch;
            const skillName = path.split('/').pop() || repo;
            return {
                name: skillName,
                description: `Custom skill from ${owner}/${repo}`,
                repoUrl: `https://github.com/${owner}/${repo}`,
                skillPath: path,
                author: owner
            };
        }

        const simpleMatch = url.match(/github\.com\/([^/]+)\/([^/]+)/);
        if (simpleMatch) {
            const [, owner, repo] = simpleMatch;
            return {
                name: repo.replace(/\.git$/, ''),
                description: `Custom skill from ${owner}/${repo}`,
                repoUrl: `https://github.com/${owner}/${repo}`,
                author: owner
            };
        }

        return {
            name: 'Custom Skill',
            description: 'Custom GitHub repository',
            repoUrl: url,
            author: 'unknown'
        };
    };

    const isCustomUrlSelected = customUrl.trim() && !customUrlError && selectedSkill &&
        !skills.find(s => s.repoUrl === selectedSkill.repoUrl);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-3xl h-[600px] flex flex-col bg-gray-900 border-gray-800 text-gray-100 p-0 overflow-hidden">
                <div className="p-6 pb-2">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            Create Workspace
                        </DialogTitle>
                    </DialogHeader>
                </div>

                <Tabs defaultValue="template" className="flex-1 flex flex-col min-h-0 p-6 pt-0 overflow-hidden">
                    <TabsList className="grid w-full grid-cols-2 bg-black/40 border border-white/10 mb-4 shrink-0">
                        <TabsTrigger value="template">From Skill</TabsTrigger>
                        <TabsTrigger value="blank">Blank Workspace</TabsTrigger>
                    </TabsList>

                    <TabsContent value="template" className="flex-1 flex flex-col min-h-0 gap-4 mt-0 overflow-hidden">
                        {/* Filter input */}
                        <div className="relative shrink-0">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
                            <Input
                                placeholder="Filter skills..."
                                className="pl-9 bg-black/20 border-white/10 focus:ring-0 focus:border-white/20"
                                value={filterQuery}
                                onChange={(e) => setFilterQuery(e.target.value)}
                            />
                        </div>

                        {/* Skills grid */}
                        <div className="flex-1 overflow-y-auto min-h-0 pr-2 -mr-2">
                            {loading ? (
                                <div className="flex items-center justify-center h-40 text-gray-500">
                                    <Loader2 className="animate-spin mr-2" />
                                    Loading skills...
                                </div>
                            ) : filteredSkills.length === 0 ? (
                                <div className="text-center py-10 text-gray-500">
                                    {filterQuery ? 'No skills match your filter.' : 'No skills available.'}
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 gap-3">
                                    {filteredSkills.map((skill, index) => (
                                        <div
                                            key={`${skill.name}-${index}`}
                                            className={cn(
                                                "p-4 rounded-lg border cursor-pointer transition-all hover:bg-white/5 relative",
                                                selectedSkill?.name === skill.name && selectedSkill?.repoUrl === skill.repoUrl
                                                    ? "border-green-500 bg-green-500/10 hover:bg-green-500/10"
                                                    : "border-white/10 bg-black/20"
                                            )}
                                            onClick={() => {
                                                setSelectedSkill(skill);
                                                setCustomUrl('');
                                                setCustomUrlError('');
                                            }}
                                        >
                                            <div className="flex justify-between items-start mb-2">
                                                <div className="p-2 rounded bg-white/5">
                                                    <FileCode size={20} className="text-blue-400" />
                                                </div>
                                                {selectedSkill?.name === skill.name && selectedSkill?.repoUrl === skill.repoUrl && (
                                                    <Check size={16} className="text-green-500 bg-green-500/20 rounded-full p-0.5" />
                                                )}
                                            </div>
                                            <h3 className="font-medium text-sm mb-1 truncate">{skill.name}</h3>
                                            <p className="text-xs text-gray-400 line-clamp-2">{skill.description}</p>
                                            <div className="mt-3">
                                                <span className="text-[10px] text-gray-500 font-mono">
                                                    {skill.author}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Custom URL section */}
                        <div className="shrink-0 pt-4 border-t border-white/10">
                            <div className="flex items-center gap-2 mb-2">
                                <Link size={14} className="text-gray-500" />
                                <span className="text-xs text-gray-500">Or use a custom GitHub repository</span>
                            </div>
                            <div className="flex gap-2">
                                <Input
                                    placeholder="https://github.com/owner/repo"
                                    className={cn(
                                        "flex-1 bg-black/20 border-white/10 focus:ring-0 focus:border-white/20 text-sm",
                                        customUrlError && "border-red-500/50",
                                        isCustomUrlSelected && "border-green-500/50"
                                    )}
                                    value={customUrl}
                                    onChange={(e) => handleCustomUrlChange(e.target.value)}
                                />
                            </div>
                            {customUrlError && (
                                <p className="text-xs text-red-400 mt-1">{customUrlError}</p>
                            )}
                            {isCustomUrlSelected && (
                                <p className="text-xs text-green-400 mt-1">✓ Custom repository selected</p>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="flex justify-between items-center pt-4 border-t border-white/10 shrink-0">
                            <span className="text-xs text-gray-500">
                                {skills.length} official skills from Anthropic
                            </span>
                            <Button
                                variant="default"
                                disabled={!selectedSkill || creating}
                                onClick={handleCreateFromSkill}
                                className="bg-green-600 hover:bg-green-700 text-white"
                            >
                                {creating ? <Loader2 className="animate-spin mr-2" size={16} /> : <Download className="mr-2" size={16} />}
                                Create from Skill
                            </Button>
                        </div>
                    </TabsContent>

                    <TabsContent value="blank" className="flex-1 flex flex-col items-center justify-center text-center p-10 mt-0">
                        <div className="bg-white/5 p-6 rounded-full mb-6">
                            <FolderPlus size={48} className="text-gray-400" />
                        </div>
                        <h3 className="text-xl font-medium mb-2">Blank Workspace</h3>
                        <p className="text-gray-400 max-w-sm mb-8">
                            Start with an empty workspace. You can choose a directory on your computer to initialize a new Hector project.
                        </p>
                        <Button
                            variant="outline"
                            size="lg"
                            onClick={handleCreateBlank}
                            disabled={creating}
                            className="bg-white/5 border-white/10 hover:bg-white/10 hover:text-white"
                        >
                            {creating ? <Loader2 className="animate-spin mr-2" size={16} /> : <FolderPlus className="mr-2" size={16} />}
                            Select Folder & Create
                        </Button>
                    </TabsContent>
                </Tabs>
            </DialogContent>
        </Dialog>
    );
}
