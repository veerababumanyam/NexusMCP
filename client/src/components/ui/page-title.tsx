import React from "react";
import { cn } from "@/lib/utils";

interface PageTitleProps {
  title: string;
  description?: string;
  className?: string;
  descriptionClassName?: string;
  titleClassName?: string;
}

export function PageTitle({
  title,
  description,
  className,
  titleClassName,
  descriptionClassName,
}: PageTitleProps) {
  return (
    <div className={cn("space-y-1", className)}>
      <h1 className={cn("text-3xl font-bold tracking-tight", titleClassName)}>
        {title}
      </h1>
      {description && (
        <p className={cn("text-muted-foreground", descriptionClassName)}>
          {description}
        </p>
      )}
    </div>
  );
}