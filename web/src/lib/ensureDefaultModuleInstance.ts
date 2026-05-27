import { api } from './api';

interface TemplateListItem {
  id: string;
  name: string;
}

/**
 * Ensure at least one module instance exists for App Editor launchpad (FF4-APP-012).
 * Fresh installs have built-in Module Editor tabs but no installed instances until
 * a template is applied. Bootstrap Home from the Home template when none exist.
 */
export async function ensureDefaultHomeModuleInstance(): Promise<boolean> {
  const instances = await api.getModuleInstances();
  if (instances.items.some(m => m.status === 'active')) {
    return false;
  }

  const templatesPayload = await api.get<TemplateListItem[] | { items: TemplateListItem[] }>(
    '/api/templates',
  );
  const templates = Array.isArray(templatesPayload)
    ? templatesPayload
    : templatesPayload.items ?? [];
  const homeTemplate = templates.find(t => t.name === 'Home');
  if (!homeTemplate?.id) {
    return false;
  }

  await api.installModule({ template_id: homeTemplate.id, name: 'Home' });
  return true;
}
