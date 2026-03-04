import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { Building2, Plus, Users, GraduationCap, Edit, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import type { Department } from '@/lib/database.types';
import { departmentService } from '@/lib/api';

export default function DepartmentsPage() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedDept, setSelectedDept] = useState<Department | null>(null);
  const [newDepartment, setNewDepartment] = useState({
    name: '',
    code: '',
    description: '',
  });
  const [editForm, setEditForm] = useState({
    name: '',
    code: '',
    description: '',
  });

  useEffect(() => {
    fetchDepartments();
  }, []);

  const fetchDepartments = async () => {
    try {
      const data = await departmentService.getAll();
      setDepartments(data);
    } catch (error) {
      console.error('Error fetching departments:', error);
      toast.error('Failed to load departments');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddDepartment = async () => {
    try {
      await departmentService.create(newDepartment);
      toast.success('Department created successfully');
      setIsAddDialogOpen(false);
      fetchDepartments();
      setNewDepartment({ name: '', code: '', description: '' });
    } catch (error) {
      console.error('Error creating department:', error);
      toast.error('Failed to create department');
    }
  };

  const handleEditDepartment = async () => {
    if (!selectedDept) return;
    try {
      await departmentService.update(selectedDept.id, editForm);
      toast.success('Department updated successfully');
      setIsEditDialogOpen(false);
      fetchDepartments();
    } catch (error) {
      toast.error('Failed to update department');
    }
  };

  const handleDeleteDepartment = async () => {
    if (!selectedDept) return;
    try {
      await departmentService.delete(selectedDept.id);
      toast.success('Department deleted');
      setIsDeleteDialogOpen(false);
      setSelectedDept(null);
      fetchDepartments();
    } catch (error) {
      toast.error('Failed to delete department');
    }
  };

  const openEditDialog = (dept: Department) => {
    setSelectedDept(dept);
    setEditForm({ name: dept.name, code: dept.code, description: dept.description || '' });
    setIsEditDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Departments</h1>
          <p className="text-slate-400">Manage academic departments</p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-violet-600 hover:bg-violet-700">
              <Plus className="w-4 h-4 mr-2" />
              Add Department
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-slate-900 border-slate-800">
            <DialogHeader>
              <DialogTitle className="text-white">Add New Department</DialogTitle>
              <DialogDescription className="text-slate-400">
                Create a new academic department
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label className="text-slate-300">Department Name</Label>
                <Input
                  value={newDepartment.name}
                  onChange={(e) => setNewDepartment({ ...newDepartment, name: e.target.value })}
                  className="bg-slate-800 border-slate-700 text-white"
                  placeholder="e.g., Computer Science"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-slate-300">Department Code</Label>
                <Input
                  value={newDepartment.code}
                  onChange={(e) => setNewDepartment({ ...newDepartment, code: e.target.value })}
                  className="bg-slate-800 border-slate-700 text-white"
                  placeholder="e.g., CSE"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-slate-300">Description</Label>
                <Input
                  value={newDepartment.description}
                  onChange={(e) => setNewDepartment({ ...newDepartment, description: e.target.value })}
                  className="bg-slate-800 border-slate-700 text-white"
                  placeholder="Brief description..."
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleAddDepartment} className="bg-violet-600 hover:bg-violet-700">
                Create Department
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading ? (
          <div className="col-span-full flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-500" />
          </div>
        ) : departments.length === 0 ? (
          <div className="col-span-full text-center py-8 text-slate-500">
            No departments found
          </div>
        ) : (
          departments.map((dept) => (
            <Card key={dept.id} className="bg-slate-900/50 border-slate-800">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-lg bg-violet-500/10 flex items-center justify-center">
                      <Building2 className="w-6 h-6 text-violet-400" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-white">{dept.name}</h3>
                      <p className="text-sm text-slate-400">{dept.code}</p>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-white" onClick={() => openEditDialog(dept)}>
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-red-400" onClick={() => { setSelectedDept(dept); setIsDeleteDialogOpen(true); }}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                <p className="mt-3 text-sm text-slate-400 line-clamp-2">{dept.description}</p>
                <div className="mt-4 flex items-center gap-4">
                  <div className="flex items-center gap-2 text-sm text-slate-400">
                    <GraduationCap className="w-4 h-4" />
                    <span>{dept._count?.students || 0} Students</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-slate-400">
                    <Users className="w-4 h-4" />
                    <span>{dept._count?.faculty || 0} Faculty</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="bg-slate-900 border-slate-800">
          <DialogHeader>
            <DialogTitle className="text-white">Edit Department</DialogTitle>
            <DialogDescription className="text-slate-400">Update department details</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label className="text-slate-300">Department Name</Label>
              <Input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} className="bg-slate-800 border-slate-700 text-white" />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300">Department Code</Label>
              <Input value={editForm.code} onChange={(e) => setEditForm({ ...editForm, code: e.target.value })} className="bg-slate-800 border-slate-700 text-white" />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300">Description</Label>
              <Input value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} className="bg-slate-800 border-slate-700 text-white" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleEditDepartment} className="bg-violet-600 hover:bg-violet-700">Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="bg-slate-900 border-slate-800">
          <DialogHeader>
            <DialogTitle className="text-white">Delete Department</DialogTitle>
            <DialogDescription className="text-slate-400">
              Are you sure you want to delete <span className="text-white font-medium">{selectedDept?.name}</span>? This will affect all associated courses and students.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeleteDepartment}>Delete Department</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}