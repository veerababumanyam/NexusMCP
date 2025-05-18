import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Download, Users, Package, Star, ChevronRight } from 'lucide-react';
import { Link } from 'wouter';

interface StatsItem {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  link?: string;
}

interface MarketplaceStatsProps {
  stats: {
    totalConnectors: number;
    totalCategories: number;
    totalPublishers: number;
    totalInstallations: number;
    topRated?: Array<{
      id: number;
      name: string;
      slug: string;
      rating: number;
    }>;
    mostDownloaded?: Array<{
      id: number;
      name: string;
      slug: string;
      downloadCount: number;
    }>;
  };
}

export function MarketplaceStats({ stats }: MarketplaceStatsProps) {
  const statsItems: StatsItem[] = [
    {
      label: 'Total Connectors',
      value: stats.totalConnectors,
      icon: <Package className="h-5 w-5 text-blue-500" />,
      link: '/marketplace'
    },
    {
      label: 'Categories',
      value: stats.totalCategories,
      icon: <Package className="h-5 w-5 text-indigo-500" />,
      link: '/marketplace/categories'
    },
    {
      label: 'Publishers',
      value: stats.totalPublishers,
      icon: <Users className="h-5 w-5 text-green-500" />,
      link: '/marketplace/publishers'
    },
    {
      label: 'Total Installations',
      value: stats.totalInstallations,
      icon: <Download className="h-5 w-5 text-orange-500" />,
    }
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mt-6">
      {statsItems.map((item, i) => (
        <Card key={i} className="overflow-hidden">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium leading-none text-muted-foreground">
                  {item.label}
                </p>
                <p className="text-2xl font-bold">{item.value}</p>
              </div>
              <div className="rounded-full p-2 bg-muted">
                {item.icon}
              </div>
            </div>
            
            {item.link && (
              <Link href={item.link} className="text-sm font-medium text-blue-600 mt-4 flex items-center hover:underline">
                View all
                <ChevronRight className="h-4 w-4 ml-1" />
              </Link>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}