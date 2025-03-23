"use client";

import { useState, useEffect } from 'react';

interface LogEntry {
  type: 'info' | 'warn' | 'error';
  message: string;
  timestamp: string;
}

export default function DebugLogger() {
  const [isVisible, setIsVisible] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  
  useEffect(() => {
    // Capture console logs
    const originalConsoleLog = console.log;
    const originalConsoleWarn = console.warn;
    const originalConsoleError = console.error;
    
    console.log = function(...args) {
      const message = args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
      ).join(' ');
      
      setLogs(prev => [...prev, {
        type: 'info',
        message,
        timestamp: new Date().toISOString()
      }]);
      
      originalConsoleLog.apply(console, args);
    };
    
    console.warn = function(...args) {
      const message = args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
      ).join(' ');
      
      setLogs(prev => [...prev, {
        type: 'warn',
        message,
        timestamp: new Date().toISOString()
      }]);
      
      originalConsoleWarn.apply(console, args);
    };
    
    console.error = function(...args) {
      const message = args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
      ).join(' ');
      
      setLogs(prev => [...prev, {
        type: 'error',
        message,
        timestamp: new Date().toISOString()
      }]);
      
      originalConsoleError.apply(console, args);
    };
    
    // Clean up
    return () => {
      console.log = originalConsoleLog;
      console.warn = originalConsoleWarn;
      console.error = originalConsoleError;
    };
  }, []);
  
  if (!isVisible) {
    return (
      <button 
        onClick={() => setIsVisible(true)}
        className="fixed bottom-4 right-4 bg-gray-800 text-white px-4 py-2 rounded-md opacity-70 hover:opacity-100"
      >
        Show Logs
      </button>
    );
  }
  
  return (
    <div className="fixed bottom-0 right-0 w-full md:w-1/2 h-64 bg-gray-900 text-white overflow-y-auto p-4 shadow-lg border-t border-l border-gray-700">
      <div className="flex justify-between mb-2">
        <h3 className="font-bold">Debug Logs</h3>
        <div>
          <button 
            onClick={() => setLogs([])}
            className="mr-2 px-2 py-1 bg-red-600 text-white text-xs rounded"
          >
            Clear
          </button>
          <button 
            onClick={() => setIsVisible(false)}
            className="px-2 py-1 bg-gray-700 text-white text-xs rounded"
          >
            Hide
          </button>
        </div>
      </div>
      
      <div className="text-xs font-mono">
        {logs.map((log, i) => (
          <div 
            key={i} 
            className={`mb-1 ${
              log.type === 'error' 
                ? 'text-red-400' 
                : log.type === 'warn' 
                  ? 'text-yellow-400' 
                  : 'text-green-400'
            }`}
          >
            [{log.timestamp.split('T')[1].split('.')[0]}] {log.message}
          </div>
        ))}
      </div>
    </div>
  );
}
