import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { addStorageChangeListener } from "@/utils/chrome";
import { syncTodoCount } from "@/utils/todo/count";

const TodoCountBadge = () => {
  const [todoCount, setTodoCount] = useState(0);

  useEffect(() => {
    let isMounted = true;

    const refreshTodoCount = async () => {
      const count = await syncTodoCount();
      if (isMounted) {
        setTodoCount(count);
      }
    };

    void refreshTodoCount();

    const removeListener = addStorageChangeListener((changes, namespace) => {
      if (namespace !== "local" || !changes.todoCount) {
        return;
      }

      const nextCount = changes.todoCount.newValue;
      setTodoCount(typeof nextCount === "number" ? nextCount : 0);
    });

    return () => {
      isMounted = false;
      removeListener();
    };
  }, []);

  if (todoCount === 0) {
    return null;
  }

  return (
    <Badge variant="default" className="bg-main text-white border-none">
      {todoCount}
    </Badge>
  );
};

export default TodoCountBadge;
