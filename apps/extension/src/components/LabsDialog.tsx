import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import ServerClockSection from "./Labs/ServerClockSection";
import QRGeneratorSection from "./Labs/QRGeneratorSection";
import LibrarySeatSection from "./Labs/LibrarySeatSection";

interface LabsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const LabsDialog = ({ open, onOpenChange }: LabsDialogProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>실험실</DialogTitle>
          <DialogDescription className="hidden">
            실험적 기능들
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh]">
          <div className="space-y-6 pr-4">
            <LibrarySeatSection />
            <ServerClockSection />
            <QRGeneratorSection />
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

export default LabsDialog;
