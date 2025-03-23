import React from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import LinkGroup from "./LinkGroup";

const TabsLayout = () => {
  return (
    <Tabs defaultValue="LinkGroup" className="w-full">
      <TabsList className="grid w-full grid-cols-3 px-3">
        <TabsTrigger value="LinkGroup">링크모음</TabsTrigger>
        <TabsTrigger value="TimeTable">시간표</TabsTrigger>
        <TabsTrigger value="TodoList">Todo List</TabsTrigger>
      </TabsList>

      <TabsContent value="LinkGroup">
        <LinkGroup />
      </TabsContent>
      <TabsContent value="TimeTable">
        <div>시간표</div>
      </TabsContent>
      <TabsContent value="TodoList">
        <div>Todo List</div>
      </TabsContent>
    </Tabs>
  );
};

export default React.memo(TabsLayout);
