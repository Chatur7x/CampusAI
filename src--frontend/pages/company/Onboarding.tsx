import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useTheme } from '@/themes';
import {
  UserPlus, Search, Upload, FileText, CheckCircle,
  Clock, ArrowRight
} from 'lucide-react';
import { toast } from 'sonner';

const onboardingSteps = [
  { id: 1, name: 'Document Verification', status: 'completed', count: 45 },
  { id: 2, name: 'Profile Setup', status: 'completed', count: 42 },
  { id: 3, name: 'Training Modules', status: 'in-progress', count: 38 },
  { id: 4, name: 'Team Introduction', status: 'pending', count: 35 },
  { id: 5, name: 'First Project Assignment', status: 'pending', count: 30 },
];

const pendingOnboarding = [
  { id: 1, name: 'John Davis', role: 'Software Engineer', department: 'Engineering', step: 'Training Modules', progress: 75 },
  { id: 2, name: 'Sarah Miller', role: 'Product Manager', department: 'Product', step: 'Profile Setup', progress: 50 },
  { id: 3, name: 'Mike Brown', role: 'Designer', department: 'Design', step: 'Document Verification', progress: 25 },
  { id: 4, name: 'Emily Wilson', role: 'Data Analyst', department: 'Analytics', step: 'Training Modules', progress: 60 },
];

export default function CompanyOnboarding() {
  const { theme } = useTheme();
  const [searchQuery, setSearchQuery] = useState('');

  const handleAddNewHire = () => {
    toast.info('Opening new hire onboarding wizard...');
  };

  const handleViewEmployee = (employee: typeof pendingOnboarding[0]) => {
    toast.info(`Viewing ${employee.name}'s onboarding progress`);
  };

  const handleBrowseFiles = () => {
    toast.info('Opening file browser...');
  };

  const handleUploadDoc = (docName: string) => {
    toast.success(`Uploading ${docName}...`);
    setTimeout(() => {
      toast.success(`${docName} uploaded successfully`);
    }, 2000);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className={`text-3xl font-bold ${theme === 'glassmorphism' ? 'text-white' : 'text-slate-800'}`}>
            Employee Onboarding
          </h1>
          <p className={`mt-1 ${theme === 'glassmorphism' ? 'text-white/60' : 'text-slate-500'}`}>
            Manage new employee onboarding process
          </p>
        </div>
        <Button 
          className={theme === 'glassmorphism' ? 'glass-button-primary' : 'neu-button-primary'}
          onClick={handleAddNewHire}
        >
          <UserPlus className="w-4 h-4 mr-2" />
          Add New Hire
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className={theme === 'glassmorphism' ? 'glass-card' : 'neu-card'}>
          <CardContent className="p-4 text-center">
            <p className={`text-2xl font-bold ${theme === 'glassmorphism' ? 'text-white' : 'text-slate-800'}`}>45</p>
            <p className={`text-sm ${theme === 'glassmorphism' ? 'text-white/50' : 'text-slate-500'}`}>Total Onboarded</p>
          </CardContent>
        </Card>
        <Card className={theme === 'glassmorphism' ? 'glass-card' : 'neu-card'}>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-emerald-400">38</p>
            <p className={`text-sm ${theme === 'glassmorphism' ? 'text-white/50' : 'text-slate-500'}`}>In Progress</p>
          </CardContent>
        </Card>
        <Card className={theme === 'glassmorphism' ? 'glass-card' : 'neu-card'}>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-amber-400">4</p>
            <p className={`text-sm ${theme === 'glassmorphism' ? 'text-white/50' : 'text-slate-500'}`}>Pending Review</p>
          </CardContent>
        </Card>
        <Card className={theme === 'glassmorphism' ? 'glass-card' : 'neu-card'}>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-violet-400">3</p>
            <p className={`text-sm ${theme === 'glassmorphism' ? 'text-white/50' : 'text-slate-500'}`}>Avg Days to Complete</p>
          </CardContent>
        </Card>
      </div>

      <Card className={theme === 'glassmorphism' ? 'glass-card' : 'neu-card'}>
        <CardContent className="p-6">
          <h3 className={`text-lg font-semibold mb-4 ${theme === 'glassmorphism' ? 'text-white' : 'text-slate-800'}`}>
            Onboarding Pipeline
          </h3>
          <div className="flex items-center justify-between">
            {onboardingSteps.map((step, index) => (
              <div key={step.id} className="flex items-center">
                <div className="text-center">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-2 ${
                    step.status === 'completed' 
                      ? 'bg-emerald-500' 
                      : step.status === 'in-progress'
                        ? 'bg-violet-500 animate-pulse'
                        : 'bg-white/10'
                  }`}>
                    {step.status === 'completed' ? (
                      <CheckCircle className="w-6 h-6 text-white" />
                    ) : step.status === 'in-progress' ? (
                      <Clock className="w-6 h-6 text-white" />
                    ) : (
                      <span className="text-white font-bold">{index + 1}</span>
                    )}
                  </div>
                  <p className={`text-sm font-medium ${theme === 'glassmorphism' ? 'text-white' : 'text-slate-800'}`}>
                    {step.name}
                  </p>
                  <p className={`text-xs ${theme === 'glassmorphism' ? 'text-white/50' : 'text-slate-500'}`}>
                    {step.count} employees
                  </p>
                </div>
                {index < onboardingSteps.length - 1 && (
                  <ArrowRight className={`w-6 h-6 mx-4 ${
                    theme === 'glassmorphism' ? 'text-white/30' : 'text-slate-300'
                  }`} />
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className={theme === 'glassmorphism' ? 'glass-card' : 'neu-card'}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className={`text-lg font-semibold ${theme === 'glassmorphism' ? 'text-white' : 'text-slate-800'}`}>
              Pending Onboarding
            </h3>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/50" />
              <Input
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`pl-10 w-64 ${theme === 'glassmorphism' ? 'glass-input' : 'neu-input'}`}
              />
            </div>
          </div>
          <div className="space-y-4">
            {pendingOnboarding.map((employee) => (
              <div key={employee.id} className="flex items-center justify-between p-4 rounded-xl bg-white/5">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-violet-500 to-purple-500 flex items-center justify-center font-bold text-white">
                    {employee.name.split(' ').map(n => n[0]).join('')}
                  </div>
                  <div>
                    <p className={`font-medium ${theme === 'glassmorphism' ? 'text-white' : 'text-slate-800'}`}>
                      {employee.name}
                    </p>
                    <div className="flex items-center gap-2 text-sm">
                      <Badge className={theme === 'glassmorphism' ? 'bg-white/10 text-white/70' : 'bg-slate-100 text-slate-600'}>
                        {employee.role}
                      </Badge>
                      <span className={theme === 'glassmorphism' ? 'text-white/50' : 'text-slate-500'}>
                        {employee.department}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <p className={`text-sm ${theme === 'glassmorphism' ? 'text-white/70' : 'text-slate-600'}`}>
                      {employee.step}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="w-24 h-2 bg-white/10 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-violet-500 to-purple-500 rounded-full"
                          style={{ width: `${employee.progress}%` }}
                        />
                      </div>
                      <span className={`text-xs ${theme === 'glassmorphism' ? 'text-white/50' : 'text-slate-500'}`}>
                        {employee.progress}%
                      </span>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" className="text-white/50 hover:text-white" onClick={() => handleViewEmployee(employee)}>
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className={theme === 'glassmorphism' ? 'glass-card' : 'neu-card'}>
          <CardContent className="p-6">
            <h3 className={`text-lg font-semibold mb-4 ${theme === 'glassmorphism' ? 'text-white' : 'text-slate-800'}`}>
              Upload Documents
            </h3>
            <div className={`border-2 border-dashed rounded-xl p-8 text-center ${
              theme === 'glassmorphism' ? 'border-white/20' : 'border-slate-300'
            }`}>
              <Upload className={`w-12 h-12 mx-auto mb-4 ${theme === 'glassmorphism' ? 'text-white/50' : 'text-slate-400'}`} />
              <p className={`mb-2 ${theme === 'glassmorphism' ? 'text-white/70' : 'text-slate-600'}`}>
                Drag and drop files here, or click to browse
              </p>
              <p className={`text-sm ${theme === 'glassmorphism' ? 'text-white/50' : 'text-slate-500'}`}>
                Supports PDF, DOC, JPG up to 10MB
              </p>
              <Button variant="outline" className={`mt-4 ${theme === 'glassmorphism' ? 'glass-button-ghost' : 'neu-button'}`} onClick={handleBrowseFiles}>
                Browse Files
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className={theme === 'glassmorphism' ? 'glass-card' : 'neu-card'}>
          <CardContent className="p-6">
            <h3 className={`text-lg font-semibold mb-4 ${theme === 'glassmorphism' ? 'text-white' : 'text-slate-800'}`}>
              Required Documents
            </h3>
            <div className="space-y-3">
              {[
                { name: 'ID Proof', required: true },
                { name: 'Address Proof', required: true },
                { name: 'Educational Certificates', required: true },
                { name: 'Previous Employment LOR', required: false },
                { name: 'Profile Photo', required: true },
                { name: 'Bank Details', required: true },
              ].map((doc, index) => (
                <div key={index} className="flex items-center justify-between p-3 rounded-lg bg-white/5">
                  <div className="flex items-center gap-3">
                    <FileText className={`w-5 h-5 ${theme === 'glassmorphism' ? 'text-white/50' : 'text-slate-400'}`} />
                    <span className={theme === 'glassmorphism' ? 'text-white/70' : 'text-slate-600'}>
                      {doc.name}
                    </span>
                    {doc.required && (
                      <Badge className="bg-red-500/20 text-red-400 text-xs">Required</Badge>
                    )}
                  </div>
<Button variant="ghost" size="sm" className="text-white/50 hover:text-white" onClick={() => handleUploadDoc(doc.name)}>
                      Upload
                    </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
