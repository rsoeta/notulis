import React from 'react';
import { Loader2 } from 'lucide-react';

export function ButtonSpinner({ className = 'w-4 h-4' }) {
  return <Loader2 className={`${className} animate-spin`} />;
}

export function MeetingCardSkeleton({ count = 3 }) {
  return (
    <div className="flex flex-wrap gap-3">
      {Array.from({ length: count }).map((_, idx) => (
        <div
          key={idx}
          className="flex-1 basis-full sm:basis-[20rem] bg-white border border-slate-200 rounded-2xl p-4 animate-pulse"
        >
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="h-5 w-24 bg-slate-200 rounded-full" />
            <div className="h-4 w-28 bg-slate-100 rounded" />
          </div>
          <div className="h-5 w-4/5 bg-slate-200 rounded mb-2" />
          <div className="h-4 w-3/5 bg-slate-100 rounded mb-4" />
          <div className="flex items-center justify-between pt-3 border-t border-slate-100">
            <div className="h-4 w-32 bg-slate-100 rounded" />
            <div className="h-4 w-20 bg-slate-200 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function MinutesDetailSkeleton() {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-8 animate-pulse space-y-5">
      <div className="flex flex-col items-center gap-2 pb-5 border-b-2 border-slate-200">
        <div className="h-4 w-56 bg-slate-200 rounded" />
        <div className="h-5 w-48 bg-slate-200 rounded" />
        <div className="h-3 w-64 bg-slate-100 rounded" />
      </div>
      <div className="flex flex-col items-center gap-2 py-2">
        <div className="h-5 w-52 bg-slate-200 rounded" />
        <div className="h-3 w-40 bg-slate-100 rounded" />
      </div>
      <div className="space-y-2.5">
        <div className="h-4 w-44 bg-slate-200 rounded" />
        <div className="h-3.5 w-full bg-slate-100 rounded" />
        <div className="h-3.5 w-5/6 bg-slate-100 rounded" />
        <div className="h-3.5 w-4/6 bg-slate-100 rounded" />
      </div>
      <div className="space-y-2.5 pt-2">
        <div className="h-4 w-36 bg-slate-200 rounded" />
        <div className="h-16 w-full bg-slate-100 rounded-xl" />
      </div>
    </div>
  );
}
