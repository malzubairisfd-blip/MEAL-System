// src/components/itt/ImpactCards.tsx
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, User, UserCheck } from 'lucide-react';

const KPICard = ({ title, value, icon }: { title: string, value: string | number, icon: React.ReactNode }) => (
    <Card className="transition-all hover:shadow-md hover:-translate-y-1">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{title}</CardTitle>
            {icon}
        </CardHeader>
        <CardContent>
            <div className="text-2xl font-bold">{value}</div>
        </CardContent>
    </Card>
);

export function ImpactCards() {
    // Placeholder data as source is not specified
    const data = {
        beneficiaries: "2,634",
        communityEducators: 20,
        fieldCoordinators: 2,
        healthWorkers: 10,
        womanConsultants: 5,
        menConsultants: 3
    };

    return (
        <div className="space-y-4">
            <h3 className="text-lg font-semibold">People Reached</h3>
            <div className="grid gap-4 md:grid-cols-1">
                <KPICard title="Beneficiaries" value={data.beneficiaries} icon={<Users className="text-blue-500" />} />
            </div>

            <h3 className="text-lg font-semibold">Project Staff</h3>
             <div className="grid gap-4 md:grid-cols-3">
                <KPICard title="Community Educators" value={data.communityEducators} icon={<UserCheck className="text-green-500" />} />
                <KPICard title="Field Coordinator" value={data.fieldCoordinators} icon={<UserCheck className="text-green-500" />} />
                <KPICard title="Health Workers" value={data.healthWorkers} icon={<UserCheck className="text-green-500" />} />
            </div>

             <h3 className="text-lg font-semibold">Consultants</h3>
             <div className="grid gap-4 md:grid-cols-2">
                <KPICard title="Woman" value={data.womanConsultants} icon={<User className="text-purple-500" />} />
                <KPICard title="Men" value={data.menConsultants} icon={<User className="text-purple-500" />} />
            </div>
        </div>
    );
}
