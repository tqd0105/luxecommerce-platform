-- Migration: Tạo bảng order_tracking_events phục vụ theo dõi đơn hàng theo mốc thời gian thực
-- File: 20261025120000_create_order_tracking_events.sql

CREATE TABLE IF NOT EXISTS public.order_tracking_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    sequence_order INT NOT NULL DEFAULT 1,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    title VARCHAR(255) NOT NULL,
    description TEXT,
    location_name VARCHAR(255) NOT NULL,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    is_current BOOLEAN DEFAULT FALSE,
    is_completed BOOLEAN DEFAULT FALSE,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tạo Index tăng tốc truy vấn theo đơn hàng và thứ tự chặng
CREATE INDEX IF NOT EXISTS idx_order_tracking_events_order_id ON public.order_tracking_events(order_id, sequence_order ASC);
CREATE INDEX IF NOT EXISTS idx_order_tracking_events_current ON public.order_tracking_events(order_id, is_current);

-- Bật RLS bảo mật
ALTER TABLE public.order_tracking_events ENABLE ROW LEVEL SECURITY;

-- 1. Quyền XEM (SELECT):
-- - Cho phép mọi người xem hành trình của đơn hàng nếu biết order_id (hỗ trợ trang tra cứu công khai /tracking/[orderId])
-- - Hoặc khách hàng đăng nhập xem đơn của chính mình
CREATE POLICY "Anyone can view tracking events of an order"
ON public.order_tracking_events
FOR SELECT
USING (true);

-- 2. Quyền THÊM/SỬA/XÓA (ALL):
-- - Chỉ tài khoản Admin mới có quyền thêm/sửa/xóa các mốc hành trình
CREATE POLICY "Admins can manage tracking events"
ON public.order_tracking_events
FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public.profiles p
        JOIN public.roles r ON p.role_id = r.id
        WHERE p.id = auth.uid() AND r.name = 'admin'
    )
);

-- Kích hoạt Realtime cho bảng order_tracking_events
ALTER TABLE public.order_tracking_events REPLICA IDENTITY FULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'order_tracking_events'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.order_tracking_events;
    END IF;
END $$;
