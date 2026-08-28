"use client";

import { api } from "@/lib/api";
import { LockOutlined, MailOutlined } from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, Button, Card, Form, Input, Space, Spin, Typography } from "antd";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const queryClient = useQueryClient();
  const setup = useQuery({ queryKey: ["setup-status"], queryFn: () => api<{ initialized: boolean }>("/auth/setup-status"), retry: false });
  const login = useMutation({ mutationFn: (values: { email: string; password: string }) => api("/auth/login", { method: "POST", body: JSON.stringify(values) }), onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ["me"] }); router.replace(params.get("next") || "/dashboard"); } });
  useEffect(() => {
    if (setup.data && !setup.data.initialized) router.replace("/setup");
  }, [router, setup.data]);
  if (setup.isLoading) return <Spin size="large" description="Checking platform status" />;
  if (setup.data && !setup.data.initialized) return <Spin size="large" description="Opening setup" />;
  return <Card className="login-card" bordered={false}><Space direction="vertical" size={6} style={{ width: "100%", marginBottom: 24 }}><Typography.Title level={2}>Welcome back</Typography.Title><Typography.Text type="secondary">Sign in to manage your database infrastructure.</Typography.Text></Space>{login.error && <Alert style={{ marginBottom: 16 }} type="error" showIcon message={login.error.message} />}<Form layout="vertical" size="large" onFinish={(values) => login.mutate(values)}><Form.Item name="email" label="Email" rules={[{ required: true }, { type: "email" }]}><Input prefix={<MailOutlined />} placeholder="you@company.com" /></Form.Item><Form.Item name="password" label="Password" rules={[{ required: true }]}><Input.Password prefix={<LockOutlined />} placeholder="Password" /></Form.Item><Button block type="primary" htmlType="submit" loading={login.isPending}>Sign in</Button></Form></Card>;
}

export default function LoginPage() { return <div className="login-wrap"><section className="login-art"><Typography.Title style={{ color: "white", fontSize: 48 }}>Operate data<br />without the overhead.</Typography.Title><Typography.Paragraph style={{ color: "#bfdbfe", fontSize: 18, maxWidth: 540 }}>Deploy, observe, and protect every MongoDB workload from one secure control plane.</Typography.Paragraph></section><section className="login-panel"><Suspense><LoginForm /></Suspense></section></div>; }
