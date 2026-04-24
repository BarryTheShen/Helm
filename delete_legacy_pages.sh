#!/bin/bash
# Delete legacy web admin pages

rm -f /home/barry/Nextcloud/vc_projects/Helm/web/src/pages/DashboardPage.tsx
rm -f /home/barry/Nextcloud/vc_projects/Helm/web/src/pages/ComponentsPage.tsx
rm -f /home/barry/Nextcloud/vc_projects/Helm/web/src/pages/ActionsTriggersPage.tsx
rm -f /home/barry/Nextcloud/vc_projects/Helm/web/src/pages/SessionsPage.tsx
rm -f /home/barry/Nextcloud/vc_projects/Helm/web/src/pages/AuditPage.tsx

echo "Deleted 5 legacy page files"
