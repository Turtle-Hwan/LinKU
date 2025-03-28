import React from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import LinkGroup from "./Tabs/LinkGroup";

const TabsLayout = () => {
  return (
    <Tabs defaultValue="LinkGroup" className="w-full">
      <div className="px-3">
        <TabsList className="w-full grid grid-cols-3">
          <TabsTrigger value="LinkGroup">링크모음</TabsTrigger>
          <TabsTrigger value="TimeTable">시간표</TabsTrigger>
          <TabsTrigger value="TodoList">Todo List</TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value="LinkGroup">
        <LinkGroup />
      </TabsContent>
      <TabsContent value="TimeTable">
        <div className="size-full border-t">시간표</div>
      </TabsContent>
      <TabsContent value="TodoList">
        <div className="size-full border-t">Todo List</div>
      </TabsContent>
    </Tabs>
  );
};

export default React.memo(TabsLayout);
