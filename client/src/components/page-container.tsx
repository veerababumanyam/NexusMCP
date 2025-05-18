import React from 'react';

export type PageContainerProps = {
  children: React.ReactNode;
  className?: string;
  title?: string;
  description?: string;
  breadcrumb?: React.ReactNode;
};

export function PageContainer({ 
  children, 
  className = '',
  title,
  description,
  breadcrumb 
}: PageContainerProps) {
  return (
    <div className={`container mx-auto py-6 px-4 md:px-6 ${className}`}>
      {(title || description || breadcrumb) && (
        <div className="mb-6">
          {breadcrumb && <div className="mb-2">{breadcrumb}</div>}
          {title && <h1 className="text-2xl font-bold tracking-tight">{title}</h1>}
          {description && <p className="text-muted-foreground">{description}</p>}
        </div>
      )}
      {children}
    </div>
  );
}