
"use client";
import { Card, CardContent } from "@/components/ui/card";
import { Home, User, Users, Move } from "lucide-react";

const iconMap = {
  home: <Home className="h-6 w-6 text-white" />,
  male: <User className="h-6 w-6 text-white" />,
  female: <User className="h-6 w-6 text-white" />,
  users: <Users className="h-6 w-6 text-white" />,
  move: <Move className="h-6 w-6 text-white" />,
};

const colorMap: { [key: string]: string } = {
  home: 'bg-sky-500',
  male: 'bg-blue-500',
  female: 'bg-pink-500',
  users: 'bg-indigo-500',
  move: 'bg-orange-500',
  default: 'bg-gray-500'
}


export function BubbleStats({ data }: { data: { label: string; value: number; icon: keyof typeof iconMap }[] }) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex flex-wrap items-center justify-center gap-4">
          {data.map(item => (
            <div key={item.label} className="flex flex-col items-center gap-2">
              <div className={`relative w-24 h-24 rounded-full flex items-center justify-center text-center p-2 ${colorMap[item.icon] || colorMap.default}`}>
                {iconMap[item.icon]}
                <div className="absolute bottom-1 right-1 bg-white text-black text-xs font-bold rounded-full h-6 w-6 flex items-center justify-center">{item.value}</div>
              </div>
              <p className="text-xs font-medium text-center w-24">{item.label}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
