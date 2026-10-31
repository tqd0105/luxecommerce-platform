-- Migration: Xóa các mốc hành trình trùng lặp, thêm UNIQUE constraint và ON CONFLICT DO NOTHING
-- File: 20261028001000_deduplicate_and_constrain_order_tracking_events.sql

-- 1. Xóa các bản ghi trùng lặp trong order_tracking_events, giữ lại bản ghi có trạng thái ưu tiên cao nhất
WITH ranked_events AS (
  SELECT 
    id,
    ROW_NUMBER() OVER (
      PARTITION BY order_id, sequence_order
      ORDER BY 
        is_current DESC,
        is_completed DESC,
        completed_at DESC NULLS LAST,
        created_at ASC
    ) as rn
  FROM public.order_tracking_events
)
DELETE FROM public.order_tracking_events
WHERE id IN (
  SELECT id FROM ranked_events WHERE rn > 1
);

-- 2. Thêm ràng buộc UNIQUE (order_id, sequence_order) để chống race-condition tuyệt đối
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'uq_order_tracking_events_order_sequence'
  ) THEN
    ALTER TABLE public.order_tracking_events
    ADD CONSTRAINT uq_order_tracking_events_order_sequence 
    UNIQUE (order_id, sequence_order);
  END IF;
END $$;

-- 3. Cập nhật hàm get_public_order_tracking với ON CONFLICT DO NOTHING
CREATE OR REPLACE FUNCTION public.get_public_order_tracking(p_search_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_clean_code TEXT;
  v_order RECORD;
  v_address RECORD;
  v_items JSONB;
  v_events JSONB;
  v_dest_lat DOUBLE PRECISION;
  v_dest_lng DOUBLE PRECISION;
  v_origin_lat DOUBLE PRECISION := 10.8231;
  v_origin_lng DOUBLE PRECISION := 106.6297;
  v_is_inter_provincial BOOLEAN;
BEGIN
  -- 1. Làm sạch chuỗi tìm kiếm (xóa khoảng trắng, dấu #, chuyển về chữ thường)
  v_clean_code := LOWER(TRIM(REPLACE(p_search_code, '#', '')));

  IF v_clean_code = '' THEN
    RETURN NULL;
  END IF;

  -- 2. Tìm đơn hàng
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
  SELECT 
    a.full_name,
    a.phone,
    a.street,
    a.city,
    a.latitude,
    a.longitude
  INTO v_address
  FROM public.addresses a
  WHERE a.id = v_order.shipping_address_id;

  v_dest_lat := COALESCE(v_address.latitude, 10.7769);
  v_dest_lng := COALESCE(v_address.longitude, 106.7009);
  v_is_inter_provincial := COALESCE(v_order.distance_km, 0) > 25;

  -- 4. Nếu đơn hàng chưa có mốc hành trình nào, tự động khởi tạo mốc mẫu (chống trùng lặp tuyệt đối)
  IF NOT EXISTS (SELECT 1 FROM public.order_tracking_events WHERE order_id = v_order.id) THEN
    IF v_is_inter_provincial THEN
      -- Cự ly xa / liên tỉnh (> 25km): 6 mốc
      INSERT INTO public.order_tracking_events (
        order_id, sequence_order, status, title, description, location_name, latitude, longitude, is_current, is_completed, completed_at
      ) VALUES
        (v_order.id, 1, 'pending', 'Đơn hàng đã được tiếp nhận', 'Kiện hàng đang được nhân viên kho kiểm tra và đóng gói cẩn thận.', 'Kho tổng LuxeCommerce (TP.HCM)', v_origin_lat, v_origin_lng, true, true, NOW()),
        (v_order.id, 2, 'confirmed', 'Đã xuất kho - Đến Trung tâm khai thác liên tỉnh', 'Đơn hàng đã rời kho và đang trên xe trung chuyển đến Trung tâm phân loại tổng.', 'Trung tâm khai thác liên tỉnh', (v_origin_lat * 0.9 + v_dest_lat * 0.1), (v_origin_lng * 0.9 + v_dest_lng * 0.1), false, false, NULL),
        (v_order.id, 3, 'hub_transit', 'Đang trung chuyển trên tuyến liên tỉnh', 'Kiện hàng đang được luân chuyển xuyên tỉnh về khu vực tỉnh/thành điểm đến.', 'Trục vận chuyển liên tỉnh', (v_origin_lat + v_dest_lat) / 2, (v_origin_lng + v_dest_lng) / 2, false, false, NULL),
        (v_order.id, 4, 'hub_transit', 'Đã đến Bưu cục phát điểm đến', 'Đơn hàng đã hạ tải tại bưu cục đích và đang chờ phân công tuyến phát.', COALESCE(v_address.city, 'Bưu cục phát đích'), (v_origin_lat * 0.15 + v_dest_lat * 0.85), (v_origin_lng * 0.15 + v_dest_lng * 0.85), false, false, NULL),
        (v_order.id, 5, 'out_for_delivery', 'Bưu tá đang phát hàng chặng cuối', 'Bưu tá đã nhận hàng đi giao. Vui lòng giữ liên lạc điện thoại nhận hàng.', COALESCE(v_address.city, 'Địa bàn giao hàng'), v_dest_lat, v_dest_lng, false, false, NULL),
        (v_order.id, 6, 'delivered', 'Giao hàng thành công', 'Đã giao thành công tại địa chỉ khách hàng. Cảm ơn quý khách đã mua sắm!', COALESCE(v_address.street || ', ' || v_address.city, 'Địa chỉ người nhận'), v_dest_lat, v_dest_lng, false, false, NULL)
      ON CONFLICT (order_id, sequence_order) DO NOTHING;
    ELSE
      -- Cự ly gần / nội thành (<= 25km): 4 mốc
      INSERT INTO public.order_tracking_events (
        order_id, sequence_order, status, title, description, location_name, latitude, longitude, is_current, is_completed, completed_at
      ) VALUES
        (v_order.id, 1, 'pending', 'Đơn hàng đã được tiếp nhận', 'Kiện hàng đang được nhân viên kho kiểm tra và đóng gói cẩn thận.', 'Kho tổng LuxeCommerce (TP.HCM)', v_origin_lat, v_origin_lng, true, true, NOW()),
        (v_order.id, 2, 'confirmed', 'Đã xuất kho - Chuyển sang Bưu cục phát', 'Đơn hàng đã rời kho trung tâm và đang trên đường đến bưu cục gần bạn.', 'Bưu cục phát nội thành', (v_origin_lat + v_dest_lat) / 2, (v_origin_lng + v_dest_lng) / 2, false, false, NULL),
        (v_order.id, 3, 'out_for_delivery', 'Đang phát hàng chặng cuối', 'Bưu tá đã nhận hàng và đang di chuyển đến địa chỉ của bạn. Vui lòng để ý điện thoại.', COALESCE(v_address.city, 'Khu vực người nhận'), v_dest_lat, v_dest_lng, false, false, NULL),
        (v_order.id, 4, 'delivered', 'Giao hàng thành công', 'Đã giao thành công tại địa chỉ khách hàng. Cảm ơn quý khách đã mua sắm!', COALESCE(v_address.street || ', ' || v_address.city, 'Địa chỉ người nhận'), v_dest_lat, v_dest_lng, false, false, NULL)
      ON CONFLICT (order_id, sequence_order) DO NOTHING;
    END IF;
  END IF;

  -- 5. Lấy danh sách sản phẩm trong đơn
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

  -- 6. Lấy các mốc hành trình vận chuyển
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

  -- 7. Trả về kết quả JSON hợp nhất
  RETURN jsonb_build_object(
    'id', v_order.id,
    'status', v_order.status,
    'total_amount', v_order.total_amount,
    'shipping_fee', v_order.shipping_fee,
    'distance_km', v_order.distance_km,
    'created_at', v_order.created_at,
    'addresses', CASE 
      WHEN v_address IS NOT NULL THEN jsonb_build_object(
        'full_name', v_address.full_name,
        'phone', v_address.phone,
        'street', v_address.street,
        'city', v_address.city,
        'latitude', v_address.latitude,
        'longitude', v_address.longitude
      )
      ELSE NULL
    END,
    'order_items', v_items,
    'tracking_events', v_events
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_order_tracking(TEXT) TO anon, authenticated, service_role;
