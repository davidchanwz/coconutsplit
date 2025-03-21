'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

// Component that safely uses useSearchParams inside a Suspense boundary
function ErrorContent() {
  const searchParams = useSearchParams();
  const errorMessage = searchParams.get('message') || 'An error occurred';
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900">
      <div className="bg-gray-800 p-8 rounded-lg shadow-md max-w-md w-full border border-gray-700">
        <h1 className="text-2xl font-bold text-red-400 mb-4">Error</h1>
        <p className="text-gray-300 mb-6">{errorMessage}</p>
        <a
          href="/"
          className="inline-block bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors"
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
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-gray-900 text-gray-300">Loading error information...</div>}>
      <ErrorContent />
    </Suspense>
  );
}