-- Migration: Thêm hàm RPC get_public_order_tracking để tra cứu đơn hàng công khai bằng mã ngắn hoặc mã đầy đủ
-- File: 20261026130000_add_get_public_order_tracking_function.sql

CREATE OR REPLACE FUNCTION public.get_public_order_tracking(p_search_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_clean_code TEXT;
  v_order RECORD;
  v_address JSONB;
  v_items JSONB;
  v_events JSONB;
BEGIN
  -- 1. Làm sạch chuỗi tìm kiếm (xóa khoảng trắng, dấu #, chuyển về chữ thường)
  v_clean_code := LOWER(TRIM(REPLACE(p_search_code, '#', '')));

  IF v_clean_code = '' THEN
    RETURN NULL;
  END IF;

  -- 2. Tìm đơn hàng:
  -- Ưu tiên 1: Khớp chính xác ID UUID (nếu đúng định dạng UUID 36 ký tự)
  -- Ưu tiên 2: Khớp tiền tố short_id (ví dụ 8 ký tự hex đầu của UUID)
  -- Ưu tiên 3: Khớp theo payment_code trong bảng payments (ví dụ LX-XXXXXX)
  SELECT o.*
  INTO v_order
  FROM public.orders o
  LEFT JOIN public.payments p ON p.order_id = o.id
  WHERE (
    (v_clean_code ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' AND o.id = v_clean_code::uuid)
    OR
    (LENGTH(v_clean_code) >= 6 AND o.id::text ILIKE v_clean_code || '%')
    OR
    (p.payment_code IS NOT NULL AND LOWER(p.payment_code) = v_clean_code)
  )
  ORDER BY o.created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  -- 3. Lấy thông tin địa chỉ giao hàng
  SELECT jsonb_build_object(
    'full_name', a.full_name,
    'phone', a.phone,
    'street', a.street,
    'city', a.city,
    'latitude', a.latitude,
    'longitude', a.longitude
  )
  INTO v_address
  FROM public.addresses a
  WHERE a.id = v_order.shipping_address_id;

  -- 4. Lấy danh sách sản phẩm trong đơn
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', oi.id,
        'quantity', oi.quantity,
        'price', oi.price,
        'products', jsonb_build_object(
          'id', pr.id,
          'name', pr.name,
          'image_url', pr.image_url
        ),
        'product_variants', CASE 
          WHEN pv.id IS NOT NULL THEN jsonb_build_object('name', pv.name)
          ELSE NULL 
        END
      )
    ), '[]'::jsonb
  )
  INTO v_items
  FROM public.order_items oi
  JOIN public.products pr ON pr.id = oi.product_id
  LEFT JOIN public.product_variants pv ON pv.id = oi.variant_id
  WHERE oi.order_id = v_order.id;

  -- 5. Lấy các mốc hành trình vận chuyển đã lưu
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', te.id,
        'order_id', te.order_id,
        'sequence_order', te.sequence_order,
        'status', te.status,
        'title', te.title,
        'description', te.description,
        'location_name', te.location_name,
        'latitude', te.latitude,
        'longitude', te.longitude,
        'is_current', te.is_current,
        'is_completed', te.is_completed,
        'completed_at', te.completed_at,
        'created_at', te.created_at
      ) ORDER BY te.sequence_order ASC
    ), '[]'::jsonb
  )
  INTO v_events
  FROM public.order_tracking_events te
  WHERE te.order_id = v_order.id;

  -- 6. Trả về kết quả JSON hợp nhất
  RETURN jsonb_build_object(
    'id', v_order.id,
    'status', v_order.status,
    'total_amount', v_order.total_amount,
    'shipping_fee', v_order.shipping_fee,
    'distance_km', v_order.distance_km,
    'created_at', v_order.created_at,
    'addresses', v_address,
    'order_items', v_items,
    'tracking_events', v_events
  );
END;
$$;

-- Phân quyền thực thi hàm cho cả khách vãng lai (anon) và người dùng đã đăng nhập (authenticated)
GRANT EXECUTE ON FUNCTION public.get_public_order_tracking(TEXT) TO anon, authenticated, service_role;
