import { useState, useEffect, useCallback, useRef, useMemo, type ReactNode } from "react";
import { Puck } from "@puckeditor/core";
import "@puckeditor/core/puck.css";
import { buildPuckConfig } from "../lib/puckConfig";
import { puckToHelm, helmToPuck } from "../lib/sduiAdapter";
import { api } from "../lib/api";
import { Save, Rocket, RefreshCw, FileText, CheckCircle, XCircle } from "lucide-react";

interface ModuleInfo {
  module_id: string;
  name: string;
  icon: string;
  has_screen: boolean;
}

interface Template {
  id: string;
  name: string;
  description: string | null;
  category: string;
  is_public: boolean;
}

interface TemplateDetail extends Template {
  screen_json: any;
}

interface DraftInfo {
  has_draft: boolean;
  version?: number;
  screen?: any;
}

export function EditorPage() {
  const [modules, setModules] = useState<ModuleInfo[]>([]);
  const [selectedModule, setSelectedModule] = useState<string>("");
  const [puckData, setPuckData] = useState<any>(null);
  const [puckVersion, setPuckVersion] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pushing, setPushing] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error" | "info";
    text: string;
  } | null>(null);

  // Draft state
  const [draftInfo, setDraftInfo] = useState<DraftInfo>({ has_draft: false });
  const [approvingDraft, setApprovingDraft] = useState(false);

  // Template modal state
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [currentPuckData, setCurrentPuckData] = useState<any>(null);
  const [templateName, setTemplateName] = useState("");
  const [templateCategory, setTemplateCategory] = useState("custom");

  // Load template modal state
  const [showLoadTemplateModal, setShowLoadTemplateModal] = useState(false);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);

  const config = useRef(buildPuckConfig()).current;

  const currentDataRef = useRef<any>(null);

  useEffect(() => {
    currentDataRef.current = puckData;
  }, [puckData]);

  const showMsg = useCallback(
    (type: "success" | "error" | "info", text: string) => {
      setMessage({ type, text });
      setTimeout(() => setMessage(null), 4000);
    },
    [],
  );

  // Load all modules from backend
  useEffect(() => {
    api
      .get<{ items: ModuleInfo[] }>("/api/sdui/modules")
      .then((data) => {
        const mods = data.items || [];
        setModules(mods);
        if (mods.length > 0) setSelectedModule(mods[0].module_id);
        setLoading(false);
      })
      .catch(() => {
        const fallback: ModuleInfo[] = [
          { module_id: "home", name: "Home", icon: "🏠", has_screen: false },
          { module_id: "chat", name: "Chat", icon: "💬", has_screen: false },
          { module_id: "modules", name: "Modules", icon: "🧩", has_screen: false },
          { module_id: "calendar", name: "Calendar", icon: "📅", has_screen: false },
          { module_id: "forms", name: "Forms", icon: "📝", has_screen: false },
          { module_id: "alerts", name: "Alerts", icon: "🔔", has_screen: false },
          { module_id: "settings", name: "Settings", icon: "⚙️", has_screen: false },
        ];
        setModules(fallback);
        setSelectedModule("home");
        setLoading(false);
      });
  }, []);

  // Load screen when module changes
  useEffect(() => {
    if (!selectedModule) return;
    setLoading(true);
    setDraftInfo({ has_draft: false });

    Promise.all([
      api.get<any>(`/api/sdui/${selectedModule}`).catch(() => ({ screen: null })),
      api.get<DraftInfo>(`/api/sdui/${selectedModule}/draft`).catch(() => ({ has_draft: false })),
    ]).then(([screenData, draft]) => {
      const screen = screenData.screen || screenData.state_json;
      if (screen && screen.rows) {
        setPuckData(helmToPuck(screen));
      } else {
        setPuckData({ content: [], root: { props: {} }, zones: {} });
      }
      setDraftInfo(draft as DraftInfo);
      setPuckVersion((v) => v + 1);
    }).finally(() => setLoading(false));
  }, [selectedModule]);

  // Save as draft
  const handleSaveDraft = useCallback(
    async () => {
      setSaving(true);
      setMessage(null);
      try {
        if (!currentDataRef.current) return;
        const helmScreen = puckToHelm(currentDataRef.current);
        const result = await api.post<any>(`/api/sdui/${selectedModule}`, { screen: helmScreen });
        if (result.draft) {
          showMsg("info", `Draft saved (v${result.version}). Approve it to push live.`);
          setDraftInfo({ has_draft: true, version: result.version });
        } else {
          showMsg("success", "Screen saved and pushed live!");
        }
        setModules((prev) =>
          prev.map((m) =>
            m.module_id === selectedModule ? { ...m, has_screen: true } : m,
          ),
        );
      } catch (err) {
        showMsg("error", err instanceof Error ? err.message : "Save failed");
      } finally {
        setSaving(false);
      }
    },
    [selectedModule, showMsg],
  );

  // Push live: save as draft then immediately approve
  const handlePushLive = useCallback(
    async () => {
      setPushing(true);
      setMessage(null);
      try {
        if (!currentDataRef.current) return;
        const helmScreen = puckToHelm(currentDataRef.current);
        // Step 1: Save the screen (creates draft if auto_approve is off)
        const saveResult = await api.post<any>(`/api/sdui/${selectedModule}`, { screen: helmScreen });

        if (saveResult.draft) {
          // Step 2: Approve the draft to make it live
          const approveResult = await api.post<any>(`/api/sdui/${selectedModule}/draft/approve`);
          showMsg("success", `Pushed live! (v${approveResult.version})`);
          setDraftInfo({ has_draft: false });
        } else {
          // Auto-approve was on, already live
          showMsg("success", "Pushed live!");
        }

        setModules((prev) =>
          prev.map((m) =>
            m.module_id === selectedModule ? { ...m, has_screen: true } : m,
          ),
        );
      } catch (err) {
        showMsg("error", `Push failed: ${err instanceof Error ? err.message : "Unknown error"}`);
      } finally {
        setPushing(false);
      }
    },
    [selectedModule, showMsg],
  );

  // Approve existing draft
  const handleApproveDraft = useCallback(async () => {
    setApprovingDraft(true);
    try {
      const result = await api.post<any>(`/api/sdui/${selectedModule}/draft/approve`);
      showMsg("success", `Draft approved and pushed live! (v${result.version})`);
      setDraftInfo({ has_draft: false });
      // Reload the live screen
      const screenData = await api.get<any>(`/api/sdui/${selectedModule}`);
      const screen = screenData.screen;
      if (screen && screen.rows) {
        setPuckData(helmToPuck(screen));
        setPuckVersion((v) => v + 1);
      }
    } catch (err) {
      showMsg("error", err instanceof Error ? err.message : "Approve failed");
    } finally {
      setApprovingDraft(false);
    }
  }, [selectedModule, showMsg]);

  // Reject existing draft
  const handleRejectDraft = useCallback(async () => {
    try {
      await api.post(`/api/sdui/${selectedModule}/draft/reject`);
      showMsg("info", "Draft rejected and discarded.");
      setDraftInfo({ has_draft: false });
    } catch (err) {
      showMsg("error", err instanceof Error ? err.message : "Reject failed");
    }
  }, [selectedModule, showMsg]);

  // Save template
  const handleSaveTemplate = useCallback(
    async (data: any, name: string, category: string) => {
      try {
        const helmScreen = puckToHelm(data);
        await api.post("/api/templates", {
          name,
          category,
          screen_json: helmScreen,
          is_public: true,
        });
        showMsg("success", "Template saved!");
      } catch (err) {
        showMsg("error", err instanceof Error ? err.message : "Save failed");
      }
    },
    [showMsg],
  );

  // Load template list
  const loadTemplates = useCallback(async () => {
    setLoadingTemplates(true);
    try {
      const data = await api.get<{ items: Template[] }>("/api/templates");
      setTemplates(data.items || []);
    } catch {
      setTemplates([]);
    } finally {
      setLoadingTemplates(false);
    }
  }, []);

  // Apply template to editor
  const applyTemplate = useCallback(
    async (templateId: string) => {
      try {
        const detail = await api.get<TemplateDetail>(
          `/api/templates/${templateId}`,
        );
        if (detail.screen_json) {
          setPuckData(helmToPuck(detail.screen_json));
          setPuckVersion((v) => v + 1);
          showMsg("success", `Loaded template: ${detail.name}`);
        }
      } catch (err) {
        showMsg(
          "error",
          err instanceof Error ? err.message : "Failed to load template",
        );
      }
      setShowLoadTemplateModal(false);
    },
    [showMsg],
  );

  const handleOpenTemplateModal = useCallback(() => {
    setCurrentPuckData(currentDataRef.current);
    setShowTemplateModal(true);
  }, []);

  const puckOverrides = useMemo(() => ({
    headerActions: ({ children: _children }: { children: ReactNode }) => (
      <div className="flex items-center gap-2">
        <button
          onClick={handleSaveDraft}
          disabled={saving}
          className="flex items-center gap-1.5 px-4 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors disabled:opacity-50"
        >
          <Save size={14} />
          {saving ? "Saving..." : "Save Draft"}
        </button>
        <button
          onClick={handlePushLive}
          disabled={pushing}
          className="flex items-center gap-1.5 px-4 py-1.5 text-sm bg-green-600 hover:bg-green-700 text-white rounded-md transition-colors disabled:opacity-50"
        >
          <Rocket size={14} />
          {pushing ? "Pushing..." : "Push Live"}
        </button>
        <button
          onClick={handleOpenTemplateModal}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
        >
          <FileText size={14} />
          Save as Template
        </button>
      </div>
    ),
  }), [handleSaveDraft, handlePushLive, handleOpenTemplateModal, saving, pushing]);

  if (loading && !puckData) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        Loading editor...
      </div>
    );
  }

  if (!puckData) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        No data to display
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col -m-6">
      {/* Top toolbar */}
      <div className="flex items-center justify-between px-4 py-2 bg-white border-b">
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-gray-600">Module:</label>
          <select
            value={selectedModule}
            onChange={(e) => setSelectedModule(e.target.value)}
            className="px-3 py-1.5 border rounded-md text-sm"
          >
            {modules.map((m) => (
              <option key={m.module_id} value={m.module_id}>
                {m.icon} {m.name}
                {m.has_screen ? " ●" : ""}
              </option>
            ))}
          </select>
          {draftInfo.has_draft && (
            <div className="flex items-center gap-2">
              <span className="text-xs px-2 py-1 bg-amber-100 text-amber-700 rounded-full font-medium">
                Draft pending (v{draftInfo.version})
              </span>
              <button
                onClick={handleApproveDraft}
                disabled={approvingDraft}
                className="flex items-center gap-1 px-2 py-1 text-xs bg-green-100 hover:bg-green-200 text-green-700 rounded-md transition-colors"
              >
                <CheckCircle size={12} />
                Approve
              </button>
              <button
                onClick={handleRejectDraft}
                className="flex items-center gap-1 px-2 py-1 text-xs bg-red-100 hover:bg-red-200 text-red-700 rounded-md transition-colors"
              >
                <XCircle size={12} />
                Reject
              </button>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {message && (
            <span
              className={`text-sm px-3 py-1 rounded ${
                message.type === "success"
                  ? "bg-green-50 text-green-700"
                  : message.type === "info"
                    ? "bg-blue-50 text-blue-700"
                    : "bg-red-50 text-red-700"
              }`}
            >
              {message.text}
            </span>
          )}
          <button
            onClick={() => {
              setShowLoadTemplateModal(true);
              loadTemplates();
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
          >
            <RefreshCw size={14} />
            Load Template
          </button>
        </div>
      </div>

      {/* Puck Editor — key forces re-mount on module switch */}
      <div className="flex-1 overflow-hidden">
        <Puck
          key={`${selectedModule}-${puckVersion}`}
          config={config}
          data={puckData}
          onPublish={() => handleSaveDraft()}
          onChange={(data) => { currentDataRef.current = data; }}
          headerTitle={`Editing: ${selectedModule}`}
          overrides={puckOverrides}
          iframe={{ enabled: false }}
        />
      </div>

      {/* Save as Template Modal */}
      {showTemplateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-[400px]">
            <h3 className="text-lg font-semibold mb-4">Save as Template</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Name
                </label>
                <input
                  type="text"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="My Template"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Category
                </label>
                <select
                  value={templateCategory}
                  onChange={(e) => setTemplateCategory(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                >
                  <option value="dashboard">Dashboard</option>
                  <option value="planner">Planner</option>
                  <option value="tracker">Tracker</option>
                  <option value="form">Form</option>
                  <option value="custom">Custom</option>
                </select>
              </div>
              <div className="flex gap-2 justify-end pt-2">
                <button
                  onClick={() => {
                    setShowTemplateModal(false);
                    setTemplateName("");
                  }}
                  className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    if (!templateName.trim()) return;
                    await handleSaveTemplate(
                      currentPuckData,
                      templateName,
                      templateCategory,
                    );
                    setShowTemplateModal(false);
                    setTemplateName("");
                  }}
                  className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors"
                >
                  Save Template
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Load Template Modal */}
      {showLoadTemplateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-[600px] max-h-[80vh] overflow-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Load Template</h3>
              <button
                onClick={() => setShowLoadTemplateModal(false)}
                className="text-gray-400 hover:text-gray-600 text-xl"
              >
                ✕
              </button>
            </div>
            {loadingTemplates ? (
              <div className="text-center py-8 text-gray-500">
                Loading templates...
              </div>
            ) : templates.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No templates available
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {templates.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => applyTemplate(t.id)}
                    className="text-left p-4 border rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors"
                  >
                    <div className="font-medium text-sm">{t.name}</div>
                    <div className="text-xs text-gray-500 mt-1">
                      {t.description || "No description"}
                    </div>
                    <span className="inline-block mt-2 px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-600">
                      {t.category}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}