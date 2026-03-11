import { useState, useRef, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search, Plus, Edit, Trash2, User, Upload, Download, GraduationCap, Building2 } from 'lucide-react';
import { toast } from 'sonner';
import type { Faculty, Department, Profile } from '@/lib/database.types';
import { facultyService, departmentService, auditLogService } from '@/lib/api';
import { supabase } from '@/lib/supabase';

type FacultyWithRelations = Faculty & { profile?: Profile | null; department?: Department | null };

export default function FacultyPage() {
  const queryClient = useQueryClient();
  const parentRef = useRef<HTMLDivElement>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedFaculty, setSelectedFaculty] = useState<FacultyWithRelations | null>(null);
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    employeeId: '',
    designation: 'Assistant Professor',
    departmentId: '',
    joiningDate: new Date().toISOString().split('T')[0],
    specialization: '',
  });

  // ── Queries ──
  const { data: faculty = [] as FacultyWithRelations[], isLoading: isLoadingFaculty } = useQuery({
    queryKey: ['faculty'],
    queryFn: async () => {
      const data = await facultyService.getAll();
      return data as FacultyWithRelations[];
    },
  });

  const { data: departments = [] as Department[] } = useQuery({
    queryKey: ['departments'],
    queryFn: () => departmentService.getAll(),
  });

  const isLoading = isLoadingFaculty;

  // ── Mutations ──
  const addMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('bulk-operations', {
        body: {
          operation: 'import_faculty',
          data: [{
            email: form.email.trim(),
            firstName: form.firstName.trim(),
            lastName: form.lastName.trim() || 'Faculty',
            employeeId: form.employeeId.trim(),
            departmentId: form.departmentId,
            designation: form.designation,
            joiningDate: form.joiningDate,
            specialization: form.specialization || undefined,
          }],
          options: { skipDuplicates: true },
        },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.message || 'Failed to add faculty');
      return data;
    },
    onSuccess: () => {
      toast.success('Faculty member added successfully');
      auditLogService.log('CREATE', 'faculty', '', { newValues: { email: form.email, employeeId: form.employeeId } });
      queryClient.invalidateQueries({ queryKey: ['faculty'] });
      setIsAddOpen(false);
      resetForm();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to add faculty'),
  });

  const updateMutation = useMutation({
    mutationFn: async (id: string) => {
      return facultyService.update(id, {
        employee_id: form.employeeId,
        designation: form.designation,
        department_id: form.departmentId,
        joining_date: form.joiningDate,
        specialization: form.specialization,
      });
    },
    onSuccess: (data, id) => {
      toast.success('Faculty updated successfully');
      auditLogService.log('UPDATE', 'faculty', id, { newValues: form });
      queryClient.invalidateQueries({ queryKey: ['faculty'] });
      setIsEditOpen(false);
      resetForm();
    },
    onError: () => toast.error('Failed to update faculty'),
  });

  const deleteMutation = useMutation({
    mutationFn: facultyService.delete,
    onSuccess: (_, id) => {
      toast.success('Faculty member removed');
      auditLogService.log('DELETE', 'faculty', id, {});
      queryClient.invalidateQueries({ queryKey: ['faculty'] });
      setIsDeleteOpen(false);
      setSelectedFaculty(null);
    },
    onError: () => toast.error('Failed to remove faculty'),
  });

  // ── Handlers ──
  const handleAdd = () => {
    if (!form.firstName || !form.email || !form.employeeId || !form.departmentId) {
      toast.error('Fill required fields before adding');
      return;
    }
    addMutation.mutate();
  };

  const handleEdit = () => {
    if (selectedFaculty) updateMutation.mutate(selectedFaculty.id);
  };

  const handleDelete = () => {
    if (selectedFaculty) deleteMutation.mutate(selectedFaculty.id);
  };

  const openEdit = (f: FacultyWithRelations) => {
    setSelectedFaculty(f);
    setForm({
      firstName: f.profile?.first_name || '',
      lastName: f.profile?.last_name || '',
      email: f.profile?.email || '',
      employeeId: f.employee_id,
      designation: f.designation,
      departmentId: f.department_id,
      joiningDate: f.joining_date,
      specialization: f.specialization || '',
    });
    setIsEditOpen(true);
  };

  const resetForm = () => {
    setForm({
      firstName: '', lastName: '', email: '', employeeId: '',
      designation: 'Assistant Professor', departmentId: '',
      joiningDate: new Date().toISOString().split('T')[0], specialization: '',
    });
    setSelectedFaculty(null);
  };

  const filteredFaculty = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return faculty.filter((f) => {
      const employeeId = f.employee_id || '';
      const first = f.profile?.first_name || '';
      const last = f.profile?.last_name || '';
      const email = f.profile?.email || '';
      const designation = f.designation || '';
      return (
        employeeId.toLowerCase().includes(q) ||
        first.toLowerCase().includes(q) ||
        last.toLowerCase().includes(q) ||
        email.toLowerCase().includes(q) ||
        designation.toLowerCase().includes(q)
      );
    });
  }, [faculty, searchQuery]);

  // ── Virtualizer ──
  const rowVirtualizer = useVirtualizer({
    count: filteredFaculty.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 64, // Estimated row height
    overscan: 5,
  });

  const getInitials = (f: Faculty) =>
    (((f as any).profile?.first_name?.[0] || '') + ((f as any).profile?.last_name?.[0] || '')).toUpperCase() || 'F';

  const handleExportCSV = () => {
    try {
      if (filteredFaculty.length === 0) {
        toast.info('No faculty to export');
        return;
      }
      
      const headers = ['First Name', 'Last Name', 'Email', 'Employee ID', 'Designation', 'Department', 'Specialization', 'Joining Date'];
      const rows = filteredFaculty.map(f => [
        f.profile?.first_name || '',
        f.profile?.last_name || '',
        f.profile?.email || '',
        f.employee_id || '',
        f.designation || '',
        f.department?.name || '',
        f.specialization || '',
        f.joining_date || ''
      ].map(field => `"${String(field).replace(/"/g, '""')}"`).join(','));
      
      const csvContent = [headers.join(','), ...rows].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.setAttribute('href', url);
      a.setAttribute('download', `faculty_export_${new Date().toISOString().split('T')[0]}.csv`);
      a.click();
      toast.success('Faculty exported successfully');
    } catch (err) {
      console.error(err);
      toast.error('Failed to export faculty');
    }
  };

  const renderFacultyForm = (onSubmit: () => void, submitLabel: string) => (
    <div className="grid gap-4 py-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-slate-300">First Name</Label>
          <Input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} className="bg-slate-800 border-slate-700 text-white" />
        </div>
        <div className="space-y-2">
          <Label className="text-slate-300">Last Name</Label>
          <Input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} className="bg-slate-800 border-slate-700 text-white" />
        </div>
      </div>
      <div className="space-y-2">
        <Label className="text-slate-300">Email</Label>
        <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="bg-slate-800 border-slate-700 text-white" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-slate-300">Employee ID</Label>
          <Input value={form.employeeId} onChange={(e) => setForm({ ...form, employeeId: e.target.value })} className="bg-slate-800 border-slate-700 text-white" placeholder="e.g., FAC-001" />
        </div>
        <div className="space-y-2">
          <Label className="text-slate-300">Designation</Label>
          <Select value={form.designation} onValueChange={(v) => setForm({ ...form, designation: v })}>
            <SelectTrigger className="bg-slate-800 border-slate-700 text-white"><SelectValue /></SelectTrigger>
            <SelectContent className="bg-slate-800 border-slate-700">
              {['Professor', 'Associate Professor', 'Assistant Professor', 'Lecturer', 'Lab Instructor'].map((d) => (
                <SelectItem key={d} value={d}>{d}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-slate-300">Department</Label>
          <Select value={form.departmentId} onValueChange={(v) => setForm({ ...form, departmentId: v })}>
            <SelectTrigger className="bg-slate-800 border-slate-700 text-white"><SelectValue placeholder="Select" /></SelectTrigger>
            <SelectContent className="bg-slate-800 border-slate-700">
              {departments.map((dept) => (
                <SelectItem key={dept.id} value={dept.id}>{dept.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label className="text-slate-300">Joining Date</Label>
          <Input type="date" value={form.joiningDate} onChange={(e) => setForm({ ...form, joiningDate: e.target.value })} className="bg-slate-800 border-slate-700 text-white" />
        </div>
      </div>
      <div className="space-y-2">
        <Label className="text-slate-300">Specialization</Label>
        <Input value={form.specialization} onChange={(e) => setForm({ ...form, specialization: e.target.value })} className="bg-slate-800 border-slate-700 text-white" placeholder="e.g., Machine Learning, Data Science" />
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={() => { setIsAddOpen(false); setIsEditOpen(false); resetForm(); }}>Cancel</Button>
        <Button onClick={onSubmit} className="bg-violet-600 hover:bg-violet-700">{submitLabel}</Button>
      </DialogFooter>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Faculty Management</h1>
          <p className="text-slate-400">Manage all faculty members</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="border-slate-700"><Upload className="w-4 h-4 mr-2" />Import</Button>
          <Button variant="outline" className="border-slate-700" onClick={handleExportCSV}><Download className="w-4 h-4 mr-2" />Export</Button>
          <Dialog open={isAddOpen} onOpenChange={(open) => { setIsAddOpen(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button className="bg-violet-600 hover:bg-violet-700"><Plus className="w-4 h-4 mr-2" />Add Faculty</Button>
            </DialogTrigger>
            <DialogContent className="bg-slate-900 border-slate-800 max-w-lg">
              <DialogHeader>
                <DialogTitle className="text-white">Add Faculty Member</DialogTitle>
                <DialogDescription className="text-slate-400">Enter details for the new faculty member</DialogDescription>
              </DialogHeader>
              {renderFacultyForm(handleAdd, "Add Faculty")}
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card className="bg-slate-900/50 border-slate-800">
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <Input placeholder="Search by name, email, employee ID, or designation..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10 bg-slate-800/50 border-slate-700 text-white" />
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-slate-900/50 border-slate-800">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-violet-500/10 flex items-center justify-center"><User className="w-5 h-5 text-violet-400" /></div>
            <div><p className="text-2xl font-bold text-white">{faculty.length}</p><p className="text-xs text-slate-400">Total Faculty</p></div>
          </CardContent>
        </Card>
        <Card className="bg-slate-900/50 border-slate-800">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center"><Building2 className="w-5 h-5 text-emerald-400" /></div>
            <div><p className="text-2xl font-bold text-white">{departments.length}</p><p className="text-xs text-slate-400">Departments</p></div>
          </CardContent>
        </Card>
        <Card className="bg-slate-900/50 border-slate-800">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-cyan-500/10 flex items-center justify-center"><GraduationCap className="w-5 h-5 text-cyan-400" /></div>
            <div><p className="text-2xl font-bold text-white">{new Set(faculty.map(f => f.designation)).size}</p><p className="text-xs text-slate-400">Designations</p></div>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-slate-900/50 border-slate-800 flex-1 flex flex-col min-h-0">
        <div className="flex-1 overflow-auto" ref={parentRef}>
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-slate-900/95 backdrop-blur-sm">
              <TableRow className="border-slate-800 hover:bg-transparent">
                <TableHead className="text-slate-400">Faculty</TableHead>
                <TableHead className="text-slate-400">Employee ID</TableHead>
                <TableHead className="text-slate-400">Designation</TableHead>
                <TableHead className="text-slate-400">Department</TableHead>
                <TableHead className="text-slate-400">Specialization</TableHead>
                <TableHead className="text-slate-400 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-500 mx-auto" /></TableCell></TableRow>
              ) : filteredFaculty.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-slate-500">No faculty found</TableCell></TableRow>
              ) : (
                <TableRow style={{ height: `${rowVirtualizer.getTotalSize()}px`, pointerEvents: 'none' }}>
                  <TableCell colSpan={6} className="p-0 border-0">
                    <div className="relative w-full">
                      {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                        const f = filteredFaculty[virtualRow.index];
                        return (
                          <div
                            key={virtualRow.index}
                            className="absolute top-0 left-0 w-full flex items-center border-b border-slate-800 transition-colors hover:bg-slate-800/30 group pointer-events-auto px-4"
                            style={{
                              height: `${virtualRow.size}px`,
                              transform: `translateY(${virtualRow.start}px)`,
                            }}
                          >
                            <div className="flex-[2] min-w-0 pr-4">
                              <div className="flex items-center gap-3">
                                <Avatar className="w-8 h-8 flex-shrink-0">
                                  <AvatarFallback className="bg-violet-500/20 text-violet-400 text-xs">{getInitials(f)}</AvatarFallback>
                                </Avatar>
                                <div className="min-w-0">
                                  <p className="text-sm font-medium text-white truncate">{f.profile?.first_name} {f.profile?.last_name}</p>
                                  <p className="text-xs text-slate-400 truncate">{f.profile?.email}</p>
                                </div>
                              </div>
                            </div>
                            <div className="flex-1 min-w-0 pr-4">
                              <Badge variant="outline" className="border-slate-700 text-slate-300 truncate max-w-full">{f.employee_id}</Badge>
                            </div>
                            <div className="flex-1 min-w-0 pr-4 text-slate-300 truncate">{f.designation}</div>
                            <div className="flex-1 min-w-0 pr-4 text-slate-300 truncate">{f.department?.name}</div>
                            <div className="flex-1 min-w-0 pr-4 text-slate-400 text-sm truncate">{f.specialization || '—'}</div>
                            <div className="flex-[0.5] flex items-center justify-end gap-1">
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-white" onClick={(e) => { e.stopPropagation(); openEdit(f); }}><Edit className="w-4 h-4" /></Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-red-400" onClick={(e) => { e.stopPropagation(); setSelectedFaculty(f); setIsDeleteOpen(true); }}><Trash2 className="w-4 h-4" /></Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      <Dialog open={isEditOpen} onOpenChange={(open) => { setIsEditOpen(open); if (!open) resetForm(); }}>
        <DialogContent className="bg-slate-900 border-slate-800 max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-white">Edit Faculty</DialogTitle>
            <DialogDescription className="text-slate-400">Update faculty details</DialogDescription>
          </DialogHeader>
          {renderFacultyForm(handleEdit, "Save Changes")}
        </DialogContent>
      </Dialog>

      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent className="bg-slate-900 border-slate-800">
          <DialogHeader>
            <DialogTitle className="text-white">Remove Faculty</DialogTitle>
            <DialogDescription className="text-slate-400">
              Are you sure you want to remove <span className="text-white font-medium">{selectedFaculty?.profile?.first_name} {selectedFaculty?.profile?.last_name}</span>?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete}>Remove Faculty</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}