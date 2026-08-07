interface PageHeadingProps {
  eyebrow: string;
  title: string;
  body: string;
  align?: "left" | "center";
}

export function PageHeading({
  eyebrow,
  title,
  body,
  align = "left",
}: PageHeadingProps) {
  const centered = align === "center";

  return (
    <div
      className={`border-b pb-4 ${
        centered ? "mx-auto max-w-4xl text-center" : "max-w-4xl"
      }`}
    >
      <p className="text-sm font-medium text-main">{eyebrow}</p>
      <h1
        data-display="true"
        className="mt-2 text-2xl leading-tight tracking-tight sm:text-3xl"
      >
        {title}
      </h1>
      <p
        className={`mt-2 text-sm leading-6 text-muted-foreground sm:text-base ${
          centered ? "mx-auto max-w-2xl" : "max-w-3xl"
        }`}
      >
        {body}
      </p>
    </div>
  );
}
