import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Shield, KeyRound } from 'lucide-react';

interface AdminUser {
  user_id: string;
  email: string;
  full_name: string | null;
  created_at: string;
}9

interface AdminAccessTabProps {
  admins: AdminUser[];
  newAdminEmail: string;
  onNewAdminEmailChange: (value: string) => void;
  onGrantAccess: () => void;
  onRevokeAccess: (email: string) => void;
  processing: boolean;
}

export function AdminAccessTab({
  admins, newAdminEmail, onNewAdminEmailChange,
  onGrantAccess, onRevokeAccess, processing,
}: AdminAccessTabProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <KeyRound className="w-5 h-5 text-primary" />
          Access Management
        </CardTitle>
        <CardDescription>
          Grant or revoke admin access to other users.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex gap-4 items-end">
          <div className="flex-1 space-y-2">
            <Label>Grant Admin Access</Label>
            <Input
              placeholder="Enter user email address"
              value={newAdminEmail}
              onChange={(e) => onNewAdminEmailChange(e.target.value)}
            />
          </div>
          <Button onClick={onGrantAccess} disabled={processing || !newAdminEmail}>
            Grant Access
          </Button>
        </div>

        <div className="space-y-4">
          <h3 className="text-sm font-medium text-muted-foreground">Current Admins</h3>
          <div className="border rounded-md divide-y">
            {admins.length === 0 ? (
              <div className="p-4 text-center text-muted-foreground text-sm">
                No other admins found.
              </div>
            ) : (
              admins.map((admin) => (
                <div key={admin.user_id} className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <Shield className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">{admin.full_name || 'Unnamed'}</p>
                      <p className="text-xs text-muted-foreground">{admin.email}</p>
                    </div>
                  </div>
                  <Button
                    variant="ghost" size="sm"
                    className="text-destructive hover:text-destructive/90 hover:bg-destructive/10"
                    onClick={() => onRevokeAccess(admin.email)}
                    disabled={processing}
                  >
                    Revoke
                  </Button>
                </div>
              ))
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
