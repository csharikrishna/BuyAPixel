import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Radio, Users, UserCheck } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface User {
  user_id: string;
  email: string;
  full_name: string | null;
  total_spent: number;
}

interface AdminLiveViewersTabProps {
  users: User[];
}

interface PresenceState {
  online_at: string;
  user_id: string | null;
}

export const AdminLiveViewersTab: React.FC<AdminLiveViewersTabProps> = ({ users }) => {
  const [viewers, setViewers] = useState<PresenceState[]>([]);

  useEffect(() => {
    const room = supabase.channel('online-viewers');
    room
      .on('presence', { event: 'sync' }, () => {
        const state = room.presenceState();
        // Flatten presence state since multiple tabs by same user would have same key
        const flatState: PresenceState[] = [];
        Object.keys(state).forEach((key) => {
          const presences = state[key] as PresenceState[];
          if (presences && presences.length > 0) {
            flatState.push(presences[0]);
          }
        });
        
        // Sort by online_at descending
        flatState.sort((a, b) => new Date(b.online_at).getTime() - new Date(a.online_at).getTime());
        setViewers(flatState);
      })
      .subscribe();
      
    return () => {
      supabase.removeChannel(room);
    };
  }, []);

  const loggedInCount = viewers.filter(v => v.user_id).length;
  const guestCount = viewers.length - loggedInCount;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-1">Total Online Now</p>
              <h3 className="text-3xl font-bold">{viewers.length}</h3>
            </div>
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Radio className="w-6 h-6 text-primary animate-pulse" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-1">Logged In</p>
              <h3 className="text-3xl font-bold">{loggedInCount}</h3>
            </div>
            <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center">
              <UserCheck className="w-6 h-6 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-1">Anonymous Guests</p>
              <h3 className="text-3xl font-bold">{guestCount}</h3>
            </div>
            <div className="w-12 h-12 rounded-full bg-gray-500/10 flex items-center justify-center">
              <Users className="w-6 h-6 text-gray-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Live Traffic</CardTitle>
          <CardDescription>Real-time view of everyone currently connected to the site.</CardDescription>
        </CardHeader>
        <CardContent>
          {viewers.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Radio className="w-8 h-8 mx-auto mb-4 opacity-50 animate-pulse" />
              <p>Waiting for connections...</p>
            </div>
          ) : (
            <div className="rounded-md border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Total Spent</TableHead>
                    <TableHead>Connected</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {viewers.map((viewer, index) => {
                    let userMatch = null;
                    if (viewer.user_id) {
                      userMatch = users.find(u => u.user_id === viewer.user_id);
                    }

                    return (
                      <TableRow key={`${viewer.user_id || 'guest'}-${index}`}>
                        <TableCell>
                          {userMatch ? (
                            <div>
                              <p className="font-medium">{userMatch.full_name || 'No Name'}</p>
                              <p className="text-sm text-muted-foreground">{userMatch.email}</p>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-muted-foreground">Anonymous Guest</span>
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          {userMatch ? (
                            <Badge variant="default" className="bg-blue-500/10 text-blue-600 hover:bg-blue-500/20 border-blue-200">
                              Logged In
                            </Badge>
                          ) : (
                            <Badge variant="outline">
                              Guest
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {userMatch ? (
                            <span className="font-medium">
                              ₹{(userMatch.total_spent || 0).toLocaleString('en-IN')}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-muted-foreground">
                            {formatDistanceToNow(new Date(viewer.online_at), { addSuffix: true })}
                          </span>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
