import { lazy } from 'react';

// Lazy load components for better performance
const LazyMessagingPage = lazy(() => import('./messaging-page'));
const LazyFileStoragePage = lazy(() => import('./file-storage'));
const LazyDataStoragePage = lazy(() => import('./data-storage-page'));
const LazySmtpPage = lazy(() => import('./smtp-page'));

export {
  LazyMessagingPage,
  LazyFileStoragePage,
  LazyDataStoragePage,
  LazySmtpPage
};