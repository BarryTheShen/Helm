import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import ReactFlow, {
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  MarkerType,
  Panel,
} from 'reactflow';
import type { Node, Connection, NodeTypes } from 'reactflow';
import 'reactflow/dist/style.css';
import { api, type Workflow, type WorkflowCreate, type WorkflowUpdate } from '../lib/api';
import { Plus, Save, Play, Upload, Trash2 } from 'lucide-react';
import { useResource } from '../hooks/useResource';
import { TriggerNode } from '../components/workflow/TriggerNode';
import { ActionNode } from '../components/workflow/ActionNode';
import { ConditionNode } from '../components/workflow/ConditionNode';
import { SwitchNode } from '../components/workflow/SwitchNode';
import { LoopNode } from '../components/workflow/LoopNode';
import { NodeInspector } from '../components/workflow/NodeInspector';

const nodeTypes: NodeTypes = {
  trigger: TriggerNode,
  action: ActionNode,
  condition: ConditionNode,
  switch: SwitchNode,
  loop: LoopNode,
};

interface WorkflowListItem {
  id: string;
  name: string;
  description: string | null;
  trigger_type: string;
  enabled: boolean;
  created_at: string;
}

export function WorkflowsPage() {
  const [selectedWorkflow, setSelectedWorkflow] = useState<Workflow | null>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [showWorkflowList, setShowWorkflowList] = useState(true);
  const [showNodeInspector, setShowNodeInspector] = useState(false);
  const [loading, setLoading] = useState(false);

  // Create workflow modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({ name: '', description: '', trigger_type: 'manual' });

  // n8n import modal
  const [showImportModal, setShowImportModal] = useState(false);
  const [importJson, setImportJson] = useState('');

  const { data: workflowData, refetch: loadWorkflows } = useResource<{ items: WorkflowListItem[] }>(
    () => api.getWorkflows(),
    [],
  );
  const workflows = workflowData?.items ?? [];

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge({ ...params, markerEnd: { type: MarkerType.ArrowClosed } }, eds)),
    [setEdges]
  );

  const onNodeClick = useCallback((_: any, node: Node) => {
    setSelectedNode(node);
    setShowNodeInspector(true);
  }, []);

  const loadWorkflow = useCallback(async (id: string) => {
    setLoading(true);
    try {
      const wf = await api.getWorkflow(id);
      setSelectedWorkflow(wf);

      if (wf.graph?.nodes) {
        setNodes(wf.graph.nodes);
      } else {
        setNodes([]);
      }

      if (wf.graph?.edges) {
        setEdges(wf.graph.edges.map((e: any) => ({ ...e, markerEnd: { type: MarkerType.ArrowClosed } })));
      } else {
        setEdges([]);
      }

      setShowWorkflowList(false);
    } catch (err) {
      toast.error('Failed to load workflow');
    } finally {
      setLoading(false);
    }
  }, [setNodes, setEdges]);

  const saveWorkflow = useCallback(async () => {
    if (!selectedWorkflow) return;

    setLoading(true);
    try {
      const update: WorkflowUpdate = {
        graph: { nodes, edges },
      };
      await api.updateWorkflow(selectedWorkflow.id, update);
      toast.success('Workflow saved');
    } catch (err) {
      toast.error('Failed to save workflow');
    } finally {
      setLoading(false);
    }
  }, [selectedWorkflow, nodes, edges]);

  const executeWorkflow = useCallback(async () => {
    if (!selectedWorkflow) return;

    setLoading(true);
    try {
      const result = await api.executeWorkflow(selectedWorkflow.id);
      toast.success(`Workflow executed: ${result.status}`);
    } catch (err) {
      toast.error('Failed to execute workflow');
    } finally {
      setLoading(false);
    }
  }, [selectedWorkflow]);

  const createWorkflow = useCallback(async () => {
    if (!createForm.name.trim()) return;

    setLoading(true);
    try {
      const data: WorkflowCreate = {
        name: createForm.name,
        description: createForm.description || undefined,
        trigger_type: createForm.trigger_type,
        graph: { nodes: [], edges: [] },
      };
      const newWf = await api.createWorkflow(data);
      setShowCreateModal(false);
      setCreateForm({ name: '', description: '', trigger_type: 'manual' });
      toast.success('Workflow created');
      await loadWorkflows();
      loadWorkflow(newWf.id);
    } catch (err) {
      toast.error('Failed to create workflow');
    } finally {
      setLoading(false);
    }
  }, [createForm, loadWorkflows, loadWorkflow]);

  const deleteWorkflow = useCallback(async (id: string) => {
    if (!confirm('Delete this workflow?')) return;

    setLoading(true);
    try {
      await api.deleteWorkflow(id);
      toast.success('Workflow deleted');
      await loadWorkflows();
      if (selectedWorkflow?.id === id) {
        setSelectedWorkflow(null);
        setNodes([]);
        setEdges([]);
        setShowWorkflowList(true);
      }
    } catch (err) {
      toast.error('Failed to delete workflow');
    } finally {
      setLoading(false);
    }
  }, [selectedWorkflow, loadWorkflows, setNodes, setEdges]);

  const importN8n = useCallback(async () => {
    if (!importJson.trim()) return;

    setLoading(true);
    try {
      const n8nData = JSON.parse(importJson);
      const result = await api.importN8nWorkflow(n8nData);

      if (result.warnings.length > 0) {
        console.warn('Import warnings:', result.warnings);
      }

      setNodes(result.workflow.nodes || []);
      setEdges((result.workflow.edges || []).map((e: any) => ({ ...e, markerEnd: { type: MarkerType.ArrowClosed } })));
      setShowImportModal(false);
      setImportJson('');
      toast.success('n8n workflow imported');
    } catch (err) {
      toast.error('Failed to import n8n workflow');
    } finally {
      setLoading(false);
    }
  }, [importJson, setNodes, setEdges]);

  const addNode = useCallback((type: 'trigger' | 'action' | 'condition' | 'switch' | 'loop') => {
    const id = `${type}-${Date.now()}`;
    const newNode: Node = {
      id,
      type,
      position: { x: 250, y: 100 + nodes.length * 100 },
      data: {
        label: `New ${type}`,
        ...(type === 'trigger' && { triggerType: 'manual' }),
        ...(type === 'action' && { action: '', params: {} }),
        ...(type === 'condition' && { condition: '' }),
        ...(type === 'switch' && { value: '', cases: [] }),
        ...(type === 'loop' && { items: '', iterations: 1, variable: 'item' }),
      },
    };
    setNodes((nds) => [...nds, newNode]);
  }, [nodes.length, setNodes]);

  const updateNodeData = useCallback((nodeId: string, data: any) => {
    setNodes((nds) =>
      nds.map((node) => (node.id === nodeId ? { ...node, data: { ...node.data, ...data } } : node))
    );
  }, [setNodes]);

  const deleteNode = useCallback(() => {
    if (!selectedNode) return;
    setNodes((nds) => nds.filter((n) => n.id !== selectedNode.id));
    setEdges((eds) => eds.filter((e) => e.source !== selectedNode.id && e.target !== selectedNode.id));
    setSelectedNode(null);
    setShowNodeInspector(false);
  }, [selectedNode, setNodes, setEdges]);

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold text-gray-900">Workflows</h1>
          {selectedWorkflow && (
            <div className="text-sm text-gray-500">
              {selectedWorkflow.name}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {selectedWorkflow && (
            <>
              <button
                onClick={saveWorkflow}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-medium disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                Save
              </button>
              <button
                onClick={executeWorkflow}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md text-sm font-medium disabled:opacity-50"
              >
                <Play className="w-4 h-4" />
                Execute
              </button>
            </>
          )}
          <button
            onClick={() => setShowImportModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-md text-sm font-medium"
          >
            <Upload className="w-4 h-4" />
            Import n8n
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-gray-900 hover:bg-gray-800 text-white rounded-md text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            New Workflow
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Workflow List Sidebar */}
        {showWorkflowList && (
          <div className="w-80 bg-white border-r overflow-y-auto">
            <div className="p-4 border-b">
              <h2 className="font-semibold text-gray-900">Your Workflows</h2>
            </div>
            <div className="divide-y">
              {workflows.map((wf) => (
                <div
                  key={wf.id}
                  className="p-4 hover:bg-gray-50 cursor-pointer flex items-start justify-between group"
                  onClick={() => loadWorkflow(wf.id)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm text-gray-900 truncate">{wf.name}</div>
                    {wf.description && (
                      <div className="text-xs text-gray-500 mt-1 line-clamp-2">{wf.description}</div>
                    )}
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded">
                        {wf.trigger_type}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded ${wf.enabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {wf.enabled ? 'Enabled' : 'Disabled'}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteWorkflow(wf.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-50 rounded text-red-600"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              {workflows.length === 0 && (
                <div className="p-8 text-center text-sm text-gray-500">
                  No workflows yet. Create one to get started.
                </div>
              )}
            </div>
          </div>
        )}

        {/* Canvas */}
        <div className="flex-1 relative">
          {selectedWorkflow ? (
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onNodeClick={onNodeClick}
              nodeTypes={nodeTypes}
              fitView
            >
              <Background />
              <Controls />
              <Panel position="top-left" className="bg-white rounded-lg shadow-md p-2 flex gap-2">
                <button
                  onClick={() => addNode('trigger')}
                  className="px-3 py-1.5 text-xs bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded border border-indigo-200"
                >
                  + Trigger
                </button>
                <button
                  onClick={() => addNode('action')}
                  className="px-3 py-1.5 text-xs bg-blue-50 hover:bg-blue-100 text-blue-700 rounded border border-blue-200"
                >
                  + Action
                </button>
                <button
                  onClick={() => addNode('condition')}
                  className="px-3 py-1.5 text-xs bg-yellow-50 hover:bg-yellow-100 text-yellow-700 rounded border border-yellow-200"
                >
                  + Condition
                </button>
                <button
                  onClick={() => addNode('switch')}
                  className="px-3 py-1.5 text-xs bg-purple-50 hover:bg-purple-100 text-purple-700 rounded border border-purple-200"
                >
                  + Switch
                </button>
                <button
                  onClick={() => addNode('loop')}
                  className="px-3 py-1.5 text-xs bg-green-50 hover:bg-green-100 text-green-700 rounded border border-green-200"
                >
                  + Loop
                </button>
              </Panel>
            </ReactFlow>
          ) : (
            <div className="h-full flex items-center justify-center text-gray-500">
              Select a workflow or create a new one
            </div>
          )}
        </div>

        {/* Node Inspector */}
        {showNodeInspector && selectedNode && (
          <NodeInspector
            node={selectedNode}
            onClose={() => setShowNodeInspector(false)}
            onUpdate={updateNodeData}
            onDelete={deleteNode}
          />
        )}
      </div>

      {/* Create Workflow Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-[500px] p-6">
            <h3 className="text-lg font-semibold mb-4">Create Workflow</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input
                  type="text"
                  value={createForm.name}
                  onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md text-sm"
                  placeholder="My Workflow"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={createForm.description}
                  onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md text-sm h-20"
                  placeholder="Optional description"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Trigger Type</label>
                <select
                  value={createForm.trigger_type}
                  onChange={(e) => setCreateForm({ ...createForm, trigger_type: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md text-sm"
                >
                  <option value="manual">Manual</option>
                  <option value="onSchedule">Schedule</option>
                  <option value="onDataChange">Data Change</option>
                  <option value="onServerEvent">Server Event</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2 justify-end mt-6">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md"
              >
                Cancel
              </button>
              <button
                onClick={createWorkflow}
                disabled={!createForm.name.trim() || loading}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-md"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import n8n Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-[600px] p-6">
            <h3 className="text-lg font-semibold mb-4">Import n8n Workflow</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">n8n JSON</label>
                <textarea
                  value={importJson}
                  onChange={(e) => setImportJson(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md text-sm font-mono h-64"
                  placeholder='Paste n8n workflow JSON here...'
                />
              </div>
            </div>
            <div className="flex gap-2 justify-end mt-6">
              <button
                onClick={() => setShowImportModal(false)}
                className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md"
              >
                Cancel
              </button>
              <button
                onClick={importN8n}
                disabled={!importJson.trim() || loading}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-sm font-medium rounded-md"
              >
                Import
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
