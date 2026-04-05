import { useState, useCallback, createContext, useContext, type ReactNode, useEffect } from 'react';
import { supabase } from './supabase';

export type WorkflowTrigger = 'manual' | 'scheduled' | 'event' | 'webhook';
export type WorkflowStatus = 'draft' | 'active' | 'paused' | 'completed' | 'failed';
export type WorkflowStepType = 'approval' | 'notification' | 'condition' | 'action' | 'delay' | 'webhook' | 'trigger';
export type ConditionOperator = 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'contains' | 'not_contains';
export type ApprovalAction = 'approve' | 'reject' | 'escalate' | 'request_info';

export interface WorkflowStep {
  id: string;
  type: WorkflowStepType;
  name: string;
  config: Record<string, unknown>;
  conditions?: {
    field: string;
    operator: ConditionOperator;
    value: unknown;
  }[];
  nextStepId?: string;
  timeout?: number;
}

export interface Workflow {
  id: string;
  name: string;
  description: string;
  trigger: WorkflowTrigger;
  triggerConfig?: Record<string, unknown>;
  steps: WorkflowStep[];
  status: WorkflowStatus;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  lastRunAt?: string;
  runCount: number;
}

export interface WorkflowExecution {
  id: string;
  workflowId: string;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  startedAt: string;
  completedAt?: string;
  currentStepId?: string;
  context: Record<string, unknown>;
  logs: {
    stepId: string;
    status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
    message: string;
    timestamp: string;
  }[];
  error?: string;
}

export interface ApprovalRequest {
  id: string;
  workflowId: string;
  stepId: string;
  requesterId: string;
  approverId: string;
  status: 'pending' | 'approved' | 'rejected' | 'escalated';
  data: Record<string, unknown>;
  comments?: string;
  createdAt: string;
  resolvedAt?: string;
}

interface WorkflowEngineContextValue {
  workflows: Workflow[];
  executions: WorkflowExecution[];
  pendingApprovals: ApprovalRequest[];
  isLoading: boolean;
  createWorkflow: (workflow: Omit<Workflow, 'id' | 'createdAt' | 'updatedAt' | 'runCount'>) => Promise<Workflow>;
  updateWorkflow: (id: string, updates: Partial<Workflow>) => Promise<void>;
  deleteWorkflow: (id: string) => Promise<void>;
  executeWorkflow: (workflowId: string, context?: Record<string, unknown>) => Promise<WorkflowExecution>;
  cancelExecution: (executionId: string) => Promise<void>;
  approveRequest: (requestId: string, action: ApprovalAction, comments?: string) => Promise<void>;
  refresh: () => Promise<void>;
}

const WorkflowEngineContext = createContext<WorkflowEngineContextValue | null>(null);

export function WorkflowEngineProvider({ children }: { children: ReactNode }) {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [executions, setExecutions] = useState<WorkflowExecution[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState<ApprovalRequest[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchWorkflows = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('workflows')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const mapped: Workflow[] = (data || []).map((w: any) => ({
        id: w.id,
        name: w.name,
        description: w.description,
        trigger: w.trigger as WorkflowTrigger,
        triggerConfig: w.trigger_config,
        steps: w.steps || [],
        status: w.status as WorkflowStatus,
        createdBy: w.created_by,
        createdAt: w.created_at,
        updatedAt: w.updated_at,
        lastRunAt: w.last_run_at,
        runCount: w.run_count || 0,
      }));

      setWorkflows(mapped);
    } catch (error) {
      console.error('Failed to fetch workflows:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchPendingApprovals = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('approval_requests')
        .select('*, requester:profiles!approval_requests_requester_id_fkey(*), approver:profiles!approval_requests_approver_id_fkey(*)')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const mapped: ApprovalRequest[] = (data || []).map((r: any) => ({
        id: r.id,
        workflowId: r.workflow_id,
        stepId: r.step_id,
        requesterId: r.requester_id,
        approverId: r.approver_id,
        status: r.status,
        data: r.data || {},
        comments: r.comments,
        createdAt: r.created_at,
        resolvedAt: r.resolved_at,
      }));

      setPendingApprovals(mapped);
    } catch (error) {
      console.error('Failed to fetch pending approvals:', error);
    }
  }, []);

  useEffect(() => {
    fetchWorkflows();
    fetchPendingApprovals();
  }, [fetchWorkflows, fetchPendingApprovals]);

  const createWorkflow = useCallback(async (
    workflow: Omit<Workflow, 'id' | 'createdAt' | 'updatedAt' | 'runCount'>
  ): Promise<Workflow> => {
    const { data, error } = await supabase
      .from('workflows')
      .insert({
        name: workflow.name,
        description: workflow.description,
        trigger: workflow.trigger,
        trigger_config: workflow.triggerConfig,
        steps: workflow.steps,
        status: 'draft',
      })
      .select()
      .single();

    if (error) throw error;

    const newWorkflow: Workflow = {
      id: data.id,
      name: data.name,
      description: data.description,
      trigger: data.trigger,
      triggerConfig: data.trigger_config,
      steps: data.steps,
      status: data.status,
      createdBy: data.created_by,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      runCount: 0,
    };

    setWorkflows(prev => [newWorkflow, ...prev]);
    return newWorkflow;
  }, []);

  const updateWorkflow = useCallback(async (id: string, updates: Partial<Workflow>) => {
    const dbUpdates: Record<string, unknown> = {};
    if (updates.name) dbUpdates.name = updates.name;
    if (updates.description) dbUpdates.description = updates.description;
    if (updates.status) dbUpdates.status = updates.status;
    if (updates.steps) dbUpdates.steps = updates.steps;
    if (updates.triggerConfig) dbUpdates.trigger_config = updates.triggerConfig;

    const { error } = await supabase
      .from('workflows')
      .update(dbUpdates)
      .eq('id', id);

    if (error) throw error;

    setWorkflows(prev =>
      prev.map(w => w.id === id ? { ...w, ...updates, updatedAt: new Date().toISOString() } : w)
    );
  }, []);

  const deleteWorkflow = useCallback(async (id: string) => {
    const { error } = await supabase.from('workflows').delete().eq('id', id);
    if (error) throw error;

    setWorkflows(prev => prev.filter(w => w.id !== id));
  }, []);

  const executeWorkflow = useCallback(async (
    workflowId: string,
    context: Record<string, unknown> = {}
  ): Promise<WorkflowExecution> => {
    const workflow = workflows.find(w => w.id === workflowId);
    if (!workflow) throw new Error('Workflow not found');

    const execution: WorkflowExecution = {
      id: `exec-${Date.now()}`,
      workflowId,
      status: 'running',
      startedAt: new Date().toISOString(),
      currentStepId: workflow.steps[0]?.id,
      context,
      logs: [{
        stepId: workflow.steps[0]?.id || 'start',
        status: 'running',
        message: 'Workflow execution started',
        timestamp: new Date().toISOString(),
      }],
    };

    setExecutions(prev => [...prev, execution]);

    await supabase.from('workflows').update({
      last_run_at: new Date().toISOString(),
      run_count: (workflow.runCount || 0) + 1,
    }).eq('id', workflowId);

    return execution;
  }, [workflows]);

  const cancelExecution = useCallback(async (executionId: string) => {
    setExecutions(prev =>
      prev.map(e =>
        e.id === executionId
          ? { ...e, status: 'cancelled' as const, completedAt: new Date().toISOString() }
          : e
      )
    );
  }, []);

  const approveRequest = useCallback(async (
    requestId: string,
    action: ApprovalAction,
    comments?: string
  ) => {
    const statusMap: Record<ApprovalAction, ApprovalRequest['status']> = {
      approve: 'approved',
      reject: 'rejected',
      escalate: 'escalated',
      request_info: 'pending',
    };

    const { error } = await supabase
      .from('approval_requests')
      .update({
        status: statusMap[action],
        comments,
        resolved_at: new Date().toISOString(),
      })
      .eq('id', requestId);

    if (error) throw error;

    setPendingApprovals(prev => prev.filter(r => r.id !== requestId));
  }, []);

  return (
    <WorkflowEngineContext.Provider
      value={{
        workflows,
        executions,
        pendingApprovals,
        isLoading,
        createWorkflow,
        updateWorkflow,
        deleteWorkflow,
        executeWorkflow,
        cancelExecution,
        approveRequest,
        refresh: fetchWorkflows,
      }}
    >
      {children}
    </WorkflowEngineContext.Provider>
  );
}

export function useWorkflowEngine() {
  const context = useContext(WorkflowEngineContext);
  if (!context) {
    throw new Error('useWorkflowEngine must be used within WorkflowEngineProvider');
  }
  return context;
}

export function usePendingApprovals() {
  const { pendingApprovals } = useWorkflowEngine();
  return pendingApprovals;
}

// Workflow Builder Component (Visual Designer State)
export interface WorkflowBuilderState {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}

export interface WorkflowNode {
  id: string;
  type: WorkflowStepType;
  position: { x: number; y: number };
  data: {
    label: string;
    config: Record<string, unknown>;
    conditions?: WorkflowStep['conditions'];
  };
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
}

export function useWorkflowBuilder(initialWorkflow?: Workflow) {
  const [state, setState] = useState<WorkflowBuilderState>({
    nodes: initialWorkflow?.steps.map((step, i) => ({
      id: step.id,
      type: step.type,
      position: { x: 100 + i * 200, y: 200 },
      data: {
        label: step.name,
        config: step.config,
        conditions: step.conditions,
      },
    })) || [
      {
        id: 'start',
        type: 'trigger' as WorkflowStepType,
        position: { x: 100, y: 200 },
        data: { label: 'Start', config: {} },
      },
    ],
    edges: [],
  });

  const addNode = useCallback((type: WorkflowStepType, position: { x: number; y: number }) => {
    const id = `${type}-${Date.now()}`;
    const labels: Record<WorkflowStepType, string> = {
      approval: 'Approval',
      notification: 'Send Notification',
      condition: 'Condition',
      action: 'Action',
      delay: 'Delay',
      webhook: 'Webhook',
      trigger: 'Trigger',
    };

    setState(prev => ({
      ...prev,
      nodes: [...prev.nodes, {
        id,
        type,
        position,
        data: {
          label: labels[type],
          config: {},
        },
      }],
    }));

    return id;
  }, []);

  const updateNode = useCallback((id: string, updates: Partial<WorkflowNode['data']>) => {
    setState(prev => ({
      ...prev,
      nodes: prev.nodes.map(n =>
        n.id === id ? { ...n, data: { ...n.data, ...updates } } : n
      ),
    }));
  }, []);

  const deleteNode = useCallback((id: string) => {
    setState(prev => ({
      nodes: prev.nodes.filter(n => n.id !== id),
      edges: prev.edges.filter(e => e.source !== id && e.target !== id),
    }));
  }, []);

  const connectNodes = useCallback((source: string, target: string, label?: string) => {
    setState(prev => ({
      ...prev,
      edges: [...prev.edges, { id: `edge-${Date.now()}`, source, target, label }],
    }));
  }, []);

  const toWorkflow = useCallback((name: string, description: string, trigger: WorkflowTrigger): Workflow => {
    const steps: WorkflowStep[] = state.nodes.map(n => ({
      id: n.id,
      type: n.type,
      name: n.data.label,
      config: n.data.config,
      conditions: n.data.conditions,
    }));

    state.edges.forEach((edge) => {
      const sourceNode = steps.find(s => s.id === edge.source);
      if (sourceNode) {
        sourceNode.nextStepId = edge.target;
      }
    });

    return {
      id: '',
      name,
      description,
      trigger,
      steps,
      status: 'draft',
      createdBy: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      runCount: 0,
    };
  }, [state]);

  return {
    state,
    addNode,
    updateNode,
    deleteNode,
    connectNodes,
    toWorkflow,
  };
}
