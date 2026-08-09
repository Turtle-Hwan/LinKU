import { useEffect } from "react";
import { FlaskConical } from "lucide-react";
import UtilityDialog from "@/components/UtilityDialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { usePersistentDialogTab } from "@/hooks/usePersistentDialogTab";
import ServerClockSection from "./Labs/ServerClockSection";
import QRGeneratorSection from "./Labs/QRGeneratorSection";
import LibrarySeatSection from "./Labs/LibrarySeatSection";
import { sendLabsOpen } from "@/utils/analytics";

interface LabsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const LABS_TABS = ["library", "clock", "qr"] as const;
const LAST_LABS_TAB_STORAGE_KEY = "ui:lastLabsTab:v1";

const LabsDialog = ({ open, onOpenChange }: LabsDialogProps) => {
  const tabs = usePersistentDialogTab({
    open,
    storageKey: LAST_LABS_TAB_STORAGE_KEY,
    values: LABS_TABS,
    defaultValue: "library",
    featureArea: "labs",
  });

  useEffect(() => {
    if (open) void sendLabsOpen();
  }, [open]);

  return (
    <UtilityDialog
      open={open}
      onOpenChange={onOpenChange}
      icon={FlaskConical}
      title="실험실"
      description="새 기능을 먼저 써보세요."
    >
      <Tabs
        value={tabs.value}
        onValueChange={tabs.onValueChange}
        className="w-full"
      >
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="library">도서관 좌석</TabsTrigger>
          <TabsTrigger value="clock">서버 시계</TabsTrigger>
          <TabsTrigger value="qr">QR 생성</TabsTrigger>
        </TabsList>

        <TabsContent value="library" className="mt-4">
          <LibrarySeatSection />
        </TabsContent>

        <TabsContent value="clock" className="mt-4">
          <ServerClockSection />
        </TabsContent>

        <TabsContent value="qr" className="mt-4">
          <QRGeneratorSection />
        </TabsContent>
      </Tabs>
    </UtilityDialog>
  );
};

export default LabsDialog;
