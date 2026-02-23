CREATE OR ALTER PROCEDURE bi.usp_load_receiving_daily
(
    @run_date date,
    @rebuild_status bit = 1
)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @to_date date = DATEADD(DAY, 1, @run_date);

    BEGIN TRY
        BEGIN TRAN;

        -- 1) OC items creadas ese día
        EXEC bi.usp_load_oc_item
            @from_date = @run_date,
            @to_date   = @to_date;

        -- 2) Recepciones ocurridas ese día
        EXEC bi.usp_load_receipt_item_day
            @from_date = @run_date,
            @to_date   = @to_date;

        -- 3) Status agregado
        IF @rebuild_status = 1
            EXEC bi.usp_build_oc_item_status;

        COMMIT TRAN;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRAN;

        DECLARE @msg nvarchar(2048) = CONCAT(
            'bi.usp_load_receiving_daily failed. run_date=', CONVERT(varchar(10), @run_date, 120),
            ' | ', ERROR_MESSAGE()
        );
        THROW 50001, @msg, 1;
    END CATCH
END;
GO
