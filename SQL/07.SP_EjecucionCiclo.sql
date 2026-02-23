DECLARE @current_date date = '2024-09-01';
DECLARE @end_date     date = '2024-11-01';  -- exclusivo

WHILE @current_date < @end_date
BEGIN
    PRINT CONCAT('Procesando fecha: ', CONVERT(varchar(10), @current_date, 120));

    EXEC bi.usp_load_receiving_daily
        @run_date = @current_date,
        @rebuild_status = 0;   -- no recalcula status en cada día

    SET @current_date = DATEADD(DAY, 1, @current_date);
END

-- Recalculo final del status una sola vez
EXEC bi.usp_build_oc_item_status;
