'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

// Component that safely uses useSearchParams inside a Suspense boundary
function ErrorContent() {
  const searchParams = useSearchParams();
  const errorMessage = searchParams.get('message') || 'An error occurred';
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded-lg shadow-md max-w-md w-full">
        <h1 className="text-2xl font-bold text-red-600 mb-4">Error</h1>
        <p className="text-gray-700 mb-6">{errorMessage}</p>
        <a
          href="/"
          className="inline-block bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 transition-colors"
        >
          Return Home
        </a>
      </div>
    </div>
  );
}

// Main error page component with Suspense boundary
export default function ErrorPage() {
  return (
    <Suspense fallback={<div>Loading error information...</div>}>
      <ErrorContent />
    </Suspense>
  );
}