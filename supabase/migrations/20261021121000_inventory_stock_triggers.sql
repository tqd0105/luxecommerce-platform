-- ====================================================================
-- MIGRATION: INVENTORY STOCK MANAGEMENT (DEDUCTION & RESTORATION)
-- Author: Technical Mentor
-- Date: 2026-10-21
-- Description:
--   1. Trigger handle_order_item_stock_deduction:
--      BEFORE INSERT on order_items:
--      - Kiểm tra và khóa dòng sản phẩm / biến thể (FOR UPDATE).
--      - Bắn lỗi (ROLLBACK) nếu tồn kho không đủ (chống bán lố).
--      - Trừ tồn kho tương ứng.
--   2. Trigger handle_order_cancellation_stock_restore:
--      AFTER UPDATE OF status on orders:
--      - Khi status chuyển sang 'cancelled', tự động cộng hoàn kho tất cả món trong đơn.
--      - Khi status chuyển từ 'cancelled' sang trạng thái khác, trừ kho trở lại.
-- ====================================================================

-- 1. HÀM VÀ TRIGGER TRỪ KHO KHI TẠO ĐƠN HÀNG
CREATE OR REPLACE FUNCTION public.handle_order_item_stock_deduction()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_product_name TEXT;
    v_variant_name TEXT;
    v_current_stock INT;
BEGIN
    -- Trường hợp 1: Sản phẩm có biến thể (Variant)
    IF NEW.variant_id IS NOT NULL THEN
        SELECT pv.stock_quantity, pv.name, p.name 
        INTO v_current_stock, v_variant_name, v_product_name
        FROM public.product_variants pv
        JOIN public.products p ON p.id = pv.product_id
        WHERE pv.id = NEW.variant_id
        -- Khoá lại nếu có 2 đơn cùng mua 1 món cùng lúc, tránh việc check stock xong trừ xong lại 
        FOR UPDATE;

        IF v_current_stock IS NULL THEN
            RAISE EXCEPTION 'Biến thể sản phẩm không tồn tại!';
        END IF;

        IF v_current_stock < NEW.quantity THEN
            RAISE EXCEPTION 'Sản phẩm "%" (%) chỉ còn % sản phẩm trong kho, không đủ số lượng yêu cầu!', 
                v_product_name, v_variant_name, v_current_stock;
        END IF;

        -- Trừ tồn kho biến thể
        UPDATE public.product_variants
        SET stock_quantity = stock_quantity - NEW.quantity
        WHERE id = NEW.variant_id;

        -- Đồng bộ trừ tổng tồn kho sản phẩm cha
        UPDATE public.products
        SET stock_quantity = GREATEST(0, stock_quantity - NEW.quantity)
        WHERE id = NEW.product_id;

    -- Trường hợp 2: Sản phẩm đơn (Không có biến thể)
    ELSE
        SELECT p.stock_quantity, p.name 
        INTO v_current_stock, v_product_name
        FROM public.products p
        WHERE p.id = NEW.product_id
        FOR UPDATE;

        IF v_current_stock IS NULL THEN
            RAISE EXCEPTION 'Sản phẩm không tồn tại!';
        END IF;

        IF v_current_stock < NEW.quantity THEN
            RAISE EXCEPTION 'Sản phẩm "%" chỉ còn % sản phẩm trong kho, không đủ số lượng yêu cầu!', 
                v_product_name, v_current_stock;
        END IF;

        -- Trừ tồn kho sản phẩm
        UPDATE public.products
        SET stock_quantity = stock_quantity - NEW.quantity
        WHERE id = NEW.product_id;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_deduct_stock_on_order_item ON public.order_items;
CREATE TRIGGER trg_deduct_stock_on_order_item
    BEFORE INSERT ON public.order_items
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_order_item_stock_deduction();


-- 2. HÀM VÀ TRIGGER HOÀN TRẢ KHO KHI HỦY ĐƠN HÀNG
CREATE OR REPLACE FUNCTION public.handle_order_cancellation_stock_restore()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    r_item RECORD;
BEGIN
    -- Khi đơn hàng chuyển từ trạng thái khác sang 'cancelled' (Hủy đơn)
    IF OLD.status != 'cancelled' AND NEW.status = 'cancelled' THEN
        FOR r_item IN 
            SELECT product_id, variant_id, quantity 
            FROM public.order_items 
            WHERE order_id = NEW.id
        LOOP
            IF r_item.variant_id IS NOT NULL THEN
                UPDATE public.product_variants
                SET stock_quantity = stock_quantity + r_item.quantity
                WHERE id = r_item.variant_id;
            END IF;

            UPDATE public.products
            SET stock_quantity = stock_quantity + r_item.quantity
            WHERE id = r_item.product_id;
        END LOOP;
    END IF;

    -- Đề phòng Admin lỡ tay hủy nhầm rồi mở lại đơn (từ 'cancelled' sang trạng thái khác)
    IF OLD.status = 'cancelled' AND NEW.status != 'cancelled' THEN
        FOR r_item IN 
            SELECT product_id, variant_id, quantity 
            FROM public.order_items 
            WHERE order_id = NEW.id
        LOOP
            IF r_item.variant_id IS NOT NULL THEN
                UPDATE public.product_variants
                SET stock_quantity = GREATEST(0, stock_quantity - r_item.quantity)
                WHERE id = r_item.variant_id;
            END IF;

            UPDATE public.products
            SET stock_quantity = GREATEST(0, stock_quantity - r_item.quantity)
            WHERE id = r_item.product_id;
        END LOOP;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_restore_stock_on_order_cancelled ON public.orders;
CREATE TRIGGER trg_restore_stock_on_order_cancelled
    AFTER UPDATE OF status ON public.orders
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_order_cancellation_stock_restore();
