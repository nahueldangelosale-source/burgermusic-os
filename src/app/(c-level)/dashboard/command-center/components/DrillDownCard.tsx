"use client";
import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import Link from "next/link";

interface DrillDownCardProps {
  title: string;
  icon: React.ReactNode;
  iconColorClass: string;
  summaryText: string | React.ReactNode;
  linkUrl?: string;
  children: React.ReactNode;
}

export function DrillDownCard({ 
  title, 
  icon, 
  iconColorClass, 
  summaryText, 
  linkUrl,
  children 
}: DrillDownCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col transition-all duration-200 hover:shadow-md hover:border-slate-300">
      <div 
        className="p-5 sm:p-6 cursor-pointer flex justify-between items-center group bg-white"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-4">
          <div className={`p-3 rounded-xl ${iconColorClass} shadow-sm border border-white/50`}>
            {icon}
          </div>
          <div>
            <h3 className="font-semibold text-slate-800 tracking-tight text-base">{title}</h3>
            <div className="text-sm text-slate-500 font-medium">{summaryText}</div>
          </div>
        </div>
        <div className={`p-2 rounded-full transition-colors ${isExpanded ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-50 text-slate-400 group-hover:bg-slate-100 group-hover:text-slate-600'}`}>
          {isExpanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
        </div>
      </div>
      
      {/* Sección Expandible */}
      <div 
        className={`transition-all duration-300 ease-in-out origin-top border-t border-slate-100 bg-slate-50/50 ${isExpanded ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0 overflow-hidden'}`}
      >
        <div className="p-5 sm:p-6 pb-2 overflow-y-auto">
          {children}
        </div>
        
        {/* Deep Link Opcional */}
        {linkUrl && (
          <div className="px-5 sm:px-6 pb-5 pt-2">
            <Link 
              href={linkUrl} 
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-4 py-2 rounded-lg transition-colors"
            >
              Consultar Módulo <ChevronRight size={16} />
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
