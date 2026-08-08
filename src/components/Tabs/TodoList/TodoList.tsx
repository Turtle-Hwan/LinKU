import { LogIn } from "lucide-react";

import KUGoodjob from "@/assets/KU_goodjob.png";
import { Button } from "@/components/ui/button";
import { useTodoListData } from "@/hooks/useTodoListData";

import LoginDialog from "./LoginDialog";
import TodoControlBar from "./TodoControlBar";
import TodoItem from "./TodoItem";

const TodoList = () => {
  const {
    allTodos,
    ecampusError,
    ecampusNeedsLogin,
    filterMode,
    handleDeleteTodo,
    handleOpenECampusLogin,
    handleTodoAdded,
    handleTodoItemClick,
    handleToggleTodo,
    isECampusLoading,
    isLoading,
    loginDialogProps,
    sortMethod,
    timerEnabled,
    toggleFilterMode,
    toggleSortMethod,
  } = useTodoListData();

  return (
    <div
      id="todolist"
      className="p-4 border-t overflow-y-auto h-[500px]"
      style={{ scrollbarWidth: "thin" }}
    >
      <LoginDialog {...loginDialogProps} />

      {isLoading ? (
        <div className="flex justify-center p-8">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
        </div>
      ) : (
        <div className="space-y-4">
          <TodoControlBar
            sortMethod={sortMethod}
            filterMode={filterMode}
            todoItems={allTodos}
            onSortMethodChange={toggleSortMethod}
            onFilterModeChange={toggleFilterMode}
            onTodoAdded={handleTodoAdded}
          />

          {ecampusNeedsLogin ? (
            <div className="flex items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
              <div className="space-y-1">
                <p className="text-sm font-medium text-amber-900">
                  eCampus Todo를 보려면 로그인이 필요합니다.
                </p>
                <p className="text-xs text-amber-800">
                  custom Todo는 계속 사용할 수 있고, 필요할 때만 eCampus를
                  연결하면 됩니다.
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="border-amber-300 bg-white text-amber-900 hover:bg-amber-100"
                onClick={handleOpenECampusLogin}
              >
                <LogIn className="mr-2 h-4 w-4" />
                eCampus 로그인
              </Button>
            </div>
          ) : null}

          {!ecampusNeedsLogin && ecampusError ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3">
              <p className="text-sm font-medium text-red-700">
                {ecampusError}
              </p>
              <p className="mt-1 text-xs text-red-600">
                custom Todo는 계속 사용할 수 있습니다.
              </p>
            </div>
          ) : null}

          {isECampusLoading ? (
            <div className="rounded-lg border border-muted bg-muted/40 p-3">
              <p className="text-sm text-muted-foreground">
                eCampus Todo를 불러오는 중입니다.
              </p>
            </div>
          ) : null}

          {allTodos.length > 0 ? (
            allTodos.map((item) => (
              <TodoItem
                key={item.id}
                todo={item}
                timerEnabled={timerEnabled}
                onToggle={item.type === "custom" ? handleToggleTodo : undefined}
                onDelete={item.type === "custom" ? handleDeleteTodo : undefined}
                onClick={
                  item.type === "ecampus"
                    ? () =>
                        handleTodoItemClick(item.kj, item.seq, item.gubun)
                    : undefined
                }
              />
            ))
          ) : !isECampusLoading ? (
            <div className="text-base text-center text-muted-foreground space-y-4">
              <p>할 일이 없습니다</p>
              <img
                src={KUGoodjob}
                alt="KU Good job"
                className="w-32 h-32 mx-auto"
              />
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
};

export default TodoList;
