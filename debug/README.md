# Helm Debug Scripts (FF3-DEBUG-001)

Trace scripts for diagnosing template apply, data sources, and app preview flows without guessing.

## Prerequisites

- Backend running at `http://localhost:8000` (or set `HELM_API`)
- Admin session token from web localStorage key `admin_token` (or set `HELM_TOKEN`)

## Scripts

| Script | Purpose |
|--------|---------|
| `trace_template_apply.py` | List template → apply to module → verify draft rows |
| `trace_data_source.py` | List sources → schema → query by stable id (`calendar_events`, etc.) |
| `trace_app_preview.py` | Resolve app + bottom bar modules (same path as BrowserPreview) |

## Examples

```bash
export HELM_TOKEN="your-admin-token"

# Template apply flow (FF4-TPL-001)
python debug/trace_template_apply.py --template Home --module home

# Data source mobile path
python debug/trace_data_source.py --source todos

# App preview bundle (FF4-APP-014)
python debug/trace_app_preview.py
python debug/trace_app_preview.py --app <app-uuid>
```

## Admin UI

Open **Logs** in Helm Admin for audit entries. Use **Variables → Data Sources** to verify seeded ids.
Use **App Editor → Preview** for Browser/Device preview (FF4 wins over legacy AppPreview simulation).

## In-app trace hints

Components log structured prefixes when `localStorage.setItem('helm_debug', '1')` in the browser console:

- `[EditorStore]` — module editor load/save
- `[AppEditor]` — app preview/publish
- `BrowserPreview:` — preview bundle errors
