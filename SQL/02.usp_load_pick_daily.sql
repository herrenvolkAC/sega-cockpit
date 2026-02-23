CREATE OR ALTER PROCEDURE bi.usp_load_pick_daily
(
    @from_date date,              -- inclusive
    @to_date   date = NULL        -- exclusive; if NULL => @from_date + 1 day
)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF @to_date IS NULL
        SET @to_date = DATEADD(DAY, 1, @from_date);

    DECLARE @op_pick tinyint = 1;

    DECLARE @metric_lines   smallint = (SELECT metric_id FROM bi.dim_metric WHERE metric_code = 'LINES');
    DECLARE @metric_units   smallint = (SELECT metric_id FROM bi.dim_metric WHERE metric_code = 'UNITS');
    DECLARE @metric_bultos  smallint = (SELECT metric_id FROM bi.dim_metric WHERE metric_code = 'BULTOS');

    IF @metric_lines IS NULL OR @metric_units IS NULL OR @metric_bultos IS NULL
        THROW 50000, 'Missing metric(s) in bi.dim_metric. Ensure LINES/UNITS/BULTOS exist.', 1;

    BEGIN TRAN;

    /* ============================================================
       0) Materialize PICK filtered rows (temp table)
       Date format: 'yyyy/mm/dd hh:mi:ss'
       ============================================================ */
    IF OBJECT_ID('tempdb..#pick_filtered') IS NOT NULL DROP TABLE #pick_filtered;

    SELECT
        a.ID                AS traspaso_id,
        CAST(a.CANT_TRASPASADA AS decimal(18,4)) AS cant_traspasada,
        b.ID                AS usuario_id,
        c.ID                AS agrupacion_id,
        d.ID                AS rf_op_id,

        TRY_CONVERT(datetime2(0),
            (TRY_CONVERT(char(10), d.FECHAH_INICIO, 111) + ' ' + SUBSTRING(d.FECHAH_INICIO, 12, 8))
        ) AS inicio_dt,

        TRY_CONVERT(datetime2(0),
            (TRY_CONVERT(char(10), d.FECHAH_FIN, 111) + ' ' + SUBSTRING(d.FECHAH_FIN, 12, 8))
        ) AS fin_dt,

        UPPER(LTRIM(RTRIM(e.NOMBRE_FORMATO))) AS uom_text
    INTO #pick_filtered
    FROM TRASPASOS a
    JOIN USUARIOS b        ON a.NOMBRE_USUARIO = b.NOMBRE
    JOIN CONT_DESP_PICK c  ON a.ID_AGRUPACION = c.ID
    JOIN OPERACIONES_RF d  ON c.ID_RECORRIDO = d.ID
    JOIN FORMATOS e        ON a.ID_FORMATO = e.ID
    WHERE a.TIPO_TRASPASO = 0
      AND d.ESTADO = 2
      AND TRY_CONVERT(datetime2(0),
            (TRY_CONVERT(char(10), d.FECHAH_FIN, 111) + ' ' + SUBSTRING(d.FECHAH_FIN, 12, 8))
          ) >= CAST(@from_date AS datetime2(0))
      AND TRY_CONVERT(datetime2(0),
            (TRY_CONVERT(char(10), d.FECHAH_FIN, 111) + ' ' + SUBSTRING(d.FECHAH_FIN, 12, 8))
          ) <  CAST(@to_date   AS datetime2(0));

    -- Helpful indexes
    CREATE INDEX IX__pick_filtered__key ON #pick_filtered(rf_op_id, usuario_id) INCLUDE (inicio_dt, fin_dt, agrupacion_id);
    CREATE INDEX IX__pick_filtered__traspaso ON #pick_filtered(rf_op_id, usuario_id, traspaso_id);
    CREATE INDEX IX__pick_filtered__uom ON #pick_filtered(rf_op_id, usuario_id, uom_text) INCLUDE (cant_traspasada);

    /* ============================================================
       1) FACT TASK: one row per (rf_op_id, usuario_id)
       task_id_source = rf_op_id + '_' + usuario_id
       ============================================================ */
    ;WITH src_task AS
    (
        SELECT
            CAST(rf_op_id AS varchar(64)) + '_' + CAST(usuario_id AS varchar(64)) AS task_id_source,
            @op_pick                                       AS operation_type_id,
            CAST(usuario_id AS varchar(64))                AS user_id_source,

            CAST(NULL AS varchar(64))                      AS site_id_source,
            CAST(NULL AS varchar(64))                      AS zone_id_source,

            CAST(MIN(agrupacion_id) AS varchar(64))        AS work_unit_id,
            CAST(NULL AS varchar(64))                      AS wave_id,

            MIN(inicio_dt)                                 AS start_ts,
            MAX(fin_dt)                                    AS end_ts,
            CASE
              WHEN MIN(inicio_dt) IS NULL OR MAX(fin_dt) IS NULL THEN NULL
              WHEN MAX(fin_dt) < MIN(inicio_dt) THEN NULL
              ELSE DATEDIFF(SECOND, MIN(inicio_dt), MAX(fin_dt))
            END AS duration_sec,

            'COMPLETED'                                    AS status_code,
            CONVERT(int, FORMAT(MAX(fin_dt), 'yyyyMMdd'))   AS date_key,
            'NA'                                           AS shift_code,
            'WMS'                                          AS source_system
        FROM #pick_filtered
        WHERE fin_dt IS NOT NULL
        GROUP BY rf_op_id, usuario_id
    )
    MERGE bi.fact_operation_task AS tgt
    USING src_task AS s
    ON  tgt.task_id_source = s.task_id_source
    AND tgt.operation_type_id = s.operation_type_id
    WHEN MATCHED THEN
      UPDATE SET
        tgt.user_id_source = s.user_id_source,
        tgt.site_id_source = s.site_id_source,
        tgt.zone_id_source = s.zone_id_source,
        tgt.work_unit_id   = s.work_unit_id,
        tgt.wave_id        = s.wave_id,
        tgt.start_ts       = s.start_ts,
        tgt.end_ts         = s.end_ts,
        tgt.duration_sec   = s.duration_sec,
        tgt.status_code    = s.status_code,
        tgt.date_key       = s.date_key,
        tgt.shift_code     = s.shift_code,
        tgt.source_system  = s.source_system
    WHEN NOT MATCHED THEN
      INSERT
      (
        task_id_source, operation_type_id,
        user_id_source, site_id_source, zone_id_source,
        work_unit_id, wave_id,
        start_ts, end_ts, duration_sec,
        status_code, date_key, shift_code, source_system
      )
      VALUES
      (
        s.task_id_source, s.operation_type_id,
        s.user_id_source, s.site_id_source, s.zone_id_source,
        s.work_unit_id, s.wave_id,
        s.start_ts, s.end_ts, s.duration_sec,
        s.status_code, s.date_key, s.shift_code, s.source_system
      );

    /* ============================================================
       2) FACT METRICS
          - LINES: distinct TRASPASOS.ID per (rf_op_id, usuario_id)
          - QTY: sum(CANT_TRASPASADA) by UOM mapping:
               UNIDAD => UNITS
               CAJA   => BULTOS
               PACK   => BULTOS
       ============================================================ */

    IF OBJECT_ID('tempdb..#m_lines') IS NOT NULL DROP TABLE #m_lines;
    IF OBJECT_ID('tempdb..#m_qty')   IS NOT NULL DROP TABLE #m_qty;

    -- 2.1 LINES
    SELECT
        ft.task_sk,
        @metric_lines AS metric_id,
        CAST(COUNT(DISTINCT f.traspaso_id) AS decimal(18,4)) AS metric_value,
        CAST('line' AS varchar(20)) AS uom
    INTO #m_lines
    FROM #pick_filtered f
    JOIN bi.fact_operation_task ft
      ON ft.task_id_source = CAST(f.rf_op_id AS varchar(64)) + '_' + CAST(f.usuario_id AS varchar(64))
     AND ft.operation_type_id = @op_pick
    GROUP BY ft.task_sk;

    CREATE UNIQUE CLUSTERED INDEX CIX__m_lines ON #m_lines(task_sk, metric_id);

    -- 2.2 QTY by mapped metric (grouped so it produces max 1 row per task+metric)
    SELECT
        ft.task_sk,
        CASE
          WHEN f.uom_text = 'UNIDAD' THEN @metric_units
          WHEN f.uom_text IN ('CAJA','PACK') THEN @metric_bultos
          ELSE @metric_units
        END AS metric_id,
        CAST(SUM(ISNULL(f.cant_traspasada,0)) AS decimal(18,4)) AS metric_value,
        CAST(MAX(f.uom_text) AS varchar(20)) AS uom
    INTO #m_qty
    FROM #pick_filtered f
    JOIN bi.fact_operation_task ft
      ON ft.task_id_source = CAST(f.rf_op_id AS varchar(64)) + '_' + CAST(f.usuario_id AS varchar(64))
     AND ft.operation_type_id = @op_pick
    GROUP BY
        ft.task_sk,
        CASE
          WHEN f.uom_text = 'UNIDAD' THEN @metric_units
          WHEN f.uom_text IN ('CAJA','PACK') THEN @metric_bultos
          ELSE @metric_units
        END;

    CREATE UNIQUE CLUSTERED INDEX CIX__m_qty ON #m_qty(task_sk, metric_id);

    -- Upsert LINES
    MERGE bi.fact_operation_metric AS tgt
    USING #m_lines AS s
    ON  tgt.task_sk = s.task_sk
    AND tgt.metric_id = s.metric_id
    WHEN MATCHED THEN
      UPDATE SET tgt.metric_value = s.metric_value, tgt.uom = s.uom
    WHEN NOT MATCHED THEN
      INSERT (task_sk, metric_id, metric_value, uom)
      VALUES (s.task_sk, s.metric_id, s.metric_value, s.uom);

    -- Upsert QTY
    MERGE bi.fact_operation_metric AS tgt
    USING #m_qty AS s
    ON  tgt.task_sk = s.task_sk
    AND tgt.metric_id = s.metric_id
    WHEN MATCHED THEN
      UPDATE SET tgt.metric_value = s.metric_value, tgt.uom = s.uom
    WHEN NOT MATCHED THEN
      INSERT (task_sk, metric_id, metric_value, uom)
      VALUES (s.task_sk, s.metric_id, s.metric_value, s.uom);

    /* ============================================================
       3) AGG DAILY (PICK) - Primary KPI = LINES/H
       ============================================================ */

    DECLARE @from_key int = CONVERT(int, FORMAT(@from_date,'yyyyMMdd'));
    DECLARE @to_key   int = CONVERT(int, FORMAT(DATEADD(DAY,-1,@to_date),'yyyyMMdd'));

    ;WITH task_base AS
    (
        SELECT
          ft.date_key,
          ISNULL(ft.shift_code,'NA')        AS shift_code,
          ft.operation_type_id,
          ft.user_id_source,
          'ALL'                              AS zone_id_source,
          'MAIN'                             AS site_id_source,
          ft.task_sk,
          ISNULL(ft.duration_sec,0)          AS duration_sec
        FROM bi.fact_operation_task ft
        WHERE ft.operation_type_id = @op_pick
          AND ft.date_key BETWEEN @from_key AND @to_key
          AND ft.status_code = 'COMPLETED'
    ),
    metric_roll AS
    (
        SELECT
          tb.date_key, tb.shift_code, tb.operation_type_id, tb.user_id_source, tb.zone_id_source, tb.site_id_source,
          COUNT(DISTINCT tb.task_sk) AS tasks_completed,
          SUM(tb.duration_sec)       AS work_seconds,
          SUM(CASE WHEN dm.metric_code='LINES'  THEN fom.metric_value END) AS qty_lines,
          SUM(CASE WHEN dm.metric_code='UNITS'  THEN fom.metric_value END) AS qty_units,
          SUM(CASE WHEN dm.metric_code='BULTOS' THEN fom.metric_value END) AS qty_bultos
        FROM task_base tb
        LEFT JOIN bi.fact_operation_metric fom ON fom.task_sk = tb.task_sk
        LEFT JOIN bi.dim_metric dm             ON dm.metric_id = fom.metric_id
        GROUP BY tb.date_key, tb.shift_code, tb.operation_type_id, tb.user_id_source, tb.zone_id_source, tb.site_id_source
    ),
    final AS
    (
        SELECT
          date_key, shift_code, operation_type_id, user_id_source, zone_id_source, site_id_source,
          tasks_completed, work_seconds,
          qty_lines,
          qty_units,
          qty_bultos,
          CAST(NULL AS decimal(18,4)) AS qty_docs,
          CAST(NULL AS decimal(18,4)) AS qty_loc,
          CAST(NULL AS decimal(18,4)) AS qty_pallets,
          CAST(NULL AS decimal(18,4)) AS qty_mov,
          CAST('LINES' AS varchar(20)) AS primary_metric_code,
          qty_lines AS primary_qty,
          CASE
            WHEN work_seconds > 0 AND qty_lines IS NOT NULL
              THEN qty_lines / (work_seconds / 3600.0)
          END AS primary_per_hour
        FROM metric_roll
    )
    MERGE bi.agg_operation_user_day AS tgt
    USING final AS s
    ON  tgt.date_key = s.date_key
    AND tgt.operation_type_id = s.operation_type_id
    AND tgt.user_id_source = s.user_id_source
    AND tgt.shift_code = s.shift_code
    AND tgt.zone_id_source = s.zone_id_source
    AND tgt.site_id_source = s.site_id_source
    WHEN MATCHED THEN
      UPDATE SET
        tgt.tasks_completed = s.tasks_completed,
        tgt.work_seconds    = s.work_seconds,
        tgt.qty_lines       = s.qty_lines,
        tgt.qty_units       = s.qty_units,
        tgt.qty_bultos      = s.qty_bultos,
        tgt.qty_docs        = s.qty_docs,
        tgt.qty_loc         = s.qty_loc,
        tgt.qty_pallets     = s.qty_pallets,
        tgt.qty_mov         = s.qty_mov,
        tgt.primary_metric_code = s.primary_metric_code,
        tgt.primary_qty     = s.primary_qty,
        tgt.primary_per_hour= s.primary_per_hour,
        tgt.refreshed_at    = SYSUTCDATETIME()
    WHEN NOT MATCHED THEN
      INSERT
      (
        date_key, shift_code, operation_type_id, user_id_source, zone_id_source, site_id_source,
        tasks_completed, work_seconds,
        qty_lines, qty_units, qty_bultos, qty_docs, qty_loc, qty_pallets, qty_mov,
        primary_metric_code, primary_qty, primary_per_hour
      )
      VALUES
      (
        s.date_key, s.shift_code, s.operation_type_id, s.user_id_source, s.zone_id_source, s.site_id_source,
        s.tasks_completed, s.work_seconds,
        s.qty_lines, s.qty_units, s.qty_bultos, s.qty_docs, s.qty_loc, s.qty_pallets, s.qty_mov,
        s.primary_metric_code, s.primary_qty, s.primary_per_hour
      );

    COMMIT TRAN;
END;
GO
