import { useState, useRef, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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
import { Search, Plus, Edit, Trash2, Users, Building2, GraduationCap } from 'lucide-react';
import { toast } from 'sonner';
import type { Class as DbClass, Department, Faculty, Profile } from '@/lib/database.types';
import { classService, departmentService, facultyService, auditLogService } from '@/lib/api';

export default function ClassesPage() {
  const queryClient = useQueryClient();
  const parentRef = useRef<HTMLDivElement>(null);
  type ClassWithRelations = DbClass & { department?: Department | null; class_incharge?: (Faculty & { profile?: Profile | null }) | null };
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedClass, setSelectedClass] = useState<ClassWithRelations | null>(null);
  const [form, setForm] = useState({
    name: '',
    section: 'A',
    department_id: '',
    course_id: '',
    class_incharge_id: '',
    room: '',
    capacity: 60,
    academicYear: `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`,
  });

  // ── Queries ──
  const { data: classes = [] as ClassWithRelations[], isLoading: isLoadingClasses } = useQuery({
    queryKey: ['classes'],
    queryFn: async () => {
      const data = await classService.getAll();
      return data as ClassWithRelations[];
    },
  });

  const { data: departments = [] as Department[] } = useQuery({
    queryKey: ['departments'],
    queryFn: departmentService.getAll,
  });

  const { data: facultyList = [] as (Faculty & { profile?: Profile | null })[] } = useQuery({
    queryKey: ['faculty'],
    queryFn: async () => {
      const data = await facultyService.getAll();
      return data as (Faculty & { profile?: Profile | null })[];
    },
  });

  const isLoading = isLoadingClasses;

  // ── Mutations ──
  const createMutation = useMutation({
    mutationFn: (data: any) => classService.create(data),
    onSuccess: () => {
      toast.success('Class created successfully');
      auditLogService.log('CREATE', 'class', '', { newValues: form });
      queryClient.invalidateQueries({ queryKey: ['classes'] });
      setIsAddOpen(false);
      resetForm();
    },
    onError: () => toast.error('Failed to create class'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string, data: any }) => classService.update(id, data),
    onSuccess: (_, variables) => {
      toast.success('Class updated successfully');
      auditLogService.log('UPDATE', 'class', variables.id, { newValues: form });
      queryClient.invalidateQueries({ queryKey: ['classes'] });
      setIsEditOpen(false);
      resetForm();
    },
    onError: () => toast.error('Failed to update class'),
  });

  const deleteMutation = useMutation({
    mutationFn: classService.delete,
    onSuccess: (_, id) => {
      toast.success('Class deleted successfully');
      auditLogService.log('DELETE', 'class', id, {});
      queryClient.invalidateQueries({ queryKey: ['classes'] });
      setIsDeleteOpen(false);
      setSelectedClass(null);
    },
    onError: () => toast.error('Failed to delete class'),
  });

  // ── Handlers ──
  const handleAdd = () => {
    createMutation.mutate({
      name: form.name.trim(),
      section: form.section,
      department_id: form.department_id,
      course_id: form.course_id || null,
      class_incharge_id: form.class_incharge_id || null,
      room: form.room.trim() || null,
      capacity: form.capacity,
      academic_year: form.academicYear,
    } as any);
  };

  const handleEdit = () => {
    if (!selectedClass) return;
    updateMutation.mutate({
      id: selectedClass.id,
      data: {
        name: form.name.trim(),
        section: form.section,
        department_id: form.department_id,
        course_id: form.course_id || null,
        class_incharge_id: form.class_incharge_id || null,
        room: form.room.trim() || null,
        capacity: form.capacity,
        academic_year: form.academicYear,
      } as any
    });
  };

  const handleDelete = () => {
    if (selectedClass) deleteMutation.mutate(selectedClass.id);
  };

  const openEdit = (cls: ClassWithRelations) => {
    setSelectedClass(cls);
    setForm({
      name: cls.name,
      section: cls.section,
      department_id: cls.department_id,
      course_id: (cls as any).course_id || '',
      class_incharge_id: (cls as any).class_incharge_id || '',
      room: (cls as any).room || '',
      capacity: cls.capacity,
      academicYear: (cls as any).academic_year || `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`,
    });
    setIsEditOpen(true);
  };

  const resetForm = () => {
    setForm({
      name: '', section: 'A', department_id: '', course_id: '', class_incharge_id: '',
      room: '', capacity: 60, academicYear: `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`,
    });
    setSelectedClass(null);
  };

  const filteredClasses = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return classes.filter(
      (c) =>
        c.name?.toLowerCase().includes(q) ||
        c.section?.toLowerCase().includes(q) ||
        c.department?.name?.toLowerCase().includes(q)
    );
  }, [classes, searchQuery]);

  // ── Virtualizer ──
  const rowVirtualizer = useVirtualizer({
    count: filteredClasses.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 64,
    overscan: 5,
  });

  const renderClassForm = (onSubmit: () => void, submitLabel: string) => (
    <div className="grid gap-4 py-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-slate-300">Class Name</Label>
          <Input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="bg-slate-800 border-slate-700 text-white"
            placeholder="e.g., CSE-2A"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-slate-300">Section</Label>
          <Select value={form.section} onValueChange={(v) => setForm({ ...form, section: v })}>
            <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-slate-800 border-slate-700">
              {['A', 'B', 'C', 'D', 'E'].map((s) => (
                <SelectItem key={s} value={s}>Section {s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-slate-300">Department</Label>
          <Select value={form.department_id} onValueChange={(v) => setForm({ ...form, department_id: v })}>
            <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
              <SelectValue placeholder="Select department" />
            </SelectTrigger>
            <SelectContent className="bg-slate-800 border-slate-700">
              {departments.map((dept) => (
                <SelectItem key={dept.id} value={dept.id}>{dept.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label className="text-slate-300">Class Incharge</Label>
          <Select value={form.class_incharge_id} onValueChange={(v) => setForm({ ...form, class_incharge_id: v })}>
            <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
              <SelectValue placeholder="Select faculty" />
            </SelectTrigger>
            <SelectContent className="bg-slate-800 border-slate-700">
              {facultyList.map((f) => (
                <SelectItem key={f.id} value={f.id}>
                  {f.profile?.first_name} {f.profile?.last_name} ({f.employee_id})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-slate-300">Room Number</Label>
          <Input
            value={form.room}
            onChange={(e) => setForm({ ...form, room: e.target.value })}
            className="bg-slate-800 border-slate-700 text-white"
            placeholder="e.g., Lab-301"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-slate-300">Capacity</Label>
          <Input
            type="number"
            min={1}
            value={form.capacity}
            onChange={(e) => setForm({ ...form, capacity: parseInt(e.target.value) || 30 })}
            className="bg-slate-800 border-slate-700 text-white"
          />
        </div>
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
          <h1 className="text-2xl font-bold text-white">Classes</h1>
          <p className="text-slate-400">Manage class sections and room assignments</p>
        </div>
        <Dialog open={isAddOpen} onOpenChange={(open) => { setIsAddOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button className="bg-violet-600 hover:bg-violet-700">
              <Plus className="w-4 h-4 mr-2" />
              Add Class
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-slate-900 border-slate-800 max-w-lg">
            <DialogHeader>
              <DialogTitle className="text-white">Add New Class</DialogTitle>
              <DialogDescription className="text-slate-400">Create a new class section</DialogDescription>
            </DialogHeader>
            {renderClassForm(handleAdd, "Create Class")}
          </DialogContent>
        </Dialog>
      </div>

      <Card className="bg-slate-900/50 border-slate-800">
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <Input
              placeholder="Search classes by name, section, or department..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-slate-800/50 border-slate-700 text-white"
            />
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-slate-900/50 border-slate-800">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-violet-500/10 flex items-center justify-center">
              <Users className="w-5 h-5 text-violet-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{classes.length}</p>
              <p className="text-xs text-slate-400">Total Classes</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-slate-900/50 border-slate-800">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
              <GraduationCap className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{classes.reduce((sum, c) => sum + (c._count?.students || 0), 0)}</p>
              <p className="text-xs text-slate-400">Total Students</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-slate-900/50 border-slate-800">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-cyan-500/10 flex items-center justify-center">
              <Building2 className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{classes.reduce((sum, c) => sum + c.capacity, 0)}</p>
              <p className="text-xs text-slate-400">Total Capacity</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-slate-900/50 border-slate-800 flex-1 flex flex-col min-h-0">
        <div className="flex-1 overflow-auto" ref={parentRef}>
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-slate-900/95 backdrop-blur-sm">
              <TableRow className="border-slate-800 hover:bg-transparent">
                <TableHead className="text-slate-400">Class</TableHead>
                <TableHead className="text-slate-400">Section</TableHead>
                <TableHead className="text-slate-400">Department</TableHead>
                <TableHead className="text-slate-400">Room</TableHead>
                <TableHead className="text-slate-400">Capacity</TableHead>
                <TableHead className="text-slate-400">Students</TableHead>
                <TableHead className="text-slate-400 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-500 mx-auto" /></TableCell></TableRow>
              ) : filteredClasses.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-slate-500">No classes found</TableCell></TableRow>
              ) : (
                <TableRow style={{ height: `${rowVirtualizer.getTotalSize()}px`, pointerEvents: 'none' }}>
                  <TableCell colSpan={7} className="p-0 border-0">
                    <div className="relative w-full">
                      {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                        const cls = filteredClasses[virtualRow.index];
                        return (
                          <div
                            key={virtualRow.index}
                            className="absolute top-0 left-0 w-full flex items-center border-b border-slate-800 transition-colors hover:bg-slate-800/30 group pointer-events-auto px-4"
                            style={{
                              height: `${virtualRow.size}px`,
                              transform: `translateY(${virtualRow.start}px)`,
                            }}
                          >
                            <div className="flex-[2] min-w-0 pr-4 flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg bg-violet-500/10 flex-shrink-0 flex items-center justify-center">
                                <Users className="w-4 h-4 text-violet-400" />
                              </div>
                              <p className="text-sm font-medium text-white truncate">{cls.name}</p>
                            </div>
                            <div className="flex-1 min-w-0 pr-4">
                              <Badge variant="outline" className="border-slate-700 text-slate-300 truncate">{cls.section}</Badge>
                            </div>
                            <div className="flex-1 min-w-0 pr-4 text-slate-300 truncate">{cls.department?.name}</div>
                            <div className="flex-1 min-w-0 pr-4 text-slate-300 truncate">{cls.room || '—'}</div>
                            <div className="flex-1 min-w-0 pr-4 text-slate-300 truncate">{cls.capacity}</div>
                            <div className="flex-1 min-w-0 pr-4">
                              <Badge className={
                                (cls._count?.students || 0) >= cls.capacity
                                  ? 'bg-red-500/20 text-red-400'
                                  : 'bg-emerald-500/20 text-emerald-400'
                              }>
                                {cls._count?.students || 0}/{cls.capacity}
                              </Badge>
                            </div>
                            <div className="flex-[0.5] flex items-center justify-end gap-1">
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-white" onClick={(e) => { e.stopPropagation(); openEdit(cls); }}><Edit className="w-4 h-4" /></Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-red-400" onClick={(e) => { e.stopPropagation(); setSelectedClass(cls); setIsDeleteOpen(true); }}><Trash2 className="w-4 h-4" /></Button>
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
            <DialogTitle className="text-white">Edit Class</DialogTitle>
            <DialogDescription className="text-slate-400">Update class details</DialogDescription>
          </DialogHeader>
          {renderClassForm(handleEdit, "Save Changes")}
        </DialogContent>
      </Dialog>

      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent className="bg-slate-900 border-slate-800">
          <DialogHeader>
            <DialogTitle className="text-white">Delete Class</DialogTitle>
            <DialogDescription className="text-slate-400">
              Are you sure you want to delete <span className="text-white font-medium">{selectedClass?.name} - {selectedClass?.section}</span>? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete}>Delete Class</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}