"use client";

import { PageHeading, QueryState } from "@/components/page";
import { api } from "@/lib/api";
import { DeleteOutlined, UserAddOutlined } from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { App, Button, Card, Form, Input, Modal, Popconfirm, Select, Table, Tag } from "antd";
import { useState } from "react";

type User = { _id: string; email: string; role: "admin" | "viewer"; createdAt: string };
type CreateUser = { email: string; password: string; role: "admin" | "viewer" };

export default function UsersPage() {
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm<CreateUser>();
  const qc = useQueryClient();
  const { message } = App.useApp();
  const query = useQuery({ queryKey: ["users"], queryFn: () => api<User[]>("/admin/users") });
  const create = useMutation({ mutationFn: (values: CreateUser) => api("/admin/users", { method: "POST", body: JSON.stringify(values) }), onSuccess: () => { qc.invalidateQueries({ queryKey: ["users"] }); setOpen(false); form.resetFields(); message.success("User created"); } });
  const remove = useMutation({ mutationFn: (id: string) => api(`/admin/users/${id}`, { method: "DELETE" }), onSuccess: () => { qc.invalidateQueries({ queryKey: ["users"] }); message.success("User deleted"); } });
  return <><PageHeading title="Admin users" description="Create local console accounts and manage access roles." action={<Button type="primary" icon={<UserAddOutlined />} onClick={() => setOpen(true)}>Create user</Button>} /><QueryState loading={query.isLoading} error={query.error} empty={!query.data?.length}><Card><Table rowKey="_id" dataSource={query.data} columns={[{ title: "Email", dataIndex: "email" }, { title: "Role", dataIndex: "role", render: (value) => <Tag color={value === "admin" ? "purple" : "blue"}>{value}</Tag> }, { title: "Created", dataIndex: "createdAt", render: (value) => new Date(value).toLocaleString() }, { title: "", render: (_, row) => <Popconfirm title="Delete this user?" onConfirm={() => remove.mutate(row._id)}><Button danger type="text" icon={<DeleteOutlined />} loading={remove.isPending} /></Popconfirm> }]} /></Card></QueryState><Modal title="Create user" open={open} onCancel={() => setOpen(false)} onOk={() => form.submit()} confirmLoading={create.isPending}><Form form={form} layout="vertical" onFinish={(values) => create.mutate(values)}><Form.Item name="email" label="Email" rules={[{ required: true, type: "email" }]}><Input /></Form.Item><Form.Item name="password" label="Initial password" rules={[{ required: true, min: 8 }]}><Input.Password /></Form.Item><Form.Item name="role" label="Role" initialValue="viewer" rules={[{ required: true }]}><Select options={[{ value: "admin", label: "Admin" }, { value: "viewer", label: "Viewer" }]} /></Form.Item></Form></Modal></>;
}
