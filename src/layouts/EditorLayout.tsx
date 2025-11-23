/**
 * Editor Layout - Full screen layout for template editor
 */

import { Outlet } from 'react-router-dom';

export const EditorLayout = () => {
  return (
    <div className="h-screen w-screen flex flex-col bg-background overflow-hidden">
      <Outlet />
    </div>
  );
};
