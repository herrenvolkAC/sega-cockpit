/* ============================================================
   BI Layer - Tecsidel
   SQL Server DDL
   Naming standard:
     - Dedicated schema: bi
     - Table prefixes by role: bi.dim_*, bi.fact_*, bi.agg_*
     - PK: PK_<table>
     - FK: FK_<child>__<parent>__<col>
     - IX: IX_<table>__<cols>
   Rationale:
     - Easy filtering: everything BI lives under schema [bi]
     - Avoid collisions with app tables/SPs
   ============================================================ */

-- 0) Schema
IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE name = 'bi')
    EXEC('CREATE SCHEMA bi AUTHORIZATION dbo;');
GO

/* ============================================================
   1) Dimensions
   ============================================================ */

-- 1.1 Operation Type
IF OBJECT_ID('bi.dim_operation_type','U') IS NOT NULL DROP TABLE bi.dim_operation_type;
GO
CREATE TABLE bi.dim_operation_type
(
    operation_type_id  tinyint       NOT NULL,
    operation_code     varchar(10)    NOT NULL,  -- PICK, XDOCK, EXTR, REPL
    operation_name     varchar(50)    NOT NULL,  -- Picking, Crossdocking, Extracción, Reposición
    is_active          bit            NOT NULL CONSTRAINT DF_dim_operation_type_is_active DEFAULT (1),

    CONSTRAINT PK_dim_operation_type PRIMARY KEY CLUSTERED (operation_type_id),
    CONSTRAINT UQ_dim_operation_type__operation_code UNIQUE (operation_code)
);
GO

-- Seed (safe id choices, stable for BI)
MERGE bi.dim_operation_type AS t
USING (VALUES
 (1, 'PICK',  'Picking',         1),
 (2, 'XDOCK', 'Crossdocking',    1),
 (3, 'EXTR',  'Extracción',      1),
 (4, 'REPL',  'Reposición',      1)
) AS s(operation_type_id, operation_code, operation_name, is_active)
ON t.operation_type_id = s.operation_type_id
WHEN MATCHED THEN
  UPDATE SET operation_code = s.operation_code, operation_name = s.operation_name, is_active = s.is_active
WHEN NOT MATCHED THEN
  INSERT (operation_type_id, operation_code, operation_name, is_active)
  VALUES (s.operation_type_id, s.operation_code, s.operation_name, s.is_active);
GO

-- 1.2 Metric Catalog (optional but recommended)
IF OBJECT_ID('bi.dim_metric','U') IS NOT NULL DROP TABLE bi.dim_metric;
GO
CREATE TABLE bi.dim_metric
(
    metric_id      smallint      IDENTITY(1,1) NOT NULL,
    metric_code    varchar(20)   NOT NULL,    -- LINES, UNITS, BULTOS, DOCS, LOC, PALLETS, MOV, ...
    metric_name    varchar(80)   NOT NULL,
    default_uom    varchar(20)   NULL,        -- optional; can be used for validation/display
    is_active      bit           NOT NULL CONSTRAINT DF_dim_metric_is_active DEFAULT (1),

    CONSTRAINT PK_dim_metric PRIMARY KEY CLUSTERED (metric_id),
    CONSTRAINT UQ_dim_metric__metric_code UNIQUE (metric_code)
);
GO

-- Minimal seed aligned to your 4 operations
MERGE bi.dim_metric AS t
USING (VALUES
 ('LINES',   'Líneas',                 'line'),
 ('UNITS',   'Unidades',               'unit'),
 ('BULTOS',  'Bultos',                 'bulto'),
 ('DOCS',    'Documentos/Pedidos',     'doc'),
 ('LOC',     'Ubicaciones tocadas',    'loc'),
 ('PALLETS', 'Pallets',                'pallet'),
 ('MOV',     'Movimientos',            'move'),
 ('KG',      'Peso',                   'kg'),
 ('ERR',     'Errores',                'count'),
 ('REWORK',  'Reprocesos',             'count')
) AS s(metric_code, metric_name, default_uom)
ON t.metric_code = s.metric_code
WHEN MATCHED THEN
  UPDATE SET metric_name = s.metric_name, default_uom = s.default_uom, is_active = 1
WHEN NOT MATCHED THEN
  INSERT (metric_code, metric_name, default_uom, is_active)
  VALUES (s.metric_code, s.metric_name, s.default_uom, 1);
GO

/* ============================================================
   2) Facts
   ============================================================ */

-- 2.1 Operation task (atomic “work unit”)
IF OBJECT_ID('bi.fact_operation_task','U') IS NOT NULL DROP TABLE bi.fact_operation_task;
GO
CREATE TABLE bi.fact_operation_task
(
    task_sk            bigint        IDENTITY(1,1) NOT NULL, -- surrogate PK
    task_id_source     varchar(64)    NOT NULL,              -- natural id from WMS/app (string-safe)
    operation_type_id  tinyint        NOT NULL,

    -- Who / where
    user_id_source     varchar(64)    NOT NULL,              -- map later to a dim if you want
    site_id_source     varchar(64)    NULL,
    zone_id_source     varchar(64)    NULL,

    -- Grouping identifiers (optional)
    work_unit_id       varchar(64)    NULL,                  -- order/wave/movement id etc
    wave_id            varchar(64)    NULL,

    -- Time
    start_ts           datetime2(0)   NULL,                  -- allow null if WMS only gives end
    end_ts             datetime2(0)   NOT NULL,
    duration_sec       int           NULL,                  -- can be computed during load if start exists

    -- Status / quality
    status_code        varchar(20)    NOT NULL CONSTRAINT DF_fact_operation_task_status DEFAULT ('COMPLETED'),

    -- Derived keys (optional; fill in ETL)
    date_key           int           NULL,                  -- yyyymmdd (easy grouping)
    shift_code         varchar(20)   NULL,                  -- e.g. T1/T2/T3 or "MAÑANA/TARDE/NOCHE"

    -- Audit
    source_system      varchar(30)   NULL,
    loaded_at          datetime2(0)  NOT NULL CONSTRAINT DF_fact_operation_task_loaded_at DEFAULT (SYSUTCDATETIME()),

    CONSTRAINT PK_fact_operation_task PRIMARY KEY CLUSTERED (task_sk),
    CONSTRAINT UQ_fact_operation_task__task UNIQUE (task_id_source, operation_type_id),
    CONSTRAINT FK_fact_operation_task__dim_operation_type__operation_type_id
        FOREIGN KEY (operation_type_id) REFERENCES bi.dim_operation_type(operation_type_id),

    CONSTRAINT CK_fact_operation_task__duration_nonneg
        CHECK (duration_sec IS NULL OR duration_sec >= 0)
);
GO

CREATE INDEX IX_fact_operation_task__op_end
ON bi.fact_operation_task (operation_type_id, end_ts)
INCLUDE (user_id_source, zone_id_source, duration_sec, date_key, shift_code);
GO

CREATE INDEX IX_fact_operation_task__date_user
ON bi.fact_operation_task (date_key, user_id_source, operation_type_id)
INCLUDE (end_ts, duration_sec, zone_id_source);
GO

-- 2.2 Operation metrics (flexible measures per task)
IF OBJECT_ID('bi.fact_operation_metric','U') IS NOT NULL DROP TABLE bi.fact_operation_metric;
GO
CREATE TABLE bi.fact_operation_metric
(
    task_sk        bigint        NOT NULL,
    metric_id      smallint      NOT NULL,
    metric_value   decimal(18,4) NOT NULL,
    uom            varchar(20)   NULL,            -- optional override
    loaded_at      datetime2(0)  NOT NULL CONSTRAINT DF_fact_operation_metric_loaded_at DEFAULT (SYSUTCDATETIME()),

    CONSTRAINT PK_fact_operation_metric PRIMARY KEY CLUSTERED (task_sk, metric_id),
    CONSTRAINT FK_fact_operation_metric__fact_operation_task__task_sk
        FOREIGN KEY (task_sk) REFERENCES bi.fact_operation_task(task_sk) ON DELETE CASCADE,
    CONSTRAINT FK_fact_operation_metric__dim_metric__metric_id
        FOREIGN KEY (metric_id) REFERENCES bi.dim_metric(metric_id),
    CONSTRAINT CK_fact_operation_metric__value_nonneg
        CHECK (metric_value >= 0)
);
GO

CREATE INDEX IX_fact_operation_metric__metric
ON bi.fact_operation_metric (metric_id)
INCLUDE (task_sk, metric_value, uom);
GO

/* ============================================================
   3) Aggregates (for dashboards)
   ============================================================ */

-- 3.1 User/day aggregate by operation (and optional zone + shift)
IF OBJECT_ID('bi.agg_operation_user_day','U') IS NOT NULL DROP TABLE bi.agg_operation_user_day;
GO
CREATE TABLE bi.agg_operation_user_day
(
    date_key           int          NOT NULL,     -- yyyymmdd
    shift_code         varchar(20)  not NULL,
    operation_type_id  tinyint      NOT NULL,
    user_id_source     varchar(64)  NOT NULL,
    zone_id_source     varchar(64)  not NULL,
    site_id_source     varchar(64)  not NULL,

    tasks_completed    int          NOT NULL,
    work_seconds       int          NOT NULL,

    -- Common “wide” measures (keep small & useful)
    qty_lines          decimal(18,4) NULL,
    qty_units          decimal(18,4) NULL,
    qty_bultos         decimal(18,4) NULL,
    qty_docs           decimal(18,4) NULL,
    qty_loc            decimal(18,4) NULL,
    qty_pallets        decimal(18,4) NULL,
    qty_mov            decimal(18,4) NULL,

    -- Optional: computed primary KPI for the operation (makes dashboard dead simple)
    primary_metric_code varchar(20)  NULL,        -- e.g. LINES/BULTOS/LOC/PALLETS/MOV
    primary_qty         decimal(18,4) NULL,
    primary_per_hour    decimal(18,4) NULL,

    refreshed_at        datetime2(0) NOT NULL CONSTRAINT DF_agg_operation_user_day_refreshed_at DEFAULT (SYSUTCDATETIME()),

    CONSTRAINT PK_agg_operation_user_day PRIMARY KEY CLUSTERED
    (
        date_key, operation_type_id, user_id_source,
        shift_code, zone_id_source, site_id_source
    ),
    CONSTRAINT FK_agg_operation_user_day__dim_operation_type__operation_type_id
        FOREIGN KEY (operation_type_id) REFERENCES bi.dim_operation_type(operation_type_id),

    CONSTRAINT CK_agg_operation_user_day__work_nonneg CHECK (work_seconds >= 0),
    CONSTRAINT CK_agg_operation_user_day__tasks_nonneg CHECK (tasks_completed >= 0)
);
GO

CREATE INDEX IX_agg_operation_user_day__op_date
ON bi.agg_operation_user_day (operation_type_id, date_key)
INCLUDE (shift_code, zone_id_source, user_id_source, primary_per_hour, primary_qty);
GO

/* ============================================================
   Notes for your ETL (you implement queries)
   ============================================================

1) Load atomic tasks first into bi.fact_operation_task.
   - task_id_source must be stable per operation.
   - Fill date_key = CONVERT(int, FORMAT(end_ts,'yyyyMMdd')) in ETL.
   - duration_sec:
       if start_ts is available: DATEDIFF(SECOND, start_ts, end_ts)
       else NULL (still valid for volume-based KPIs).

2) Then load metrics per task into bi.fact_operation_metric:
   - Join to bi.dim_metric by metric_code to get metric_id.

3) Aggregate into bi.agg_operation_user_day:
   - Group by date_key, shift_code, operation_type_id, user_id_source (+ zone/site if you want).
   - tasks_completed = COUNT(*)
   - work_seconds = SUM(ISNULL(duration_sec,0))  (or calculate from time-events if you have them)

4) Primary KPI suggestion (v1):
   - PICK  -> primary_metric_code = 'LINES'   (or 'UNITS' if that's what they care about)
   - XDOCK -> 'BULTOS' or 'PALLETS'
   - EXTR  -> 'LOC' or 'PALLETS'
   - REPL  -> 'MOV' (best) else 'LOC'
   - primary_per_hour = primary_qty / NULLIF(work_seconds/3600.0,0)

============================================================ */
