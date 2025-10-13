import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import TodoAddDialog from "./TodoAddDialog";

interface TodoAddButtonProps {
  onSuccess: () => void;
  eCampusSubjects?: string[];
}

const TodoAddButton = ({ onSuccess, eCampusSubjects = [] }: TodoAddButtonProps) => {
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <>
      <Button
        onClick={() => setDialogOpen(true)}
        size="sm"
        className="gap-1.5"
      >
        <Plus className="h-4 w-4" />
        Add Todo
      </Button>

      <TodoAddDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSuccess={onSuccess}
        eCampusSubjects={eCampusSubjects}
      />
    </>
  );
};

export default TodoAddButton;
