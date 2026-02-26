import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar, Plus } from 'lucide-react';

export default function TimetablePage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Timetable</h1>
          <p className="text-slate-400">Manage class schedules</p>
        </div>
        <Button className="bg-violet-600 hover:bg-violet-700">
          <Plus className="w-4 h-4 mr-2" />
          Add Entry
        </Button>
      </div>

      <Card className="bg-slate-900/50 border-slate-800">
        <CardContent className="p-12 text-center">
          <Calendar className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">Timetable Management</h3>
          <p className="text-slate-400">This feature is coming soon</p>
        </CardContent>
      </Card>
    </div>
  );
}