import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Activity, Eye } from 'lucide-react';
import { format } from 'date-fns';

interface AuditLog {
  id: string;
  admin_user_id: string;
  action: string;
  target_type: string;
  target_id: string;
  details: any;
  created_at: string;
}

interface AdminAuditTabProps {
  auditLogs: AuditLog[];
}

export function AdminAuditTab({ auditLogs }: AdminAuditTabProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Admin Activity Logs</CardTitle>
        <CardDescription>
          Track all administrative actions performed on the system
        </CardDescription>
      </CardHeader>
      <CardContent>
        {auditLogs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <Activity className="w-8 h-8 text-muted-foreground/50" />
            </div>
            <p className="text-sm font-medium">No audit logs yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              Admin actions will appear here
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {auditLogs.map((log) => (
              <div key={log.id} className="flex items-start gap-4 p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Activity className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0 space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="secondary" className="font-mono text-xs">
                      {log.action}
                    </Badge>
                    <span className="text-sm text-muted-foreground truncate">
                      by admin {log.admin_user_id?.slice(0, 8)}...
                    </span>
                  </div>
                  <p className="text-sm">
                    <span className="text-muted-foreground">Target:</span> {log.target_type}{' '}
                    <span className="font-mono text-xs text-muted-foreground">
                      ({log.target_id.slice(0, 8)}...)
                    </span>
                  </p>
                  {log.details && Object.keys(log.details).length > 0 && (
                    <details className="text-xs">
                      <summary className="cursor-pointer text-muted-foreground hover:text-foreground transition-colors">
                        View details
                      </summary>
                      <pre className="mt-2 p-3 bg-muted rounded-md text-xs overflow-x-auto">
                        {JSON.stringify(log.details, null, 2)}
                      </pre>
                    </details>
                  )}
                  <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <Eye className="w-3 h-3" />
                    {format(new Date(log.created_at), 'MMM dd, yyyy · HH:mm:ss')}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
