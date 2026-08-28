"use client";

import { PageHeading, QueryState } from "@/components/page";
import { api, Project } from "@/lib/api";
import { AreaChartOutlined, ArrowRightOutlined, CheckCircleFilled, CloudServerOutlined, DatabaseOutlined, HddOutlined, ProjectOutlined, ReloadOutlined, SafetyCertificateOutlined } from "@ant-design/icons";
import { Column } from "@ant-design/charts";
import { useQuery } from "@tanstack/react-query";
import { Badge, Button, Card, Col, Flex, Progress, Row, Space, Statistic, Table, Tag, Tooltip, Typography } from "antd";
import Link from "next/link";

type Overview = {
  system: { cpuLoadPercent: number; memory: { total: number; used: number; available: number }; disks: { mount: string; size: number; used: number; usePercent: number }[] };
  mongodb: { version: string; uptimeSeconds: number; connections: { current: number; available: number }; opcounters: Record<string, number>; network: Record<string, number> };
};

const gb = (bytes: number) => bytes / 1024 / 1024 / 1024;
const compact = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });

function MetricCard({ title, value, suffix, icon, color, detail }: { title: string; value: number | string; suffix?: string; icon: React.ReactNode; color: string; detail: string }) {
  return <Card className="dashboard-metric" bordered={false}>
    <Flex justify="space-between" align="flex-start">
      <Statistic title={title} value={value} suffix={suffix} />
      <span className="dashboard-metric-icon" style={{ color, background: `${color}14` }}>{icon}</span>
    </Flex>
    <Typography.Text type="secondary" className="dashboard-metric-detail"><CheckCircleFilled style={{ color: "#22c55e" }} /> {detail}</Typography.Text>
  </Card>;
}

export default function DashboardPage() {
  const query = useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => {
      const [overview, projects] = await Promise.all([api<Overview>("/monitoring"), api<Project[]>("/projects")]);
      return { overview, projects };
    },
    refetchInterval: 30_000,
  });
  const data = query.data;

  return <>
    <PageHeading title="Infrastructure overview" description="Live health and activity across your MongoDB control plane." action={<Space><Badge status="processing" text="Auto-refresh 30s" /><Button icon={<ReloadOutlined />} loading={query.isFetching} onClick={() => query.refetch()}>Refresh</Button></Space>} />
    <QueryState loading={query.isLoading} error={query.error}>{data && (() => {
      const { overview, projects } = data;
      const memoryPercent = Math.round(overview.system.memory.used / overview.system.memory.total * 100);
      const disk = overview.system.disks[0];
      const operationData = Object.entries(overview.mongodb.opcounters).filter(([, value]) => typeof value === "number").map(([operation, value]) => ({ operation: operation.charAt(0).toUpperCase() + operation.slice(1), value }));
      const uptimeDays = Math.floor(overview.mongodb.uptimeSeconds / 86400);

      return <Space direction="vertical" size={18} style={{ width: "100%" }}>
        <Card className="dashboard-hero" bordered={false}>
          <Flex justify="space-between" align="center" gap={24} wrap="wrap">
            <Space size="large">
              <span className="dashboard-hero-icon"><CloudServerOutlined /></span>
              <div><Space size="small"><Typography.Title level={3}>MongoDB is operational</Typography.Title><Tag color="success" bordered={false}>HEALTHY</Tag></Space><Typography.Text>MongoDB {overview.mongodb.version} running for {uptimeDays ? `${uptimeDays} days` : `${Math.floor(overview.mongodb.uptimeSeconds / 3600)} hours`}</Typography.Text></div>
            </Space>
            <Space size="large" split={<span className="hero-divider" />}>
              <Statistic title="Active connections" value={overview.mongodb.connections.current} />
              <Statistic title="Capacity available" value={compact.format(overview.mongodb.connections.available)} />
              <Link href="/mongodb"><Button type="primary">Manage MongoDB <ArrowRightOutlined /></Button></Link>
            </Space>
          </Flex>
        </Card>

        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} xl={6}><MetricCard title="Projects" value={projects.length} icon={<ProjectOutlined />} color="#1677ff" detail="All projects available" /></Col>
          <Col xs={24} sm={12} xl={6}><MetricCard title="Databases" value={projects.length} icon={<DatabaseOutlined />} color="#8b5cf6" detail="Scoped credentials enabled" /></Col>
          <Col xs={24} sm={12} xl={6}><MetricCard title="Connections" value={overview.mongodb.connections.current} icon={<SafetyCertificateOutlined />} color="#06b6d4" detail={`${compact.format(overview.mongodb.connections.available)} connections free`} /></Col>
          <Col xs={24} sm={12} xl={6}><MetricCard title="Disk used" value={Math.round(disk?.usePercent || 0)} suffix="%" icon={<HddOutlined />} color="#f59e0b" detail={disk ? `${gb(disk.used).toFixed(1)} of ${gb(disk.size).toFixed(1)} GB` : "No disk data"} /></Col>
        </Row>

        <Row gutter={[16, 16]}>
          <Col xs={24} xl={15}>
            <Card className="dashboard-panel dashboard-chart" bordered={false} title={<Space><AreaChartOutlined /> MongoDB operations</Space>} extra={<Typography.Text type="secondary">Since server start</Typography.Text>}>
              {operationData.length ? <Column height={292} data={operationData} xField="operation" yField="value" colorField="operation" legend={false} style={{ radiusTopLeft: 6, radiusTopRight: 6 }} axis={{ y: { labelFormatter: (value: number) => compact.format(value) } }} tooltip={{ title: "operation" }} /> : null}
            </Card>
          </Col>
          <Col xs={24} xl={9}>
            <Card className="dashboard-panel" bordered={false} title="Server utilization" extra={<Link href="/monitoring">Details <ArrowRightOutlined /></Link>}>
              <Space direction="vertical" size={25} style={{ width: "100%" }}>
                <div className="utilization-row"><Flex justify="space-between"><Space><span className="utilization-dot cpu" />CPU load</Space><strong>{overview.system.cpuLoadPercent.toFixed(1)}%</strong></Flex><Progress percent={Math.round(overview.system.cpuLoadPercent)} showInfo={false} strokeColor="#1677ff" /></div>
                <div className="utilization-row"><Flex justify="space-between"><Space><span className="utilization-dot memory" />Memory</Space><strong>{memoryPercent}%</strong></Flex><Progress percent={memoryPercent} showInfo={false} strokeColor="#8b5cf6" /><Typography.Text type="secondary">{gb(overview.system.memory.used).toFixed(1)} GB used of {gb(overview.system.memory.total).toFixed(1)} GB</Typography.Text></div>
                <div className="utilization-row"><Flex justify="space-between"><Space><span className="utilization-dot disk" />Disk storage</Space><strong>{Math.round(disk?.usePercent || 0)}%</strong></Flex><Progress percent={Math.round(disk?.usePercent || 0)} showInfo={false} strokeColor="#f59e0b" /><Typography.Text type="secondary">{disk ? `${gb(disk.size - disk.used).toFixed(1)} GB available on ${disk.mount}` : "No disk data"}</Typography.Text></div>
              </Space>
            </Card>
          </Col>
        </Row>

        <Card className="dashboard-panel" bordered={false} title="Managed databases" extra={<Link href="/projects"><Button type="link">View all <ArrowRightOutlined /></Button></Link>}>
          <Table rowKey="_id" pagination={false} dataSource={projects.slice(0, 6)} locale={{ emptyText: "Create your first project to provision a database" }} columns={[
            { title: "PROJECT", dataIndex: "name", render: (value, row) => <Space><span className="database-avatar"><DatabaseOutlined /></span><div className="table-primary"><Link href={`/projects/${row._id}`}>{value}</Link><Typography.Text type="secondary">{row.description || "Managed MongoDB project"}</Typography.Text></div></Space> },
            { title: "DATABASE", dataIndex: "databaseName", render: (value, row) => <Link href={`/databases/${row._id}`}><Typography.Text code>{value}</Typography.Text></Link> },
            { title: "USER", dataIndex: "username", render: (value) => <Typography.Text code>{value}</Typography.Text> },
            { title: "STATUS", render: () => <Tag color="success" bordered={false}><Badge status="success" /> Active</Tag> },
            { title: "CREATED", dataIndex: "createdAt", render: (value) => <Tooltip title={new Date(value).toLocaleString()}>{new Date(value).toLocaleDateString()}</Tooltip> },
          ]} />
        </Card>
      </Space>;
    })()}</QueryState>
  </>;
}
