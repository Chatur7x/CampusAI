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
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search, Plus, Edit, Trash2, BookOpen, GraduationCap } from 'lucide-react';
import { toast } from 'sonner';
import type { Course, Department } from '@/lib/database.types';
import { courseService, departmentService, auditLogService } from '@/lib/api';

export default function CoursesPage() {
  const queryClient = useQueryClient();
  const parentRef = useRef<HTMLDivElement>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [form, setForm] = useState({
    name: '',
    code: '',
    credits: 3,
    semester: 1,
    department_id: '',
    description: '',
  });

  // ── Queries ──
  const { data: courses = [] as (Course & { department?: Department | null })[], isLoading: isLoadingCourses } = useQuery({
    queryKey: ['courses'],
    queryFn: async () => {
      const data = await courseService.getAll();
      return data as (Course & { department?: Department | null })[];
    },
  });

  const { data: departments = [] as Department[] } = useQuery({
    queryKey: ['departments'],
    queryFn: () => departmentService.getAll(),
  });

  const isLoading = isLoadingCourses;

  // ── Mutations ──
  const createMutation = useMutation({
    mutationFn: (data: any) => courseService.create(data),
    onSuccess: () => {
      toast.success('Course created successfully');
      auditLogService.log('CREATE', 'course', '', { newValues: form });
      queryClient.invalidateQueries({ queryKey: ['courses'] });
      setIsAddOpen(false);
      resetForm();
    },
    onError: () => toast.error('Failed to create course'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string, data: any }) => courseService.update(id, data),
    onSuccess: (_, variables) => {
      toast.success('Course updated successfully');
      auditLogService.log('UPDATE', 'course', variables.id, { newValues: form });
      queryClient.invalidateQueries({ queryKey: ['courses'] });
      setIsEditOpen(false);
      resetForm();
    },
    onError: () => toast.error('Failed to update course'),
  });

  const deleteMutation = useMutation({
    mutationFn: courseService.delete,
    onSuccess: (_, id) => {
      toast.success('Course deleted successfully');
      auditLogService.log('DELETE', 'course', id, {});
      queryClient.invalidateQueries({ queryKey: ['courses'] });
      setIsDeleteOpen(false);
      setSelectedCourse(null);
    },
    onError: () => toast.error('Failed to delete course'),
  });

  // ── Handlers ──
  const handleAdd = () => {
    createMutation.mutate({
      name: form.name.trim(),
      code: form.code.trim().toUpperCase(),
      credits: form.credits,
      department_id: form.department_id,
      description: form.description.trim(),
    } as any);
  };

  const handleEdit = () => {
    if (!selectedCourse) return;
    updateMutation.mutate({
      id: selectedCourse.id,
      data: {
        name: form.name.trim(),
        code: form.code.trim().toUpperCase(),
        credits: form.credits,
        department_id: form.department_id,
        description: form.description.trim(),
      } as any
    });
  };

  const handleDelete = () => {
    if (selectedCourse) deleteMutation.mutate(selectedCourse.id);
  };

  const openEdit = (course: Course) => {
    setSelectedCourse(course);
    setForm({
      name: course.name,
      code: course.code,
      credits: course.credits,
      semester: (course as any).semester || 1,
      department_id: (course as any).department_id,
      description: course.description || '',
    });
    setIsEditOpen(true);
  };

  const openDelete = (course: Course) => {
    setSelectedCourse(course);
    setIsDeleteOpen(true);
  };

  const resetForm = () => {
    setForm({ name: '', code: '', credits: 3, semester: 1, department_id: '', description: '' });
    setSelectedCourse(null);
  };

  const filteredCourses = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return courses.filter(
      (c) =>
        c.name?.toLowerCase().includes(q) ||
        c.code?.toLowerCase().includes(q) ||
        c.department?.name?.toLowerCase().includes(q)
    );
  }, [courses, searchQuery]);

  // ── Virtualizer ──
  const rowVirtualizer = useVirtualizer({
    count: filteredCourses.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 64,
    overscan: 5,
  });

  const getDeptName = (deptId: string) => departments.find((d) => d.id === deptId)?.name || deptId;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Courses</h1>
          <p className="text-slate-400">Manage academic courses across all departments</p>
        </div>
        <Dialog open={isAddOpen} onOpenChange={(open) => { setIsAddOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button className="bg-violet-600 hover:bg-violet-700">
              <Plus className="w-4 h-4 mr-2" />
              Add Course
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-slate-900 border-slate-800 max-w-lg">
            <DialogHeader>
              <DialogTitle className="text-white">Add New Course</DialogTitle>
              <DialogDescription className="text-slate-400">Create a new academic course</DialogDescription>
            </DialogHeader>
            <CourseForm 
              form={form} 
              setForm={setForm} 
              departments={departments} 
              onSubmit={handleAdd} 
              submitLabel="Create Course" 
              onCancel={() => setIsAddOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </div>

      <Card className="bg-slate-900/50 border-slate-800">
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <Input
              placeholder="Search by course name, code, or department..."
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
              <BookOpen className="w-5 h-5 text-violet-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{courses.length}</p>
              <p className="text-xs text-slate-400">Total Courses</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-slate-900/50 border-slate-800">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
              <GraduationCap className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{departments.length}</p>
              <p className="text-xs text-slate-400">Departments</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-slate-900/50 border-slate-800">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-cyan-500/10 flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{courses.reduce((sum, c) => sum + c.credits, 0)}</p>
              <p className="text-xs text-slate-400">Total Credits</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-slate-900/50 border-slate-800 flex-1 flex flex-col min-h-0">
        <div className="flex-1 overflow-auto" ref={parentRef}>
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-slate-900/95 backdrop-blur-sm">
              <TableRow className="border-slate-800 hover:bg-transparent">
                <TableHead className="text-slate-400">Course</TableHead>
                <TableHead className="text-slate-400">Code</TableHead>
                <TableHead className="text-slate-400">Department</TableHead>
                <TableHead className="text-slate-400">Credits</TableHead>
                <TableHead className="text-slate-400 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-500 mx-auto" /></TableCell></TableRow>
              ) : filteredCourses.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-slate-500">No courses found</TableCell></TableRow>
              ) : (
                <TableRow style={{ height: `${rowVirtualizer.getTotalSize()}px`, pointerEvents: 'none' }}>
                  <TableCell colSpan={5} className="p-0 border-0">
                    <div className="relative w-full">
                      {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                        const course = filteredCourses[virtualRow.index];
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
                                <BookOpen className="w-4 h-4 text-violet-400" />
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-white truncate">{course.name}</p>
                                {course.description && <p className="text-xs text-slate-500 truncate">{course.description}</p>}
                              </div>
                            </div>
                            <div className="flex-1 min-w-0 pr-4">
                              <Badge variant="outline" className="border-slate-700 text-slate-300 truncate">{course.code}</Badge>
                            </div>
                            <div className="flex-1 min-w-0 pr-4 text-slate-300 truncate">
                              {course.department?.name || getDeptName(course.department_id)}
                            </div>
                            <div className="flex-1 min-w-0 pr-4">
                              <Badge className="bg-cyan-500/20 text-cyan-400 truncate">{course.credits} cr</Badge>
                            </div>
                            <div className="flex-[0.5] flex items-center justify-end gap-1">
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-white" onClick={(e) => { e.stopPropagation(); openEdit(course); }}><Edit className="w-4 h-4" /></Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-red-400" onClick={(e) => { e.stopPropagation(); openDelete(course); }}><Trash2 className="w-4 h-4" /></Button>
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
            <DialogTitle className="text-white">Edit Course</DialogTitle>
            <DialogDescription className="text-slate-400">Update course details</DialogDescription>
          </DialogHeader>
          <CourseForm 
            form={form} 
            setForm={setForm} 
            departments={departments} 
            onSubmit={handleEdit} 
            submitLabel="Save Changes" 
            onCancel={() => setIsEditOpen(false)}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent className="bg-slate-900 border-slate-800">
          <DialogHeader>
            <DialogTitle className="text-white">Delete Course</DialogTitle>
            <DialogDescription className="text-slate-400">
              Are you sure you want to delete <span className="text-white font-medium">{selectedCourse?.name}</span>? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete}>Delete Course</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface CourseFormProps {
  form: any;
  setForm: (form: any) => void;
  departments: Department[];
  onSubmit: () => void;
  onCancel: () => void;
  submitLabel: string;
}

function CourseForm({ form, setForm, departments, onSubmit, onCancel, submitLabel }: CourseFormProps) {
  return (
    <div className="grid gap-4 py-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-slate-300">Course Name</Label>
          <Input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="bg-slate-800 border-slate-700 text-white"
            placeholder="e.g., Data Structures"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-slate-300">Course Code</Label>
          <Input
            value={form.code}
            onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
            className="bg-slate-800 border-slate-700 text-white"
            placeholder="e.g., CS201"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-slate-300">Credits</Label>
          <Input
            type="number"
            min={1}
            max={10}
            value={form.credits}
            onChange={(e) => setForm({ ...form, credits: parseInt(e.target.value) || 1 })}
            className="bg-slate-800 border-slate-700 text-white"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-slate-300">Department</Label>
          <Select
            value={form.department_id}
            onValueChange={(v) => setForm({ ...form, department_id: v })}
          >
            <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
              <SelectValue placeholder="Select" />
            </SelectTrigger>
            <SelectContent className="bg-slate-800 border-slate-700">
              {departments.map((dept) => (
                <SelectItem key={dept.id} value={dept.id}>
                  {dept.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-2">
        <Label className="text-slate-300">Description</Label>
        <Textarea
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          className="bg-slate-800 border-slate-700 text-white resize-none"
          placeholder="Brief course description..."
          rows={3}
        />
      </div>
      <DialogFooter className="pt-2">
        <Button variant="outline" onClick={onCancel} className="bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700">
          Cancel
        </Button>
        <Button 
          onClick={onSubmit} 
          className="bg-violet-600 hover:bg-violet-700 text-white shadow-[0_0_15px_rgba(124,58,237,0.3)] transition-all hover:scale-[1.02] active:scale-[0.98]"
        >
          {submitLabel}
        </Button>
      </DialogFooter>
    </div>
  );
}