import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { Trophy, Rocket, Gem, Building2, DollarSign, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface UserBadge {
   badge_id: string;
   name: string;
   description: string;
   icon: string;
   earned: boolean;
   earned_at: string | null;
}

interface TrophyCaseProps {
   userId: string;
}

export const TrophyCase = ({ userId }: TrophyCaseProps) => {
   const [badges, setBadges] = useState<UserBadge[]>([]);
   const [loading, setLoading] = useState(true);

   useEffect(() => {
      const fetchBadges = async () => {
         setLoading(true);
         try {
            const { data, error } = await (supabase as any).rpc("get_user_badges", {
               target_user_id: userId
            });

            if (error) throw error;
            setBadges(data || []);
         } catch (error) {
            console.error("Error fetching badges:", error);
         } finally {
            setLoading(false);
         }
      };

      if (userId) {
         fetchBadges();
      }
   }, [userId]);

   const getIcon = (iconName: string) => {
      switch (iconName) {
         case "rocket": return Rocket;
         case "diamond": return Gem;
         case "building": return Building2;
         case "dollar-sign": return DollarSign;
         default: return Trophy;
      }
   };

   if (!loading && badges.length === 0) return null;

   return (
      <Card className="backdrop-blur-xl bg-white/60 dark:bg-gray-900/60 border-purple-500/20 shadow-xl">
         <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl font-bold bg-gradient-to-r from-yellow-600 to-amber-600 bg-clip-text text-transparent">
               <Trophy className="w-5 h-5 text-amber-500" />
               Trophy Case
            </CardTitle>
         </CardHeader>
         <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
               {loading ? (
                  Array(4).fill(0).map((_, i) => (
                     <Skeleton key={i} className="h-24 rounded-lg bg-muted/40" />
                  ))
               ) : (
                  badges.map((badge) => {
                     const Icon = getIcon(badge.icon);
                     return (
                        <TooltipProvider key={badge.badge_id}>
                           <Tooltip>
                              <TooltipTrigger asChild>
                                 <div className={cn(
                                    "flex flex-col items-center justify-center p-4 rounded-xl border transition-all duration-300 relative overflow-hidden group hover:scale-105",
                                    badge.earned
                                       ? "bg-gradient-to-br from-amber-50 to-yellow-50 dark:from-yellow-950/20 dark:to-amber-950/20 border-amber-200/50 dark:border-amber-500/30"
                                       : "bg-muted/30 border-dashed border-muted-foreground/30 grayscale opacity-70 hover:opacity-100"
                                 )}>
                                    {!badge.earned && (
                                       <div className="absolute inset-0 bg-background/10 backdrop-blur-[1px] flex items-center justify-center z-10">
                                          <Lock className="w-6 h-6 text-muted-foreground/50" />
                                       </div>
                                    )}
                                    <div className={cn(
                                       "w-12 h-12 rounded-full flex items-center justify-center mb-2 shadow-sm transition-transform group-hover:rotate-12",
                                       badge.earned ? "bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400" : "bg-muted text-muted-foreground"
                                    )}>
                                       <Icon className="w-6 h-6" />
                                    </div>
                                    <h4 className="font-semibold text-sm text-center mb-1">{badge.name}</h4>
                                    {badge.earned && <Badge variant="secondary" className="text-[10px] h-5 bg-amber-100/50 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 border-0">Earned</Badge>}
                                 </div>
                              </TooltipTrigger>
                              <TooltipContent side="bottom" className="max-w-[200px] text-center">
                                 <p className="font-semibold mb-1">{badge.name}</p>
                                 <p className="text-xs text-muted-foreground">{badge.description}</p>
                                 {!badge.earned && <p className="text-xs text-red-500 mt-1 font-medium">Locked</p>}
                              </TooltipContent>
                           </Tooltip>
                        </TooltipProvider>
                     );
                  })
               )}
            </div>
         </CardContent>
      </Card>
   );
};
