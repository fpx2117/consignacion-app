SELECT table_name, column_name, data_type 
FROM information_schema.columns 
WHERE table_name IN ('Configuracion', 'Branding', 'Producto')
ORDER BY table_name, column_name;
