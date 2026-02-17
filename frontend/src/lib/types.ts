export type KpiStatus = "red" | "amber" | "green" | "gray";

export type Kpi = {
  key: string;
  label: string;
  value: number | string | null;
  unit?: string;
  status?: KpiStatus;
};

export type Note = {
  key: string;
  label: string;
  value: string | number | null;
};

export type StatusResponse = {
  sector: string;
  generatedAt: string;
  replicationLagMinutes: number | null;
  databaseName: string;
  kpis: Kpi[];
  notes?: Note[];
};

export type DetailItem = {
  key: string;
  label: string;
  value: string | number | null;
  unit?: string;
  extra?: string | null;
  status?: "red" | "amber" | "green" | "gray";
};

export type DetailResponse = {
  sector: string;
  generatedAt: string;
  replicationLagMinutes: number | null;
  items: DetailItem[];
};
