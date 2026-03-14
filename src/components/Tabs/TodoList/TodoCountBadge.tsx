import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { addStorageChangeListener, getStorage } from "@/utils/chrome";
import {
  TODO_COUNT_REFRESH_EVENT,
  syncTodoCount,
} from "@/utils/todo/count";

const TodoCountBadge = () => {
  const [todoCount, setTodoCount] = useState<number>(0);

  useEffect(() => {
    let isMounted = true;

    const refreshTodoCount = async () => {
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
    void refreshTodoCount();

    const handleStorageChange = (
      changes: Record<string, chrome.storage.StorageChange>,
      namespace: string
    ) => {
      if (namespace === "local" && changes.customTodos) {
        void refreshTodoCount();
        return;
      }

      if (namespace === "local" && changes.todoCount) {
        const count =
          typeof changes.todoCount.newValue === "number"
            ? changes.todoCount.newValue
            : 0;
        setTodoCount(count);
      }
    };

    const handleRefreshRequest = () => {
      void refreshTodoCount();
    };

    window.addEventListener(TODO_COUNT_REFRESH_EVENT, handleRefreshRequest);
    const removeListener = addStorageChangeListener(handleStorageChange);

    return () => {
      isMounted = false;
      window.removeEventListener(TODO_COUNT_REFRESH_EVENT, handleRefreshRequest);
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
