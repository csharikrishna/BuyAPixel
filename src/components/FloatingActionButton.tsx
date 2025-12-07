import { ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface FloatingActionButtonProps {
  selectedCount: number;
  onClick: () => void;
}

export const FloatingActionButton = ({ selectedCount, onClick }: FloatingActionButtonProps) => {
  if (selectedCount === 0) return null;

  return (
    <div className="fixed bottom-20 right-4 z-40 lg:hidden animate-scale-in">
      <Button
        onClick={onClick}
        size="lg"
        className="h-16 w-16 rounded-full shadow-2xl hover:shadow-[0_0_40px_rgba(var(--primary-rgb),0.5)] transition-all duration-300 hover:scale-110 relative bg-gradient-to-br from-primary to-accent border-2 border-primary/30"
      >
        <ShoppingCart className="h-7 w-7" />
        {selectedCount > 0 && (
          <Badge 
            variant="destructive" 
            className="absolute -top-2 -right-2 h-7 w-7 flex items-center justify-center p-0 rounded-full text-xs font-bold shadow-lg animate-pulse"
          >
            {selectedCount > 99 ? "99+" : selectedCount}
          </Badge>
        )}
      </Button>
    </div>
  );
};
