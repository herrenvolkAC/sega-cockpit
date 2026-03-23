"use client";

import React from "react";

interface InfoTooltipProps {
  content: string;
  title?: string;
  /** "bottom" anchors tooltip below the icon, right-aligned (for card corners).
   *  "right" anchors tooltip to the right of the icon (for inline header use). */
  position?: "bottom" | "right";
}

export const InfoTooltip: React.FC<InfoTooltipProps> = ({
  content,
  title,
  position = "bottom",
}) => {
  const tooltipClasses =
    position === "right"
      ? "left-full ml-2 top-1/2 -translate-y-1/2"
      : "right-0 top-full mt-1";

  return (
    <div className="relative inline-block group flex-shrink-0">
      <div className="w-4 h-4 bg-gray-400 dark:bg-gray-500 rounded-full flex items-center justify-center cursor-help hover:bg-gray-500 dark:hover:bg-gray-400 transition-colors">
        <span className="text-white text-[10px] font-bold leading-none select-none">?</span>
      </div>
      <div
        className={`absolute z-50 ${tooltipClasses} w-64 p-2 bg-gray-900 text-white text-xs rounded-lg shadow-lg invisible group-hover:visible opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none`}
      >
        {title && <div className="font-semibold text-sm mb-1">{title}</div>}
        <div className="leading-relaxed">{content}</div>
      </div>
    </div>
  );
};
