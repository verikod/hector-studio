import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from './ui/tabs';
import { Search, FolderPlus, Download, Check, Loader2, FileCode, Sparkles, Star, ChevronDown } from 'lucide-react';
import { Input } from './ui/input';
import { cn } from '../lib/utils';
import { useServersStore } from '../store/serversStore';

interface Skill {
    name: string;
    description: string;
    repoUrl: string;
    skillPath?: string;
    author: string;
    category?: string;
    stars?: number;
    source: 'skillsmp' | 'local';
}

interface SkillSearchResult {
    skills: Skill[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        hasNext: boolean;
    };
}

interface CreateWorkspaceModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function CreateWorkspaceModal({ open, onOpenChange }: CreateWorkspaceModalProps) {
    const [skills, setSkills] = useState<Skill[]>([]);
    const [loading, setLoading] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [selectedSkill, setSelectedSkill] = useState<Skill | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [creating, setCreating] = useState(false);
    const [useAI, setUseAI] = useState(false);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(false);
    const [total, setTotal] = useState(0);
    const { addServer, selectServer } = useServersStore();
    const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Load popular skills on open
    useEffect(() => {
        if (open) {
            loadPopularSkills();
        }
    }, [open]);

    // Debounced search
    useEffect(() => {
        if (searchTimeoutRef.current) {
            clearTimeout(searchTimeoutRef.current);
        }

        if (!searchQuery.trim()) {
            // If search is cleared, show popular skills
            loadPopularSkills();
            return;
        }

        setLoading(true);
        setPage(1);
        searchTimeoutRef.current = setTimeout(async () => {
            await performSearch(searchQuery, 1, false);
        }, 500);

        return () => {
            if (searchTimeoutRef.current) {
                clearTimeout(searchTimeoutRef.current);
            }
        };
    }, [searchQuery, useAI]);

    const loadPopularSkills = async () => {
        setLoading(true);
        setPage(1);
        try {
            const api = (window as any).api;
            const result: SkillSearchResult = await api.skills.browse(1, 20);
            setSkills(result.skills);
            setHasMore(result.pagination.hasNext);
            setTotal(result.pagination.total);
        } catch (e) {
            console.error('Failed to load skills', e);
        } finally {
            setLoading(false);
        }
    };

    const performSearch = async (query: string, pageNum: number, append: boolean) => {
        try {
            const api = (window as any).api;
            const result: SkillSearchResult = useAI
                ? await api.skills.aiSearch(query, pageNum, 20)
                : await api.skills.search(query, pageNum, 20);

            if (append) {
                setSkills(prev => [...prev, ...result.skills]);
            } else {
                setSkills(result.skills);
            }
            setHasMore(result.pagination.hasNext);
            setTotal(result.pagination.total);
            setPage(pageNum);
        } catch (e) {
            console.error('Search failed:', e);
        } finally {
            setLoading(false);
            setLoadingMore(false);
        }
    };

    const loadMore = async () => {
        if (loadingMore || !hasMore) return;
        setLoadingMore(true);
        const nextPage = page + 1;
        if (searchQuery.trim()) {
            await performSearch(searchQuery, nextPage, true);
        } else {
            try {
                const api = (window as any).api;
                const result: SkillSearchResult = await api.skills.browse(nextPage, 20);
                setSkills(prev => [...prev, ...result.skills]);
                setHasMore(result.pagination.hasNext);
                setPage(nextPage);
            } catch (e) {
                console.error('Failed to load more', e);
            } finally {
                setLoadingMore(false);
            }
        }
    };

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

    const formatStars = (stars?: number) => {
        if (!stars) return null;
        if (stars >= 1000) return `${(stars / 1000).toFixed(1)}k`;
        return stars.toString();
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-3xl h-[650px] flex flex-col bg-gray-900 border-gray-800 text-gray-100 p-0 overflow-hidden">
                <div className="p-6 pb-2">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            Create Workspace
                            <span className="text-xs font-normal text-gray-500">
                                {total > 0 && `${total.toLocaleString()} skills available`}
                            </span>
                        </DialogTitle>
                    </DialogHeader>
                </div>

                <Tabs defaultValue="template" className="flex-1 flex flex-col min-h-0 p-6 pt-0 overflow-hidden">
                    <TabsList className="grid w-full grid-cols-2 bg-black/40 border border-white/10 mb-4 shrink-0">
                        <TabsTrigger value="template">From Skill</TabsTrigger>
                        <TabsTrigger value="blank">Blank Workspace</TabsTrigger>
                    </TabsList>

                    <TabsContent value="template" className="flex-1 flex flex-col min-h-0 gap-4 mt-0 overflow-hidden">
                        <div className="flex gap-2 shrink-0">
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
                                <Input
                                    placeholder="Search skills..."
                                    className="pl-9 bg-black/20 border-white/10"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                            </div>
                            <Button
                                variant={useAI ? "default" : "outline"}
                                size="icon"
                                onClick={() => setUseAI(!useAI)}
                                className={cn(
                                    "shrink-0",
                                    useAI ? "bg-purple-600 hover:bg-purple-700" : "bg-black/20 border-white/10 hover:bg-white/10"
                                )}
                                title={useAI ? "AI Search enabled" : "Enable AI Search"}
                            >
                                <Sparkles size={16} className={useAI ? "text-white" : "text-gray-400"} />
                            </Button>
                        </div>

                        <div className="flex-1 overflow-y-auto min-h-0 pr-2 -mr-2">
                            {loading ? (
                                <div className="flex items-center justify-center h-40 text-gray-500">
                                    <Loader2 className="animate-spin mr-2" />
                                    Loading skills...
                                </div>
                            ) : skills.length === 0 ? (
                                <div className="text-center py-10 text-gray-500">
                                    {searchQuery ? 'No skills found. Try a different search.' : 'No skills available.'}
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    <div className="grid grid-cols-2 gap-3">
                                        {skills.map((skill, index) => (
                                            <div
                                                key={`${skill.name}-${skill.repoUrl}-${index}`}
                                                className={cn(
                                                    "p-4 rounded-lg border cursor-pointer transition-all hover:bg-white/5 relative",
                                                    selectedSkill?.name === skill.name && selectedSkill?.repoUrl === skill.repoUrl
                                                        ? "border-green-500 bg-green-500/10 hover:bg-green-500/10"
                                                        : "border-white/10 bg-black/20"
                                                )}
                                                onClick={() => setSelectedSkill(skill)}
                                            >
                                                <div className="flex justify-between items-start mb-2">
                                                    <div className="p-2 rounded bg-white/5">
                                                        <FileCode size={20} className="text-blue-400" />
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        {skill.stars !== undefined && skill.stars > 0 && (
                                                            <span className="flex items-center gap-1 text-[10px] text-yellow-500">
                                                                <Star size={10} fill="currentColor" />
                                                                {formatStars(skill.stars)}
                                                            </span>
                                                        )}
                                                        {selectedSkill?.name === skill.name && selectedSkill?.repoUrl === skill.repoUrl && (
                                                            <Check size={16} className="text-green-500 bg-green-500/20 rounded-full p-0.5" />
                                                        )}
                                                    </div>
                                                </div>
                                                <h3 className="font-medium text-sm mb-1 truncate">{skill.name}</h3>
                                                <p className="text-xs text-gray-400 line-clamp-2">{skill.description}</p>
                                                <div className="mt-3 flex items-center justify-between">
                                                    <span className="text-[10px] text-gray-500 font-mono truncate">
                                                        {skill.author}
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    {hasMore && (
                                        <div className="flex justify-center pt-2">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={loadMore}
                                                disabled={loadingMore}
                                                className="bg-black/20 border-white/10 hover:bg-white/10"
                                            >
                                                {loadingMore ? (
                                                    <Loader2 className="animate-spin mr-2" size={14} />
                                                ) : (
                                                    <ChevronDown className="mr-2" size={14} />
                                                )}
                                                Load More
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="flex justify-between items-center pt-4 border-t border-white/10 shrink-0">
                            <span className="text-xs text-gray-500">
                                {searchQuery
                                    ? `Showing ${skills.length} of ${total.toLocaleString()} results`
                                    : `Popular skills • Sorted by stars`
                                }
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
