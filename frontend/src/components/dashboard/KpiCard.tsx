"use client";

interface KpiCardProps {
  title: string;
  value: string | number;
  icon: string;
  color: "green" | "blue" | "yellow" | "red" | "purple";
  trend?: {
    value: number;
    direction: "up" | "down";
  };
}

const getIconColor = (color: string) => {
  const colors = {
    green: "bg-green-100 dark:bg-green-900 text-green-600 dark:text-green-400",
    blue: "bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400", 
    yellow: "bg-yellow-100 dark:bg-yellow-900 text-yellow-600 dark:text-yellow-400",
    red: "bg-red-100 dark:bg-red-900 text-red-600 dark:text-red-400",
    purple: "bg-purple-100 dark:bg-purple-900 text-purple-600 dark:text-purple-400"
  };
  return colors[color as keyof typeof colors] || colors.blue;
};

const getTrendIcon = (direction: "up" | "down") => {
  return direction === "up" ? "📈" : "📉";
};

export function KpiCard({ title, value, icon, color, trend }: KpiCardProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="text-sm text-gray-600 dark:text-gray-400">{title}</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{value}</p>
          {trend && (
            <div className="flex items-center mt-2 text-sm">
              <span className="mr-1">{getTrendIcon(trend.direction)}</span>
              <span className={trend.direction === "up" ? "text-green-600" : "text-red-600"}>
                {trend.value}%
              </span>
            </div>
          )}
        </div>
        <div className={`w-12 h-12 rounded-full flex items-center justify-center text-xl flex-shrink-0 ${getIconColor(color)}`}>
          {icon}
        </div>
      </div>
    </div>
  );
}
