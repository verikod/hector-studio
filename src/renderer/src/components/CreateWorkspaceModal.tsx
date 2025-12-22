import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from './ui/tabs';
import { Search, FolderPlus, Download, Check, Loader2, FileCode } from 'lucide-react';
import { Input } from './ui/input';
import { cn } from '../lib/utils';
import { useServersStore } from '../store/serversStore';

interface Skill {
    name: string;
    description: string;
    path: string;
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
    const [searchQuery, setSearchQuery] = useState('');
    const [creating, setCreating] = useState(false);
    const { addServer, selectServer } = useServersStore();

    useEffect(() => {
        if (open) {
            loadSkills();
        }
    }, [open]);

    const loadSkills = async () => {
        setLoading(true);
        try {
            const list = await (window as any).api.skills.list();
            setSkills(list);
        } catch (e) {
            console.error('Failed to load skills', e);
        } finally {
            setLoading(false);
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

    const filteredSkills = skills.filter((s) =>
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.description.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-3xl h-[600px] flex flex-col bg-gray-900 border-gray-800 text-gray-100 p-0 overflow-hidden">
                <div className="p-6 pb-2">
                    <DialogHeader>
                        <DialogTitle>Create Workspace</DialogTitle>
                    </DialogHeader>
                </div>

                <Tabs defaultValue="template" className="flex-1 flex flex-col min-h-0 p-6 pt-0 overflow-hidden">
                    <TabsList className="grid w-full grid-cols-2 bg-black/40 border border-white/10 mb-4 shrink-0">
                        <TabsTrigger value="template">From Skill / Template</TabsTrigger>
                        <TabsTrigger value="blank">Blank Workspace</TabsTrigger>
                    </TabsList>

                    <TabsContent value="template" className="flex-1 flex flex-col min-h-0 gap-4 mt-0 overflow-hidden">
                        <div className="relative shrink-0">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
                            <Input
                                placeholder="Search skills (e.g. React, PDF, Research)..."
                                className="pl-9 bg-black/20 border-white/10"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>

                        <div className="flex-1 overflow-y-auto min-h-0 pr-2 -mr-2 space-y-3">
                            {loading ? (
                                <div className="flex items-center justify-center h-40 text-gray-500">
                                    <Loader2 className="animate-spin mr-2" /> Loading skills...
                                </div>
                            ) : filteredSkills.length === 0 ? (
                                <div className="text-center py-10 text-gray-500">
                                    No skills found.
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 gap-3">
                                    {filteredSkills.map((skill) => (
                                        <div
                                            key={skill.name}
                                            className={cn(
                                                "p-4 rounded-lg border cursor-pointer transition-all hover:bg-white/5 relative",
                                                selectedSkill?.name === skill.name ? "border-green-500 bg-green-500/10 hover:bg-green-500/10" : "border-white/10 bg-black/20"
                                            )}
                                            onClick={() => setSelectedSkill(skill)}
                                        >
                                            <div className="flex justify-between items-start mb-2">
                                                <div className="p-2 rounded bg-white/5">
                                                    <FileCode size={20} className="text-blue-400" />
                                                </div>
                                                {selectedSkill?.name === skill.name && (
                                                    <Check size={16} className="text-green-500 bg-green-500/20 rounded-full p-0.5" />
                                                )}
                                            </div>
                                            <h3 className="font-medium text-sm mb-1">{skill.name}</h3>
                                            <p className="text-xs text-gray-400 line-clamp-2">{skill.description}</p>
                                            <div className="mt-3 text-[10px] text-gray-500 font-mono">
                                                by {skill.author}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="flex justify-end pt-4 border-t border-white/10 shrink-0">
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
