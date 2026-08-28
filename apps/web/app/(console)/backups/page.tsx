"use client";

import { PageHeading, QueryState } from "@/components/page";
import { api, Backup, Project } from "@/lib/api";
import { CloudDownloadOutlined, DeleteOutlined, PlusOutlined } from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { App, Button, Card, Modal, Popconfirm, Select, Space, Table, Tag } from "antd";
import { useState } from "react";

type Row = Backup & { projectName: string };

export default function BackupsPage() {
  const [open, setOpen] = useState(false);
  const [projectId, setProjectId] = useState<string>();
  const qc = useQueryClient();
  const { message } = App.useApp();
  const projects = useQuery({ queryKey: ["projects"], queryFn: () => api<Project[]>("/projects") });
  const backups = useQuery({ queryKey: ["backups", projects.data?.map((project) => project._id)], enabled: Boolean(projects.data), queryFn: async () => (await Promise.all((projects.data || []).map(async (project) => (await api<Backup[]>(`/projects/${project._id}/backups`)).map((backup) => ({ ...backup, projectName: project.name }))))).flat() as Row[] });
  const create = useMutation({ mutationFn: (id: string) => api(`/projects/${id}/backups`, { method: "POST" }), onSuccess: () => { qc.invalidateQueries({ queryKey: ["backups"] }); setOpen(false); message.success("Backup completed"); } });
  const restore = useMutation({ mutationFn: (row: Row) => api(`/projects/${row.projectId}/backups/${row.backupId}/restore`, { method: "POST" }), onSuccess: () => message.success("Backup restored") });
  const remove = useMutation({ mutationFn: (row: Row) => api(`/projects/${row.projectId}/backups/${row.backupId}`, { method: "DELETE" }), onSuccess: () => { qc.invalidateQueries({ queryKey: ["backups"] }); message.success("Backup deleted"); } });
  const error = projects.error || backups.error;
  return <><PageHeading title="Backups" description="Project database dumps stored by this VPS." action={<Button type="primary" icon={<PlusOutlined />} onClick={() => setOpen(true)} disabled={!projects.data?.length}>Create backup</Button>} /><QueryState loading={projects.isLoading || backups.isLoading} error={error} empty={!backups.data?.length}><Card><Table rowKey="backupId" dataSource={backups.data} scroll={{ x: 850 }} columns={[{ title: "Database", dataIndex: "databaseName" }, { title: "Project", dataIndex: "projectName" }, { title: "Status", dataIndex: "status", render: (value) => <Tag color={value === "completed" ? "green" : value === "failed" ? "red" : "processing"}>{value}</Tag> }, { title: "Created", dataIndex: "createdAt", render: (value) => new Date(value).toLocaleString() }, { title: "Actions", render: (_, row) => <Space><Popconfirm title="Restore this backup?" description="Existing collections will be replaced." onConfirm={() => restore.mutate(row)}><Button icon={<CloudDownloadOutlined />} disabled={row.status !== "completed"} loading={restore.isPending}>Restore</Button></Popconfirm><Popconfirm title="Delete this backup?" onConfirm={() => remove.mutate(row)}><Button danger icon={<DeleteOutlined />} disabled={row.status === "running"} loading={remove.isPending} /></Popconfirm></Space> }]} /></Card></QueryState><Modal title="Create backup" open={open} onCancel={() => setOpen(false)} onOk={() => projectId && create.mutate(projectId)} okButtonProps={{ disabled: !projectId }} confirmLoading={create.isPending}><Select style={{ width: "100%" }} placeholder="Select project" value={projectId} onChange={setProjectId} options={projects.data?.map((project) => ({ value: project._id, label: `${project.name} (${project.databaseName})` }))} /></Modal></>;
}
