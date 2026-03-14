/**
 * Canvas Grid - Background grid for template editor
 */

interface CanvasGridProps {
  height: number;
}

export const CanvasGrid = ({ height }: CanvasGridProps) => {
  return (
    <div
      className="absolute inset-0 pointer-events-none"
      style={{
        height,
        backgroundImage: `
          linear-gradient(to right, #e5e7eb 1px, transparent 1px),
          linear-gradient(to bottom, #e5e7eb 1px, transparent 1px)
        `,
        backgroundSize: '20px 20px',
      }}
    />
  );
};
