import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { addStorageChangeListener, getStorage } from "@/utils/chrome";
import { syncTodoCount } from "@/utils/todo/count";

const TodoCountBadge = () => {
  const [todoCount, setTodoCount] = useState<number>(0);

  useEffect(() => {
    let isMounted = true;

    const initializeTodoCount = async () => {
      const syncedCount = await syncTodoCount();
      if (!isMounted) {
        return;
      }

      if (syncedCount !== undefined) {
        setTodoCount(syncedCount);
        return;
      }

      const storedCount = await getStorage<number>("todoCount");
      if (isMounted && storedCount !== undefined) {
        setTodoCount(storedCount);
      }
    };
    initializeTodoCount();

    // Listen for changes to todoCount in storage
    const handleStorageChange = (
      changes: Record<string, chrome.storage.StorageChange>,
      namespace: string
    ) => {
      if (namespace === "local" && changes.todoCount) {
        setTodoCount(changes.todoCount.newValue);
      }
    };

    const removeListener = addStorageChangeListener(handleStorageChange);

    return () => {
      isMounted = false;
      removeListener();
    };
  }, []);

  if (todoCount === 0) return null;

  return (
    <Badge variant="default" className="bg-main text-white border-none">
      {todoCount}
    </Badge>
  );
};

export default TodoCountBadge;
