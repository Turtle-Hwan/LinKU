/**
 * Selection Box - Visual indicator for selected item
 * This is a simple implementation that shows selection feedback
 */

interface SelectionBoxProps {
  isVisible: boolean;
}

export const SelectionBox = ({ isVisible }: SelectionBoxProps) => {
  if (!isVisible) return null;

  return (
    <div className="absolute inset-0 border-2 border-primary border-dashed rounded-lg pointer-events-none animate-pulse" />
  );
};
