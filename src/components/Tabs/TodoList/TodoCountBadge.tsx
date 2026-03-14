import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { addStorageChangeListener, getStorage } from "@/utils/chrome";

const TodoCountBadge = () => {
  const [todoCount, setTodoCount] = useState<number>(0);

  useEffect(() => {
    void getStorage<number>("todoCount").then((count) => {
      setTodoCount(typeof count === "number" ? count : 0);
    });

    // Listen for changes to todoCount in storage
    const handleStorageChange = (
      changes: Record<string, chrome.storage.StorageChange>,
      namespace: string
    ) => {
      if (namespace === "local" && changes.todoCount) {
        const count =
          typeof changes.todoCount.newValue === "number"
            ? changes.todoCount.newValue
            : 0;
        setTodoCount(count);
      }
    };

    return addStorageChangeListener(handleStorageChange);
  }, []);

  if (todoCount === 0) return null;

  return (
    <Badge variant="default" className="bg-main text-white border-none">
      {todoCount}
    </Badge>
  );
};

export default TodoCountBadge;
