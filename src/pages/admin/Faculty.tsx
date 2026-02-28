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
import { Search, Plus, Edit, Trash2, User, Upload, Download, GraduationCap, Building2 } from 'lucide-react';
import { toast } from 'sonner';
import type { Faculty, Department } from '@/types';
import { facultyService, departmentService } from '@/lib/api';

export default function FacultyPage() {
  const [faculty, setFaculty] = useState<Faculty[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedFaculty, setSelectedFaculty] = useState<Faculty | null>(null);
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
  useEffect(() => {
    fetchFaculty();
    fetchDepartments();
  }, []);

  const fetchFaculty = async () => {
    try {
      const data = await facultyService.getAll();
      setFaculty(data);
    } catch (error) {
      console.error('Error fetching faculty:', error);
      toast.error('Failed to load faculty');
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

  const handleAdd = async () => {
    try {
      await facultyService.create({
        employeeId: form.employeeId,
        designation: form.designation,
        departmentId: form.departmentId,
        joiningDate: form.joiningDate,
        specialization: form.specialization,
      } as any);
      toast.success('Faculty member added successfully');
      setIsAddOpen(false);
      resetForm();
      fetchFaculty();
    } catch (error) {
      toast.error('Failed to add faculty');
    }
  };

  const handleEdit = async () => {
    if (!selectedFaculty) return;
    try {
      await facultyService.update(selectedFaculty.id, {
        employeeId: form.employeeId,
        designation: form.designation,
        departmentId: form.departmentId,
        joiningDate: form.joiningDate,
        specialization: form.specialization,
      } as any);
      toast.success('Faculty updated successfully');
      setIsEditOpen(false);
      resetForm();
      fetchFaculty();
    } catch (error) {
      toast.error('Failed to update faculty');
    }
  };

  const handleDelete = async () => {
    if (!selectedFaculty) return;
    try {
      await facultyService.delete(selectedFaculty.id);
      toast.success('Faculty member removed');
      setIsDeleteOpen(false);
      setSelectedFaculty(null);
      fetchFaculty();
    } catch (error) {
      toast.error('Failed to remove faculty');
    }
  };

  const openEdit = (f: Faculty) => {
    setSelectedFaculty(f);
    setForm({
      firstName: f.user?.profile?.firstName || '',
      lastName: f.user?.profile?.lastName || '',
      email: f.user?.email || '',
      employeeId: f.employeeId,
      designation: f.designation,
      departmentId: f.departmentId,
      joiningDate: f.joiningDate,
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

  const filteredFaculty = faculty.filter(
    (f) =>
      f.employeeId?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.user?.profile?.firstName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.user?.profile?.lastName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.user?.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.designation?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getInitials = (f: Faculty) =>
    ((f.user?.profile?.firstName?.[0] || '') + (f.user?.profile?.lastName?.[0] || '')).toUpperCase() || 'F';

  const FacultyForm = ({ onSubmit, submitLabel }: { onSubmit: () => void; submitLabel: string }) => (
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
          <Button variant="outline" className="border-slate-700"><Download className="w-4 h-4 mr-2" />Export</Button>
          <Dialog open={isAddOpen} onOpenChange={(open) => { setIsAddOpen(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button className="bg-violet-600 hover:bg-violet-700"><Plus className="w-4 h-4 mr-2" />Add Faculty</Button>
            </DialogTrigger>
            <DialogContent className="bg-slate-900 border-slate-800 max-w-lg">
              <DialogHeader>
                <DialogTitle className="text-white">Add Faculty Member</DialogTitle>
                <DialogDescription className="text-slate-400">Enter details for the new faculty member</DialogDescription>
              </DialogHeader>
              <FacultyForm onSubmit={handleAdd} submitLabel="Add Faculty" />
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

      <Card className="bg-slate-900/50 border-slate-800">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
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
                filteredFaculty.map((f) => (
                  <TableRow key={f.id} className="border-slate-800">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="w-8 h-8"><AvatarFallback className="bg-violet-500/20 text-violet-400 text-xs">{getInitials(f)}</AvatarFallback></Avatar>
                        <div>
                          <p className="text-sm font-medium text-white">{f.user?.profile?.firstName} {f.user?.profile?.lastName}</p>
                          <p className="text-xs text-slate-400">{f.user?.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell><Badge variant="outline" className="border-slate-700 text-slate-300">{f.employeeId}</Badge></TableCell>
                    <TableCell className="text-slate-300">{f.designation}</TableCell>
                    <TableCell className="text-slate-300">{f.department?.name}</TableCell>
                    <TableCell className="text-slate-400 text-sm">{f.specialization || '—'}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-white" onClick={() => openEdit(f)}><Edit className="w-4 h-4" /></Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-red-400" onClick={() => { setSelectedFaculty(f); setIsDeleteOpen(true); }}><Trash2 className="w-4 h-4" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={isEditOpen} onOpenChange={(open) => { setIsEditOpen(open); if (!open) resetForm(); }}>
        <DialogContent className="bg-slate-900 border-slate-800 max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-white">Edit Faculty</DialogTitle>
            <DialogDescription className="text-slate-400">Update faculty details</DialogDescription>
          </DialogHeader>
          <FacultyForm onSubmit={handleEdit} submitLabel="Save Changes" />
        </DialogContent>
      </Dialog>

      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent className="bg-slate-900 border-slate-800">
          <DialogHeader>
            <DialogTitle className="text-white">Remove Faculty</DialogTitle>
            <DialogDescription className="text-slate-400">
              Are you sure you want to remove <span className="text-white font-medium">{selectedFaculty?.user?.profile?.firstName} {selectedFaculty?.user?.profile?.lastName}</span>?
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