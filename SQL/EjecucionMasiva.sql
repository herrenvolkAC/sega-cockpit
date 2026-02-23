DECLARE @d date = '2024-09-01';
DECLARE @end date = '2024-10-01';  -- exclusive (runs until 2024-09-30)

WHILE @d < @end
BEGIN
    PRINT CONCAT('Loading PICK for ', CONVERT(varchar(10), @d, 120));

    EXEC bi.usp_load_pick_daily @from_date = @d;

    SET @d = DATEADD(DAY, 1, @d);
END


/*
DELETE FROM bi.fact_operation_metric;
DELETE FROM bi.agg_operation_user_day;
DELETE FROM bi.fact_operation_task;
*/