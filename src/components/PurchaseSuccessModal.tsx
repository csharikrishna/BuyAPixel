import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle, Eye, User, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

interface PurchaseSuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  pixelCount: number;
  totalCost: number;
}

export const PurchaseSuccessModal = ({
  isOpen,
  onClose,
  pixelCount,
  totalCost
}: PurchaseSuccessModalProps) => {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader className="text-center">
          <div className="mx-auto mb-4 w-16 h-16 bg-success/10 rounded-full flex items-center justify-center">
            <CheckCircle className="w-8 h-8 text-success" />
          </div>
          <DialogTitle className="text-xl">Purchase Successful! 🎉</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <Card className="border-success/20 bg-success/5">
            <CardContent className="p-4 text-center">
              <div className="space-y-2">
                <div className="text-2xl font-bold text-success">{pixelCount}</div>
                <div className="text-sm text-muted-foreground">pixels purchased</div>
                <div className="text-lg font-semibold">₹{totalCost}</div>
              </div>
            </CardContent>
          </Card>

          <div className="text-center text-sm text-muted-foreground">
            Your pixels are now live on the canvas and visible in your profile!
          </div>

          <div className="flex gap-2">
            <Link to="/canvas" className="flex-1">
              <Button variant="outline" className="w-full gap-2">
                <Eye className="w-4 h-4" />
                View Canvas
              </Button>
            </Link>
            <Link to="/profile" className="flex-1">
              <Button className="w-full gap-2">
                <User className="w-4 h-4" />
                My Profile
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
          </div>

          <Button variant="ghost" onClick={onClose} className="w-full">
            Continue Shopping
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};