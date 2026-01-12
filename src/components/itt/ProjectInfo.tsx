// src/components/itt/ProjectInfo.tsx
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Building, MapPin, Calendar } from 'lucide-react';

interface Project {
  projectId: string;
  projectName: string;
  governorates: string[];
  districts: string[];
  subDistricts: string[];
  startDateMonth: string;
  startDateYear: string;
  endDateMonth: string;
  endDateYear: string;
}

export function ProjectInfo({ project }: { project: Project }) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>{project.projectName}</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                <InfoItem icon={<Building className="h-5 w-5" />} label="Project ID" value={project.projectId} />
                <InfoItem icon={<MapPin className="h-5 w-5" />} label="Location" value={`${project.governorates.join(', ')} > ${project.districts.join(', ')} > ${project.subDistricts.join(', ')}`} />
                <InfoItem icon={<Calendar className="h-5 w-5" />} label="Start Date" value={`${project.startDateMonth}/${project.startDateYear}`} />
                <InfoItem icon={<Calendar className="h-5 w-5" />} label="End Date" value={`${project.endDateMonth}/${project.endDateYear}`} />
            </CardContent>
        </Card>
    );
}

const InfoItem = ({ icon, label, value }: { icon: React.ReactNode, label: string, value: string }) => (
    <div className="flex items-start gap-3">
        <div className="text-primary pt-1">{icon}</div>
        <div>
            <p className="font-semibold text-muted-foreground">{label}</p>
            <p>{value}</p>
        </div>
    </div>
);
