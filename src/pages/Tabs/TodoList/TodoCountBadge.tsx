import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";

const TodoCountBadge = () => {
  const [todoCount, setTodoCount] = useState<number>(0);

  useEffect(() => {
    // Initial load of count from storage
    chrome.storage.local.get("todoCount", (data) => {
      if (data.todoCount !== undefined) {
        setTodoCount(data.todoCount);
      }
    });

    // Listen for changes to todoCount in storage
    const handleStorageChange = (
      changes: Record<string, chrome.storage.StorageChange>,
      namespace: string
    ) => {
      if (namespace === "local" && changes.todoCount) {
        setTodoCount(changes.todoCount.newValue);
      }
    };

    chrome.storage.onChanged.addListener(handleStorageChange);

    return () => {
      chrome.storage.onChanged.removeListener(handleStorageChange);
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
