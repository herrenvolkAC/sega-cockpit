export type KPIStatus = "green" | "amber" | "red";

export type KPI = {
  key: string;
  label: string;
  value: string | number | null;
  unit?: string;
  status: KPIStatus;
};

export type StatusResponse = {
  sector: string;
  generatedAt: string;
  replicationLagMinutes: number | null;
  databaseName: string;
  kpis: KPI[];
  notes?: string[];
};

export type DetailTable = {
  key: string;
  title: string;
  columns: string[];
  rows: (string | number | null)[][];
};

export type DetailResponse = {
  sector: string;
  generatedAt: string;
  replicationLagMinutes: number | null;
  tables: DetailTable[];
};

export type ErrorResponse = {
  ok: false;
  error: {
    code: string;
    message: string;
  };
};
