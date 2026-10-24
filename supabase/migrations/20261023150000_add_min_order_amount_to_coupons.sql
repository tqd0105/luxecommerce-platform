-- Migration: Thêm trường giá trị đơn hàng tối thiểu cho bảng coupons
ALTER TABLE public.coupons
ADD COLUMN IF NOT EXISTS min_order_amount NUMERIC DEFAULT 0 NOT NULL;

-- Chú thích mô tả cột
COMMENT ON COLUMN public.coupons.min_order_amount IS 'Giá trị đơn hàng tối thiểu (VNĐ) để được áp dụng mã giảm giá. Mặc định 0 là không giới hạn.';
