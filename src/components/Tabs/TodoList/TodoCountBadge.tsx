import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { addStorageChangeListener, getStorage } from "@/utils/chrome";

const TodoCountBadge = () => {
  const [todoCount, setTodoCount] = useState<number>(0);

  useEffect(() => {
    const loadTodoCount = async () => {
      const count = await getStorage<number>("todoCount");
      if (count !== undefined) {
        setTodoCount(count);
      }
    };
    loadTodoCount();

    // Listen for changes to todoCount in storage
    const handleStorageChange = (
      changes: Record<string, chrome.storage.StorageChange>,
      namespace: string
    ) => {
      if (namespace === "local" && changes.todoCount) {
        setTodoCount(changes.todoCount.newValue);
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
