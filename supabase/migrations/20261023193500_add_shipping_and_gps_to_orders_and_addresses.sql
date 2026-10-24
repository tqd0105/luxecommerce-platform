-- Migration: Bổ sung chi phí vận chuyển và tọa độ GPS cho đơn hàng & sổ địa chỉ
-- File: 20261023193500_add_shipping_and_gps_to_orders_and_addresses.sql

-- 1. Bổ sung các cột phí ship và khoảng cách giao hàng vào bảng orders
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS shipping_fee NUMERIC DEFAULT 0 NOT NULL,
ADD COLUMN IF NOT EXISTS distance_km NUMERIC DEFAULT 0;

COMMENT ON COLUMN public.orders.shipping_fee IS 'Chi phí vận chuyển thực tế tính cho đơn hàng (VNĐ)';
COMMENT ON COLUMN public.orders.distance_km IS 'Khoảng cách giao hàng tính bằng km từ kho đến khách';

-- 2. Bổ sung tọa độ GPS (vĩ độ, kinh độ) vào sổ địa chỉ addresses
ALTER TABLE public.addresses
ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;

COMMENT ON COLUMN public.addresses.latitude IS 'Vĩ độ GPS của địa chỉ giao hàng';
COMMENT ON COLUMN public.addresses.longitude IS 'Kinh độ GPS của địa chỉ giao hàng';
