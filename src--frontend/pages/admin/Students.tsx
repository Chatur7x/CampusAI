// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import { useEffect, useState } from 'react';
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
import { studentService, departmentService, classService } from '@/lib/api';
import { supabase } from '@/lib/supabase';

export default function StudentsPage() {
  const [students, setStudents] = useState<(Student & { profile?: Profile | null; department?: Department | null; class?: Class | null })[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
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
  useEffect(() => {
    fetchStudents();
    fetchDepartments();
    fetchClasses();
  }, []);

  const fetchStudents = async () => {
    try {
      const data = await studentService.getAll();
      setStudents(data);
    } catch (error) {
      console.error('Error fetching students:', error);
      toast.error('Failed to load students');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchDepartments = async () => {
    try {
      const data = await departmentService.getAll();
      setDepartments(data);
    } catch (error) {
      console.error('Error fetching departments:', error);
    }
  };

  const fetchClasses = async () => {
    try {
      const data = await classService.getAll();
      setClasses(data);
    } catch (error) {
      console.error('Error fetching classes:', error);
    }
  };

  const handleAddStudent = async () => {
    if (!newStudent.email || !newStudent.firstName || !newStudent.enrollmentId || !newStudent.departmentId || !newStudent.classId) {
      toast.error('Fill required fields before adding');
      return;
    }
    try {
      const { data, error } = await supabase.functions.invoke('bulk-operations', {
        body: {
          operation: 'import_students',
          data: [
            {
              email: newStudent.email.trim(),
              firstName: newStudent.firstName.trim(),
              lastName: newStudent.lastName.trim() || 'Student',
              enrollmentId: newStudent.enrollmentId.trim(),
              departmentId: newStudent.departmentId,
              classId: newStudent.classId,
              batchYear: newStudent.batchYear,
              semester: newStudent.semester,
            },
          ],
          options: { sendNotifications: true, skipDuplicates: true },
        },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.message || 'Failed to add student');

      toast.success('Student added successfully');
      setIsAddDialogOpen(false);
      fetchStudents();
      setNewStudent({
        firstName: '',
        lastName: '',
        email: '',
        enrollmentId: '',
        departmentId: '',
        classId: '',
        batchYear: new Date().getFullYear(),
        semester: 1,
      });
    } catch (error) {
      console.error('Error adding student:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to add student');
    }
  };

  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [editForm, setEditForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    enrollmentId: '',
    departmentId: '',
    classId: '',
    semester: 1,
  });

  const handleEditStudent = async () => {
    if (!selectedStudent) return;
    try {
      await studentService.update(selectedStudent.id, {
        enrollment_id: editForm.enrollmentId,
        department_id: editForm.departmentId,
        class_id: editForm.classId,
        semester: editForm.semester,
      });
      toast.success('Student updated successfully');
      setIsEditDialogOpen(false);
      fetchStudents();
    } catch (error) {
      toast.error('Failed to update student');
    }
  };

  const handleDeleteStudent = async () => {
    if (!selectedStudent) return;
    try {
      await studentService.delete(selectedStudent.id);
      toast.success('Student removed successfully');
      setIsDeleteDialogOpen(false);
      setSelectedStudent(null);
      fetchStudents();
    } catch (error) {
      toast.error('Failed to remove student');
    }
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
    const enrollmentId = (student as any).enrollment_id || '';
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
          <Button variant="outline" className="border-slate-700">
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
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-slate-300">First Name</Label>
                    <Input
                      value={newStudent.firstName}
                      onChange={(e) => setNewStudent({ ...newStudent, firstName: e.target.value })}
                      className="bg-slate-800 border-slate-700 text-white"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-slate-300">Last Name</Label>
                    <Input
                      value={newStudent.lastName}
                      onChange={(e) => setNewStudent({ ...newStudent, lastName: e.target.value })}
                      className="bg-slate-800 border-slate-700 text-white"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-300">Email</Label>
                  <Input
                    type="email"
                    value={newStudent.email}
                    onChange={(e) => setNewStudent({ ...newStudent, email: e.target.value })}
                    className="bg-slate-800 border-slate-700 text-white"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-300">Enrollment ID</Label>
                  <Input
                    value={newStudent.enrollmentId}
                    onChange={(e) => setNewStudent({ ...newStudent, enrollmentId: e.target.value })}
                    className="bg-slate-800 border-slate-700 text-white"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-slate-300">Department</Label>
                    <Select
                      value={newStudent.departmentId}
                      onValueChange={(value) => setNewStudent({ ...newStudent, departmentId: value })}
                    >
                      <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                        <SelectValue placeholder="Select department" />
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
                  <div className="space-y-2">
                    <Label className="text-slate-300">Class</Label>
                    <Select
                      value={newStudent.classId}
                      onValueChange={(value) => setNewStudent({ ...newStudent, classId: value })}
                    >
                      <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                        <SelectValue placeholder="Select class" />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-800 border-slate-700">
                        {classes.map((cls) => (
                          <SelectItem key={cls.id} value={cls.id}>
                            {cls.name} - {cls.section}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleAddStudent} className="bg-violet-600 hover:bg-violet-700">
                  Add Student
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

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
              <TableRow className="border-slate-800 hover:bg-transparent">
                <TableHead className="text-slate-400">Student</TableHead>
                <TableHead className="text-slate-400">Enrollment ID</TableHead>
                <TableHead className="text-slate-400">Department</TableHead>
                <TableHead className="text-slate-400">Class</TableHead>
                <TableHead className="text-slate-400">Semester</TableHead>
                <TableHead className="text-slate-400">Face Registered</TableHead>
                <TableHead className="text-slate-400 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-500 mx-auto" />
                  </TableCell>
                </TableRow>
              ) : filteredStudents.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-slate-500">
                    No students found
                  </TableCell>
                </TableRow>
              ) : (
                filteredStudents.map((student) => (
                  <TableRow key={student.id} className="border-slate-800">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="w-8 h-8">
                          <AvatarFallback className="bg-violet-500/20 text-violet-400 text-xs">
                            {getInitials(
                              (student.user?.profile?.firstName || '') +
                                ' ' +
                                (student.user?.profile?.lastName || '')
                            )}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-sm font-medium text-white">
                            {student.user?.profile?.firstName} {student.user?.profile?.lastName}
                          </p>
                          <p className="text-xs text-slate-400">{student.user?.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-slate-300">{student.enrollmentId}</TableCell>
                    <TableCell className="text-slate-300">{student.department?.name}</TableCell>
                    <TableCell className="text-slate-300">
                      {student.class?.name} - {student.class?.section}
                    </TableCell>
                    <TableCell className="text-slate-300">{student.semester}</TableCell>
                    <TableCell>
                      <Badge
                        variant={student.faceRegistered ? 'default' : 'secondary'}
                        className={
                          student.faceRegistered
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : 'bg-slate-700 text-slate-400'
                        }
                      >
                        {student.faceRegistered ? 'Yes' : 'No'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-white" onClick={() => openEditDialog(student)}>
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-red-400" onClick={() => { setSelectedStudent(student); setIsDeleteDialogOpen(true); }}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="bg-slate-900 border-slate-800 max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-white">Edit Student</DialogTitle>
            <DialogDescription className="text-slate-400">Update student details</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-slate-300">First Name</Label>
                <Input value={editForm.firstName} onChange={(e) => setEditForm({ ...editForm, firstName: e.target.value })} className="bg-slate-800 border-slate-700 text-white" />
              </div>
              <div className="space-y-2">
                <Label className="text-slate-300">Last Name</Label>
                <Input value={editForm.lastName} onChange={(e) => setEditForm({ ...editForm, lastName: e.target.value })} className="bg-slate-800 border-slate-700 text-white" />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300">Email</Label>
              <Input type="email" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} className="bg-slate-800 border-slate-700 text-white" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-slate-300">Department</Label>
                <Select value={editForm.departmentId} onValueChange={(v) => setEditForm({ ...editForm, departmentId: v })}>
                  <SelectTrigger className="bg-slate-800 border-slate-700 text-white"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700">
                    {departments.map((dept) => (<SelectItem key={dept.id} value={dept.id}>{dept.name}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-slate-300">Class</Label>
                <Select value={editForm.classId} onValueChange={(v) => setEditForm({ ...editForm, classId: v })}>
                  <SelectTrigger className="bg-slate-800 border-slate-700 text-white"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700">
                    {classes.map((cls) => (<SelectItem key={cls.id} value={cls.id}>{cls.name} - {cls.section}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleEditStudent} className="bg-violet-600 hover:bg-violet-700">Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="bg-slate-900 border-slate-800">
          <DialogHeader>
            <DialogTitle className="text-white">Remove Student</DialogTitle>
            <DialogDescription className="text-slate-400">
              Are you sure you want to remove <span className="text-white font-medium">{selectedStudent?.user?.profile?.firstName} {selectedStudent?.user?.profile?.lastName}</span>? This action cannot be undone.
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