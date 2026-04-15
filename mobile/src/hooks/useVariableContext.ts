/**
 * useVariableContext — assembles the full VariableContext for SDUI expression resolution.
 *
 * Combines user info from auth store, component state, custom variables (fetched from
 * backend on mount), and env config into a single context object for the variable resolver.
 */
import { useState, useEffect, useMemo, useRef } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { useComponentStateStore } from '@/stores/componentStateStore';
import type { VariableContext } from '@/utils/variableResolver';

// Module-level cache for custom variables so they persist across hook instances.
let customVariablesCache: Record<string, string | number | boolean> = {};
let customVariablesFetched = false;

export function useVariableContext(selfId?: string): VariableContext {
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const serverUrl = useAuthStore((s) => s.serverUrl);
  const componentStates = useComponentStateStore((s) => s.states);
  const [customVars, setCustomVars] = useState<Record<string, string | number | boolean>>(
    customVariablesCache,
  );
  const mountedRef = useRef(true);

  // Fetch custom variables from backend on first mount (shared across all instances)
  useEffect(() => {
    mountedRef.current = true;
    if (!token || !serverUrl || customVariablesFetched) return;

    customVariablesFetched = true;
    fetch(`${serverUrl}/api/variables?limit=200`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => {
        if (!res.ok) throw new Error(`Variables fetch: ${res.status}`);
        return res.json();
      })
      .then((body: { items: Array<{ name: string; value: string; type: string }> }) => {
        const vars: Record<string, string | number | boolean> = {};
        for (const v of body.items) {
          if (v.type === 'number') {
            vars[v.name] = Number(v.value);
          } else if (v.type === 'boolean') {
            vars[v.name] = v.value === 'true';
          } else {
            vars[v.name] = v.value;
          }
        }
        customVariablesCache = vars;
        if (mountedRef.current) setCustomVars(vars);
      })
      .catch(() => {
        // Silently fail — custom variables are optional enhancement
      });

    return () => {
      mountedRef.current = false;
    };
  }, [token, serverUrl]);

  const selfState = selfId ? (componentStates[selfId] ?? {}) : {};

  return useMemo<VariableContext>(
    () => ({
      user: user
        ? { username: user.username, id: user.id, email: user.email ?? '' }
        : {},
      component: componentStates,
      self: selfState,
      data: {},
      env: {},
      custom: customVars,
    }),
    [user, componentStates, selfState, customVars],
  );
}

/** Clear the custom variables cache so next hook mount re-fetches. */
export function clearCustomVariablesCache(): void {
  customVariablesCache = {};
  customVariablesFetched = false;
}
