import React from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import LinkGroup from "./Tabs/LinkGroup";
import TodoList from "./Tabs/TodoList/TodoList";
import TodoCountBadge from "./Tabs/TodoList/TodoCountBadge";

const TabsLayout = () => {
  return (
    <Tabs defaultValue="LinkGroup" className="w-full">
      <div className="px-3">
        <TabsList className="w-full grid grid-cols-3">
          <TabsTrigger value="LinkGroup">링크모음</TabsTrigger>
          <TabsTrigger value="TimeTable">시간표</TabsTrigger>
          <TabsTrigger value="TodoList">
            <span>Todo List</span>
            <TodoCountBadge />
          </TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value="LinkGroup">
        <LinkGroup />
      </TabsContent>
      <TabsContent value="TimeTable">
        <div className="size-full border-t text-center">
          시간표는 준비 중입니다
        </div>
      </TabsContent>
      <TabsContent value="TodoList">
        <TodoList />
      </TabsContent>
    </Tabs>
  );
};

export default React.memo(TabsLayout);
