import { useTodoListData } from "@/hooks/useTodoListData";
import TodoItem from "./TodoItem";
import TodoControlBar from "./TodoControlBar";
import LoginDialog from "./LoginDialog";
import KUGoodjob from "@/assets/KU_goodjob.png";

const TodoList = () => {
  const {
    allTodos,
    error,
    filterMode,
    handleDeleteTodo,
    handleLoginSuccess,
    handleTodoAdded,
    handleTodoItemClick,
    handleToggleTodo,
    isLoading,
    setError,
    setIsLoading,
    showLoginModal,
    setShowLoginModal,
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
      <LoginDialog
        isOpen={showLoginModal}
        onOpenChange={setShowLoginModal}
        onLoginSuccess={handleLoginSuccess}
        isLoading={isLoading}
        setIsLoading={setIsLoading}
        error={error}
        setError={setError}
      />

      {isLoading ? (
        <div className="flex justify-center p-8">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
        </div>
      ) : error ? (
        <div className="flex justify-center items-center py-8">
          <p className="text-sm text-red-600">{error}</p>
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
                    ? () => handleTodoItemClick(item.kj, item.seq, item.gubun)
                    : undefined
                }
              />
            ))
          ) : (
            <div className="text-base text-center text-muted-foreground space-y-4">
              <p>할 일이 없습니다</p>
              <img src={KUGoodjob} alt="KU Good job" className="w-32 h-32 mx-auto" />
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default TodoList;
