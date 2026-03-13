DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'NotificationType'
      AND e.enumlabel = 'PEDIDO_VENCIDO'
  ) THEN
    ALTER TYPE "NotificationType" ADD VALUE 'PEDIDO_VENCIDO';
  END IF;
END
$$;
