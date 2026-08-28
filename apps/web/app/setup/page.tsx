"use client";

import { api } from "@/lib/api";
import { DatabaseOutlined, LockOutlined, MailOutlined, SafetyCertificateOutlined } from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, Button, Card, Col, Form, Input, Result, Row, Space, Spin, Typography } from "antd";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

type SetupValues = { email: string; password: string; confirmPassword: string };

export default function SetupPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const status = useQuery({ queryKey: ["setup-status"], queryFn: () => api<{ initialized: boolean }>("/auth/setup-status"), retry: false });
  const setup = useMutation({
    mutationFn: ({ email, password }: SetupValues) => api("/auth/bootstrap", { method: "POST", body: JSON.stringify({ email, password }) }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["me"] });
      queryClient.setQueryData(["setup-status"], { initialized: true });
      router.replace("/dashboard");
    },
  });

  useEffect(() => {
    if (status.data?.initialized) router.replace("/login");
  }, [router, status.data?.initialized]);

  if (status.isLoading) return <div className="login-panel" style={{ minHeight: "100vh" }}><Spin size="large" description="Checking platform status" /></div>;
  if (status.error) return <Result status="error" title="Cannot reach the API" subTitle={status.error.message} />;
  if (status.data?.initialized) return <div className="login-panel" style={{ minHeight: "100vh" }}><Spin size="large" description="Setup already completed" /></div>;

  return <div className="login-wrap">
    <section className="login-art">
      <Space direction="vertical" size="large">
        <DatabaseOutlined style={{ fontSize: 52 }} />
        <Typography.Title style={{ color: "white", fontSize: 46, margin: 0 }}>Set up your<br />MongoDB control plane.</Typography.Title>
        <Typography.Paragraph style={{ color: "#bfdbfe", fontSize: 18, maxWidth: 560 }}>Create the first administrator. This setup page is disabled permanently after the account is created.</Typography.Paragraph>
        <Row gutter={24}>
          <Col><Space><SafetyCertificateOutlined /> HttpOnly sessions</Space></Col>
          <Col><Space><LockOutlined /> Argon2 passwords</Space></Col>
        </Row>
      </Space>
    </section>
    <section className="login-panel">
      <Card className="login-card" bordered={false}>
        <Typography.Title level={2}>Create administrator</Typography.Title>
        <Typography.Paragraph type="secondary">Use a unique password with at least 8 characters.</Typography.Paragraph>
        {setup.error && <Alert style={{ marginBottom: 16 }} type="error" showIcon message={setup.error.message} />}
        <Form<SetupValues> layout="vertical" size="large" onFinish={(values) => setup.mutate(values)}>
          <Form.Item name="email" label="Admin email" rules={[{ required: true }, { type: "email" }]}><Input prefix={<MailOutlined />} placeholder="admin@example.com" autoFocus /></Form.Item>
          <Form.Item name="password" label="Password" rules={[{ required: true }, { min: 8 }]}><Input.Password prefix={<LockOutlined />} placeholder="At least 8 characters" /></Form.Item>
          <Form.Item name="confirmPassword" label="Confirm password" dependencies={["password"]} rules={[{ required: true }, ({ getFieldValue }) => ({ validator(_, value) { return !value || getFieldValue("password") === value ? Promise.resolve() : Promise.reject(new Error("Passwords do not match")); } })]}><Input.Password prefix={<LockOutlined />} placeholder="Repeat password" /></Form.Item>
          <Button block type="primary" htmlType="submit" loading={setup.isPending}>Initialize platform</Button>
        </Form>
      </Card>
    </section>
  </div>;
}
