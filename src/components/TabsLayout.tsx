import React from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import LinkGroup from "./Tabs/LinkGroup";
import TodoList from "./Tabs/TodoList/TodoList";
import TodoCountBadge from "./Tabs/TodoList/TodoCountBadge";
import Alerts from "./Tabs/Alerts/Alerts";
import { sendTabChange } from "@/utils/analytics";
import { useSelectedTemplate } from "@/hooks/useSelectedTemplate";

const TabsLayout = () => {
  const { linkItems, isLoading, error } = useSelectedTemplate();

  const handleTabChange = (value: string) => {
    const tabNames = {
      LinkGroup: "링크모음",
      TimeTable: "시간표",
      TodoList: "Todo List",
      Alerts: "공지사항"
    };
    sendTabChange(tabNames[value] || value);
  };

  return (
    <Tabs defaultValue="LinkGroup" className="w-full" onValueChange={handleTabChange}>
      <div className="px-3">
        <TabsList className="w-full">
          <TabsTrigger value="LinkGroup">링크모음</TabsTrigger>
          <TabsTrigger value="Alerts">공지사항</TabsTrigger>
          <TabsTrigger value="TimeTable">시간표</TabsTrigger>
          <TabsTrigger value="TodoList">
            <span>Todo List</span>
            <TodoCountBadge />
          </TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value="LinkGroup">
        {isLoading ? (
          <div className="flex items-center justify-center p-8 border-t">
            <p className="text-sm text-muted-foreground">템플릿 로딩 중...</p>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center p-8 border-t">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        ) : (
          <LinkGroup items={linkItems} />
        )}
      </TabsContent>
      <TabsContent value="TimeTable">
        <div className="size-full border-t text-center">
          시간표는 준비 중입니다
        </div>
      </TabsContent>
      <TabsContent value="TodoList">
        <TodoList />
      </TabsContent>
      <TabsContent value="Alerts">
        <Alerts />
      </TabsContent>
    </Tabs>
  );
};

export default React.memo(TabsLayout);
