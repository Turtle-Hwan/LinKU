import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { addStorageChangeListener } from "@/utils/chrome";
import {
  formatTodoBadgeCount,
  TODO_BADGE_BACKGROUND_COLOR,
  TODO_BADGE_TEXT_COLOR,
} from "@/utils/todo/badge";
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

  const badgeText = formatTodoBadgeCount(todoCount);

  if (!badgeText) {
    return null;
  }

  return (
    <Badge
      variant="default"
      className="border-none"
      style={{
        backgroundColor: TODO_BADGE_BACKGROUND_COLOR,
        color: TODO_BADGE_TEXT_COLOR,
      }}
    >
      {badgeText}
    </Badge>
  );
};

export default TodoCountBadge;
