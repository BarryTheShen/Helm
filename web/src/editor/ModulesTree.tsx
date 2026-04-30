import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';
import { Plus, ChevronDown, ChevronRight, MoreVertical, Edit2, Copy, Trash2, ExternalLink } from 'lucide-react';
import { RenameModuleModal } from './RenameModuleModal';
import { DeleteModuleModal } from './DeleteModuleModal';

interface SDUIModule {
  module_id: string;
  name: string;
  icon: string;
  has_screen: boolean;
  is_custom?: boolean;
}

interface ModulesTreeProps {
  onModuleSelect?: (moduleInstanceId: string) => void;
}

interface ContextMenuProps {
  moduleInstance: SDUIModule;
  onClose: () => void;
  onRename: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onOpenInAppEditor: () => void;
  position: { x: number; y: number };
}

function ContextMenu({ moduleInstance, onClose, onRename, onDuplicate, onDelete, onOpenInAppEditor, position }: ContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isBuiltIn = !moduleInstance.is_custom;

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="fixed bg-white border border-gray-200 rounded-lg shadow-xl z-[9999] py-1 w-48"
      style={{ top: position.y, left: position.x }}
    >
      <button
        onClick={() => { onRename(); onClose(); }}
        className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-gray-50 transition-colors text-left"
      >
        <Edit2 size={12} />
        Rename
      </button>
      <button
        onClick={() => { onDuplicate(); onClose(); }}
        className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-gray-50 transition-colors text-left"
      >
        <Copy size={12} />
        Duplicate
      </button>
      {!isBuiltIn && (
        <button
          onClick={() => { onDelete(); onClose(); }}
          className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-red-50 text-red-600 transition-colors text-left"
        >
          <Trash2 size={12} />
          Delete
        </button>
      )}
      <div className="border-t border-gray-100 my-1" />
      <button
        onClick={() => { onOpenInAppEditor(); onClose(); }}
        className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-gray-50 transition-colors text-left"
      >
        <ExternalLink size={12} />
        Open in App Editor
      </button>
    </div>
  );
}

export function ModulesTree({ onModuleSelect }: ModulesTreeProps) {
  const [modules, setModules] = useState<SDUIModule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(true);
  const [contextMenu, setContextMenu] = useState<{ moduleInstance: SDUIModule; x: number; y: number } | null>(null);
  const [renameModal, setRenameModal] = useState<{ moduleId: string; currentName: string } | null>(null);
  const [deleteModal, setDeleteModal] = useState<{ moduleId: string; moduleName: string } | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const selectedModuleId = searchParams.get('module_instance_id');

  const loadModules = async () => {
    console.log('[ModulesTree] loadModules() — starting');
    setLoading(true);
    setError(null);
    try {
      const response = await api.get<{ items: SDUIModule[] }>('/api/sdui/modules');
      const count = response.items?.length || 0;
      console.log(`[ModulesTree] loadModules() — success: ${count} modules`);
      setModules(response.items || []);
    } catch (err) {
      console.error('[ModulesTree] loadModules() — error:', err instanceof Error ? err.message : err);
      setError(err instanceof Error ? err.message : 'Failed to load modules');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadModules();
  }, []);

  const handleModuleClick = (moduleId: string) => {
    console.log(`[ModulesTree] handleModuleClick() — selecting module: ${moduleId}`);
    if (onModuleSelect) {
      onModuleSelect(moduleId);
    }
    setSearchParams({ module_instance_id: moduleId });
  };

  const handleContextMenu = (e: React.MouseEvent, moduleInstance: SDUIModule) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      moduleInstance,
      x: e.clientX,
      y: e.clientY,
    });
  };

  const handleRename = (moduleInstance: SDUIModule) => {
    console.log(`[ModulesTree] context menu — rename: ${moduleInstance.name} (${moduleInstance.module_id})`);
    setRenameModal({
      moduleId: moduleInstance.module_id,
      currentName: moduleInstance.name,
    });
  };

  const handleDuplicate = (moduleInstance: SDUIModule) => {
    // TODO: Implement duplicate
    console.log(`[ModulesTree] context menu — duplicate: ${moduleInstance.name} (${moduleInstance.module_id})`);
  };

  const handleDelete = (moduleInstance: SDUIModule) => {
    console.log(`[ModulesTree] context menu — delete: ${moduleInstance.name} (${moduleInstance.module_id})`);
    setDeleteModal({
      moduleId: moduleInstance.module_id,
      moduleName: moduleInstance.name,
    });
  };

  const handleOpenInAppEditor = (moduleInstance: SDUIModule) => {
    console.log(`[ModulesTree] context menu — open in app editor: ${moduleInstance.name} (${moduleInstance.module_id})`);
    // TODO: Navigate to app editor with module highlighted
    navigate(`/app-editor?module_instance=${moduleInstance.module_id}`);
  };

  const handleNewModule = () => {
    console.log('[ModulesTree] handleNewModule() — navigating to /editor');
    navigate('/editor');
  };

  if (loading) {
    return (
      <div className="px-3 py-2 text-xs text-gray-400">
        Loading modules...
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-3 py-2">
        <div className="text-xs text-red-600 mb-2">{error}</div>
        <button
          onClick={() => void loadModules()}
          className="text-xs text-blue-600 hover:text-blue-700"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 text-xs font-semibold text-gray-500 uppercase tracking-wider hover:text-gray-700 transition-colors"
        >
          {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          Modules
        </button>
        <button
          onClick={handleNewModule}
          type="button"
          className="inline-flex items-center gap-1 px-2 py-1 hover:bg-gray-100 rounded transition-colors text-xs text-gray-600"
        >
          <Plus size={14} />
          New Module
        </button>
      </div>

      {expanded && (
        <div className="flex-1 overflow-y-auto py-1">
          {modules.length === 0 ? (
            <div className="px-3 py-8 text-center text-xs text-gray-400">
              No modules yet. Click + to create one.
            </div>
          ) : (
            modules.map((module) => (
              <div
                key={module.module_id}
                className={`mx-1 mb-0.5 flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer group transition-colors ${
                  selectedModuleId === module.module_id
                    ? 'bg-blue-50 text-blue-700'
                    : 'hover:bg-gray-50'
                }`}
                onClick={() => handleModuleClick(module.module_id)}
                onContextMenu={(e) => handleContextMenu(e, module)}
              >
                <span className="text-xs flex-1 truncate font-medium" title={module.name}>
                  {module.name}
                  {!module.is_custom && (
                    <span className="ml-1 text-gray-400 text-[10px]">(built-in)</span>
                  )}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleContextMenu(e, module);
                  }}
                  className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-gray-200 rounded transition-opacity"
                  title="More options"
                >
                  <MoreVertical size={12} />
                </button>
              </div>
            ))
          )}
        </div>
      )}

      {contextMenu && (
        <ContextMenu
          moduleInstance={contextMenu.moduleInstance}
          position={{ x: contextMenu.x, y: contextMenu.y }}
          onClose={() => setContextMenu(null)}
          onRename={() => handleRename(contextMenu.moduleInstance)}
          onDuplicate={() => handleDuplicate(contextMenu.moduleInstance)}
          onDelete={() => handleDelete(contextMenu.moduleInstance)}
          onOpenInAppEditor={() => handleOpenInAppEditor(contextMenu.moduleInstance)}
        />
      )}

      {renameModal && (
        <RenameModuleModal
          moduleId={renameModal.moduleId}
          currentName={renameModal.currentName}
          onClose={() => setRenameModal(null)}
          onSuccess={() => void loadModules()}
        />
      )}

      {deleteModal && (
        <DeleteModuleModal
          moduleId={deleteModal.moduleId}
          moduleName={deleteModal.moduleName}
          onClose={() => setDeleteModal(null)}
          onSuccess={() => {
            void loadModules();
            // If the deleted module was selected, clear selection
            if (selectedModuleId === deleteModal.moduleId) {
              navigate('/editor');
            }
          }}
        />
      )}
    </div>
  );
}
