import { useRef, useState } from 'react';
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
import { Search, Plus, Upload, Download, Edit, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import type { Student, Department, Class, Profile } from '@/lib/database.types';
import { studentService, departmentService, classService, auditLogService } from '@/lib/api';
import { supabase } from '@/lib/supabase';

export default function StudentsPage() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);

  const [newStudent, setNewStudent] = useState({
    firstName: '',
    lastName: '',
    email: '',
    enrollmentId: '',
    departmentId: '',
    classId: '',
    batchYear: new Date().getFullYear(),
    semester: 1,
  });

  const [editForm, setEditForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    enrollmentId: '',
    departmentId: '',
    classId: '',
    semester: 1,
  });

  // Data Fetching with React Query
  const { data: students = [], isLoading: isStudentsLoading } = useQuery<(Student & { profile?: Profile | null; department?: Department | null; class?: Class | null })[]>({
    queryKey: ['students'],
    queryFn: () => studentService.getAll(),
  });

  const { data: departments = [], isLoading: isDepartmentsLoading } = useQuery<Department[]>({
    queryKey: ['departments'],
    queryFn: () => departmentService.getAll(),
  });

  const { data: classes = [], isLoading: isClassesLoading } = useQuery<Class[]>({
    queryKey: ['classes'],
    queryFn: () => classService.getAll(),
  });

  // Mutations with React Query
  const addStudentMutation = useMutation({
    mutationFn: async (studentData: typeof newStudent) => {
      const { data, error } = await supabase.functions.invoke('bulk-operations', {
        body: {
          operation: 'import_students',
          data: [{
            email: studentData.email.trim(),
            firstName: studentData.firstName.trim(),
            lastName: studentData.lastName.trim() || 'Student',
            enrollmentId: studentData.enrollmentId.trim(),
            departmentId: studentData.departmentId,
            classId: studentData.classId,
            batchYear: studentData.batchYear,
            semester: studentData.semester,
          }],
          options: { sendNotifications: true, skipDuplicates: true },
        },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.message || 'Failed to add student');
      return studentData;
    },
    onSuccess: (data) => {
      toast.success('Student added successfully');
      auditLogService.log('CREATE', 'student', '', { newValues: { email: data.email, enrollmentId: data.enrollmentId } });
      queryClient.invalidateQueries({ queryKey: ['students'] });
      setIsAddDialogOpen(false);
      setNewStudent({
        firstName: '', lastName: '', email: '', enrollmentId: '',
        departmentId: '', classId: '', batchYear: new Date().getFullYear(), semester: 1,
      });
    },
    onError: (error) => {
      console.error('Error adding student:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to add student');
    }
  });

  const updateStudentMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string, data: any }) => {
      return studentService.update(id, data);
    },
    onSuccess: (_, variables) => {
      toast.success('Student updated successfully');
      auditLogService.log('UPDATE', 'student', variables.id, { newValues: variables.data });
      queryClient.invalidateQueries({ queryKey: ['students'] });
      setIsEditDialogOpen(false);
    },
    onError: () => {
      toast.error('Failed to update student');
    }
  });

  const deleteStudentMutation = useMutation({
    mutationFn: async (id: string) => {
      return studentService.delete(id);
    },
    onSuccess: (_, id) => {
      toast.success('Student removed successfully');
      auditLogService.log('DELETE', 'student', id, {});
      queryClient.invalidateQueries({ queryKey: ['students'] });
      setIsDeleteDialogOpen(false);
      setSelectedStudent(null);
    },
    onError: () => {
      toast.error('Failed to remove student');
    }
  });

  const handleAddStudent = () => {
    if (!newStudent.email || !newStudent.firstName || !newStudent.enrollmentId || !newStudent.departmentId || !newStudent.classId) {
      toast.error('Fill required fields before adding');
      return;
    }
    addStudentMutation.mutate(newStudent);
  };

  const handleEditStudent = () => {
    if (!selectedStudent) return;
    updateStudentMutation.mutate({
      id: selectedStudent.id,
      data: {
        enrollment_id: editForm.enrollmentId,
        department_id: editForm.departmentId,
        class_id: editForm.classId,
        semester: editForm.semester,
      }
    });
  };

  const handleDeleteStudent = () => {
    if (!selectedStudent) return;
    deleteStudentMutation.mutate(selectedStudent.id);
  };

  const openEditDialog = (student: Student & { profile?: Profile | null; department?: Department | null; class?: Class | null }) => {
    setSelectedStudent(student);
    setEditForm({
      firstName: student.profile?.first_name || '',
      lastName: student.profile?.last_name || '',
      email: student.profile?.email || '',
      enrollmentId: student.enrollment_id || '',
      departmentId: student.department_id || '',
      classId: student.class_id || '',
      semester: student.semester || 1,
    });
    setIsEditDialogOpen(true);
  };

  const filteredStudents = students.filter((student) => {
    const enrollmentId = student.enrollment_id || '';
    const first = student.profile?.first_name || '';
    const last = student.profile?.last_name || '';
    const email = student.profile?.email || '';
    const q = searchQuery.toLowerCase();
    return (
      enrollmentId.toLowerCase().includes(q) ||
      first.toLowerCase().includes(q) ||
      last.toLowerCase().includes(q) ||
      email.toLowerCase().includes(q)
    );
  });

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .filter(Boolean)
      .map((n) => n[0])
      .join('')
      .toUpperCase();
  };

  const handleExportCSV = () => {
    try {
      if (filteredStudents.length === 0) {
        toast.info('No students to export');
        return;
      }
      
      const headers = ['First Name', 'Last Name', 'Email', 'Enrollment ID', 'Department', 'Class', 'Semester', 'Face Registered'];
      const rows = filteredStudents.map(s => [
        s.profile?.first_name || '',
        s.profile?.last_name || '',
        s.profile?.email || '',
        s.enrollment_id || '',
        s.department?.name || '',
        `${s.class?.name || ''} - ${s.class?.section || ''}`,
        s.semester?.toString() || '',
        s.face_registered ? 'Yes' : 'No'
      ].map(field => `"${String(field).replace(/"/g, '""')}"`).join(','));
      
      const csvContent = [headers.join(','), ...rows].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.setAttribute('href', url);
      a.setAttribute('download', `students_export_${new Date().toISOString().split('T')[0]}.csv`);
      a.click();
      toast.success('Students exported successfully');
    } catch (err) {
      console.error(err);
      toast.error('Failed to export students');
    }
  };

  // Virtualization Setup
  const parentRef = useRef<HTMLDivElement>(null);
  const rowVirtualizer = useVirtualizer({
    count: filteredStudents.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 64, // Estimated row height in pixels
    overscan: 10,
  });

  const renderStudentForm = (formValues: any, setFormValues: any, onSubmit: () => void, submitLabel: string) => (
    <div className="grid gap-4 py-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-slate-300">First Name</Label>
          <Input
            value={formValues.firstName}
            onChange={(e) => setFormValues({ ...formValues, firstName: e.target.value })}
            className="bg-slate-800 border-slate-700 text-white"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-slate-300">Last Name</Label>
          <Input
            value={formValues.lastName}
            onChange={(e) => setFormValues({ ...formValues, lastName: e.target.value })}
            className="bg-slate-800 border-slate-700 text-white"
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label className="text-slate-300">Email</Label>
        <Input
          type="email"
          value={formValues.email}
          onChange={(e) => setFormValues({ ...formValues, email: e.target.value })}
          className="bg-slate-800 border-slate-700 text-white"
        />
      </div>
      <div className="space-y-2">
        <Label className="text-slate-300">Enrollment ID</Label>
        <Input
          value={formValues.enrollmentId}
          onChange={(e) => setFormValues({ ...formValues, enrollmentId: e.target.value })}
          className="bg-slate-800 border-slate-700 text-white"
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-slate-300">Department</Label>
          <Select
            value={formValues.departmentId}
            onValueChange={(value) => setFormValues({ ...formValues, departmentId: value })}
          >
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
          <Label className="text-slate-300">Class</Label>
          <Select
            value={formValues.classId}
            onValueChange={(value) => setFormValues({ ...formValues, classId: value })}
          >
            <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
              <SelectValue placeholder="Select class" />
            </SelectTrigger>
            <SelectContent className="bg-slate-800 border-slate-700">
              {classes.map((cls) => (
                <SelectItem key={cls.id} value={cls.id}>{cls.name} - {cls.section}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={() => { setIsAddDialogOpen(false); setIsEditDialogOpen(false); }}>Cancel</Button>
        <Button onClick={onSubmit} className="bg-violet-600 hover:bg-violet-700">{submitLabel}</Button>
      </DialogFooter>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Students Management</h1>
          <p className="text-slate-400">Manage all students in the system</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="border-slate-700">
            <Upload className="w-4 h-4 mr-2" />
            Import CSV
          </Button>
          <Button variant="outline" className="border-slate-700" onClick={handleExportCSV}>
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-violet-600 hover:bg-violet-700">
                <Plus className="w-4 h-4 mr-2" />
                Add Student
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-slate-900 border-slate-800 max-w-lg">
              <DialogHeader>
                <DialogTitle className="text-white">Add New Student</DialogTitle>
                <DialogDescription className="text-slate-400">
                  Enter the details for the new student
                </DialogDescription>
              </DialogHeader>
              {renderStudentForm(newStudent, setNewStudent, handleAddStudent, "Add Student")}
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Student Details Dialog */}
      <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        <DialogContent className="bg-slate-900 border-slate-800 max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-white">Student Details</DialogTitle>
            <DialogDescription className="text-slate-400">Complete profile information</DialogDescription>
          </DialogHeader>
          {selectedStudent && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
              <div className="flex flex-col items-center gap-4 p-4 rounded-xl bg-slate-800/30">
                <Avatar className="w-24 h-24 border-4 border-violet-500/20">
                  <AvatarFallback className="bg-violet-500/20 text-violet-400 text-2xl">
                    {getInitials((selectedStudent.profile?.first_name || '') + ' ' + (selectedStudent.profile?.last_name || ''))}
                  </AvatarFallback>
                </Avatar>
                <div className="text-center">
                  <h3 className="text-xl font-bold text-white">{selectedStudent.profile?.first_name} {selectedStudent.profile?.last_name}</h3>
                  <p className="text-slate-400 text-sm">{selectedStudent.profile?.email}</p>
                </div>
                <Badge variant={selectedStudent.face_registered ? 'default' : 'secondary'} className={selectedStudent.face_registered ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-700 text-slate-400'}>
                  {selectedStudent.face_registered ? 'Face Registered' : 'Face Not Registered'}
                </Badge>
              </div>
              <div className="space-y-4">
                <div>
                  <Label className="text-slate-500 text-xs uppercase tracking-wider">Academic Info</Label>
                  <div className="mt-2 grid grid-cols-2 gap-4">
                    <div className="p-3 rounded-lg bg-slate-800/50 border border-slate-700/50">
                      <p className="text-xs text-slate-500">Enrollment ID</p>
                      <p className="text-sm font-medium text-white">{selectedStudent.enrollment_id}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-slate-800/50 border border-slate-700/50">
                      <p className="text-xs text-slate-500">Semester</p>
                      <p className="text-sm font-medium text-white">{selectedStudent.semester}</p>
                    </div>
                  </div>
                </div>
                <div>
                  <div className="p-3 rounded-lg bg-slate-800/50 border border-slate-700/50">
                    <p className="text-xs text-slate-500">Department</p>
                    <p className="text-sm font-medium text-white">{selectedStudent.department?.name || 'N/A'}</p>
                  </div>
                </div>
                <div>
                  <div className="p-3 rounded-lg bg-slate-800/50 border border-slate-700/50">
                    <p className="text-xs text-slate-500">Class Section</p>
                    <p className="text-sm font-medium text-white">{selectedStudent.class?.name || 'N/A'} - {selectedStudent.class?.section || 'N/A'}</p>
                  </div>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDetailsOpen(false)}>Close</Button>
            <Button className="bg-violet-600 hover:bg-violet-700" onClick={() => { setIsDetailsOpen(false); openEditDialog(selectedStudent!); }}>Edit Profile</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


      {/* Search */}
      <Card className="bg-slate-900/50 border-slate-800">
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <Input
              placeholder="Search students by name, email, or enrollment ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-slate-800/50 border-slate-700 text-white"
            />
          </div>
        </CardContent>
      </Card>

      {/* Students Table */}
      <Card className="bg-slate-900/50 border-slate-800">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-slate-800 hover:bg-transparent flex w-full">
                <TableHead className="text-slate-400 w-[20%]">Student</TableHead>
                <TableHead className="text-slate-400 w-[15%]">Enrollment ID</TableHead>
                <TableHead className="text-slate-400 w-[15%]">Department</TableHead>
                <TableHead className="text-slate-400 w-[15%]">Class</TableHead>
                <TableHead className="text-slate-400 w-[10%]">Semester</TableHead>
                <TableHead className="text-slate-400 w-[15%]">Face Registered</TableHead>
                <TableHead className="text-slate-400 text-right w-[10%]">Actions</TableHead>
              </TableRow>
            </TableHeader>
          </Table>
          
          <div ref={parentRef} className="h-[600px] overflow-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: '#475569 transparent' }}>
            <Table>
              <TableBody style={{ height: `${rowVirtualizer.getTotalSize()}px`, width: '100%', position: 'relative' }}>
                {isStudentsLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 border-b-0">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-500 mx-auto" />
                    </TableCell>
                  </TableRow>
                ) : filteredStudents.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-slate-500 border-b-0">
                      No students found
                    </TableCell>
                  </TableRow>
                ) : (
                  rowVirtualizer.getVirtualItems().map((virtualRow) => {
                    const student = filteredStudents[virtualRow.index];
                    return (
                    <TableRow 
                      key={student.id} 
                      className="border-slate-800 flex w-full absolute top-0 left-0 transition-colors"
                      style={{
                        height: `${virtualRow.size}px`,
                        transform: `translateY(${virtualRow.start}px)`,
                      }}
                    >
                      <TableCell className="w-[20%]">
                        <div className="flex items-center gap-3">
                          <Avatar className="w-8 h-8">
                            <AvatarFallback className="bg-violet-500/20 text-violet-400 text-xs">
                              {getInitials(
                                (student.profile?.first_name || '') +
                                  ' ' +
                                  (student.profile?.last_name || '')
                              )}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="text-sm font-medium text-white truncate max-w-[150px]">
                              {student.profile?.first_name} {student.profile?.last_name}
                            </p>
                            <p className="text-xs text-slate-400 truncate max-w-[150px]">{student.profile?.email}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-slate-300 w-[15%] truncate">{student.enrollment_id}</TableCell>
                      <TableCell className="text-slate-300 w-[15%] truncate">{student.department?.name}</TableCell>
                      <TableCell className="text-slate-300 w-[15%] truncate">
                        {student.class?.name} - {student.class?.section}
                      </TableCell>
                      <TableCell className="text-slate-300 w-[10%]">{student.semester}</TableCell>
                      <TableCell className="w-[15%]">
                        <Badge
                          variant={student.face_registered ? 'default' : 'secondary'}
                          className={
                            student.face_registered
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : 'bg-slate-700 text-slate-400'
                          }
                        >
                          {student.face_registered ? 'Yes' : 'No'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right w-[10%]">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="sm" className="text-violet-400 hover:text-violet-300 px-2 h-8" onClick={() => { setSelectedStudent(student); setIsDetailsOpen(true); }}>View</Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-white" onClick={() => openEditDialog(student)}>
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-red-400" onClick={() => { setSelectedStudent(student); setIsDeleteDialogOpen(true); }}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )})
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="bg-slate-900 border-slate-800 max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-white">Edit Student</DialogTitle>
            <DialogDescription className="text-slate-400">Update student details</DialogDescription>
          </DialogHeader>
          {renderStudentForm(editForm, setEditForm, handleEditStudent, "Save Changes")}
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="bg-slate-900 border-slate-800">
          <DialogHeader>
            <DialogTitle className="text-white">Remove Student</DialogTitle>
            <DialogDescription className="text-slate-400">
              Are you sure you want to remove <span className="text-white font-medium">{selectedStudent?.profile?.first_name} {selectedStudent?.profile?.last_name}</span>? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeleteStudent}>Remove Student</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}