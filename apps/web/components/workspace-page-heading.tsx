interface WorkspacePageHeadingProps {
  eyebrow: string;
  title: string;
  description: string;
}

export function WorkspacePageHeading({
  eyebrow,
  title,
  description,
}: WorkspacePageHeadingProps) {
  return (
    <div className="flex max-w-3xl flex-col items-start gap-2 border-b pb-4">
      <p className="text-sm font-medium text-main">{eyebrow}</p>
      <h1 data-display="true" className="text-2xl leading-tight tracking-tight">
        {title}
      </h1>
      <p className="text-sm leading-6 text-muted-foreground">
        {description}
      </p>
    </div>
  );
}
