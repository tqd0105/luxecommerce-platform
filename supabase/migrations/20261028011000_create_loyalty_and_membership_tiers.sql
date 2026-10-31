-- Migration: Hệ thống Tích Xu (Loyalty Coins) & Hạng Thành Viên (Membership Tiers)
-- File: 20261028011000_create_loyalty_and_membership_tiers.sql
-- 1. Bổ sung các cột tích xu và hạng thành viên vào bảng profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS coins_balance INT NOT NULL DEFAULT 0 CHECK (coins_balance >= 0),
ADD COLUMN IF NOT EXISTS lifetime_coins INT NOT NULL DEFAULT 0 CHECK (lifetime_coins >= 0),
ADD COLUMN IF NOT EXISTS membership_tier VARCHAR(20) NOT NULL DEFAULT 'bronze' CHECK (
    membership_tier IN ('bronze', 'silver', 'gold', 'diamond')
),
ADD COLUMN IF NOT EXISTS last_checkin_date DATE;

-- 2. Bổ sung các cột ghi nhận xu vào bảng orders
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS coins_used INT NOT NULL DEFAULT 0 CHECK (coins_used >= 0),
ADD COLUMN IF NOT EXISTS coins_discount NUMERIC(15, 2) NOT NULL DEFAULT 0 CHECK (coins_discount >= 0),
ADD COLUMN IF NOT EXISTS coins_earned INT NOT NULL DEFAULT 0 CHECK (coins_earned >= 0);

-- 3. Tạo bảng ghi nhận lịch sử biến động xu (coin_transactions)
CREATE TABLE IF NOT EXISTS public.coin_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
    order_id UUID REFERENCES public.orders (id) ON DELETE SET NULL,
    amount INT NOT NULL, -- Số xu thay đổi (+ cộng xu, - tiêu xu)
    balance_after INT NOT NULL, -- Số dư xu sau giao dịch
    type VARCHAR(50) NOT NULL CHECK (
        type IN (
            'order_reward', -- Thưởng khi hoàn thành đơn hàng
            'order_spent', -- Tiêu xu khi mua hàng
            'order_refund', -- Hoàn lại xu khi hủy đơn
            'daily_checkin', -- Điểm danh nhận xu hàng ngày
            'review_reward', -- Thưởng xu khi đánh giá sản phẩm
            'admin_adjustment' -- Admin điều chỉnh thủ công
        )
    ),
    description TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index tăng tốc truy vấn lịch sử xu theo user và thời gian
CREATE INDEX IF NOT EXISTS idx_coin_transactions_user_id ON public.coin_transactions (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_coin_transactions_order_id ON public.coin_transactions (order_id);

-- 4. Bật Row Level Security (RLS) cho coin_transactions
ALTER TABLE public.coin_transactions ENABLE ROW LEVEL SECURITY;

-- Policy 1: User chỉ được xem lịch sử xu của chính mình
CREATE POLICY "Users can view their own coin transactions" ON public.coin_transactions FOR
SELECT
    USING (auth.uid () = user_id);

-- Policy 2: Admin được quyền xem toàn bộ giao dịch xu
CREATE POLICY "Admins can view all coin transactions" ON public.coin_transactions FOR
SELECT
    USING (
        EXISTS (
            SELECT
                1
            FROM
                public.profiles p
                JOIN public.roles r ON p.role_id = r.id
            WHERE
                p.id = auth.uid ()
                AND r.name = 'admin'
        )
    );

-- Policy 3: Cho phép Service Role / Triggers thực hiện INSERT/UPDATE
CREATE POLICY "Service and Admin can insert coin transactions" ON public.coin_transactions FOR INSERT
WITH
    CHECK (
        auth.uid () = user_id
        OR EXISTS (
            SELECT
                1
            FROM
                public.profiles p
                JOIN public.roles r ON p.role_id = r.id
            WHERE
                p.id = auth.uid ()
                AND r.name = 'admin'
        )
    );

-- 5. Hàm tính toán và cập nhật hạng thành viên tự động dựa trên lifetime_coins
CREATE OR REPLACE FUNCTION public.calc_membership_tier (p_lifetime_coins INT) RETURNS VARCHAR(20) LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
    IF p_lifetime_coins >= 50000 THEN
        RETURN 'diamond'; -- Kim Cương (>= 50.000 điểm ~ 5 triệu)
    ELSIF p_lifetime_coins >= 20000 THEN
        RETURN 'gold';    -- Vàng (>= 20.000 điểm ~ 2 triệu)
    ELSIF p_lifetime_coins >= 5000 THEN
        RETURN 'silver';  -- Bạc (>= 5.000 điểm ~ 500k)
    ELSE
        RETURN 'bronze';  -- Đồng (Mặc định)
    END IF;
END;
$$;

-- Trigger tự động cập nhật membership_tier mỗi khi lifetime_coins thay đổi
CREATE OR REPLACE FUNCTION public.trg_update_membership_tier () RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.membership_tier := public.calc_membership_tier(NEW.lifetime_coins);
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_membership_tier ON public.profiles;

CREATE TRIGGER trg_profiles_membership_tier
BEFORE INSERT OR UPDATE OF lifetime_coins ON public.profiles FOR EACH ROW
EXECUTE FUNCTION public.trg_update_membership_tier ();

-- 6. Trigger tự động thưởng xu khi đơn hàng chuyển sang 'delivered' (Giao hàng thành công)
CREATE OR REPLACE FUNCTION public.trg_award_coins_on_order_delivered () RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_profile RECORD;
    v_rate NUMERIC;
    v_coins_to_award INT;
    v_new_balance INT;
    v_new_lifetime INT;
BEGIN
    -- Chỉ xử lý khi trạng thái chuyển sang 'delivered' và chưa từng cộng xu cho đơn này
    IF NEW.status = 'delivered' AND (OLD.status IS NULL OR OLD.status != 'delivered') AND NEW.user_id IS NOT NULL AND NEW.coins_earned = 0 THEN
        SELECT * INTO v_profile FROM public.profiles WHERE id = NEW.user_id;

        IF FOUND THEN
            -- Tỷ lệ tích xu theo hạng thành viên:
            -- Đồng: 1%, Bạc: 1.5%, Vàng: 2%, Kim Cương: 3%
            CASE v_profile.membership_tier
                WHEN 'diamond' THEN v_rate := 0.03;
                WHEN 'gold'    THEN v_rate := 0.02;
                WHEN 'silver'  THEN v_rate := 0.015;
                ELSE                v_rate := 0.01;
            END CASE;

            -- Tính số xu thưởng dựa trên tổng tiền hàng (loại trừ tiền ship)
            v_coins_to_award := FLOOR(GREATEST(0, (NEW.total_amount - COALESCE(NEW.shipping_fee, 0))) * v_rate);

            IF v_coins_to_award > 0 THEN
                v_new_balance := v_profile.coins_balance + v_coins_to_award;
                v_new_lifetime := v_profile.lifetime_coins + v_coins_to_award;

                -- Cập nhật bảng profiles
                UPDATE public.profiles
                SET coins_balance = v_new_balance,
                    lifetime_coins = v_new_lifetime
                WHERE id = NEW.user_id;

                -- Cập nhật lại đơn hàng để đánh dấu số xu đã thưởng
                NEW.coins_earned := v_coins_to_award;

                -- Ghi lịch sử biến động xu
                INSERT INTO public.coin_transactions (
                    user_id,
                    order_id,
                    amount,
                    balance_after,
                    type,
                    description
                ) VALUES (
                    NEW.user_id,
                    NEW.id,
                    v_coins_to_award,
                    v_new_balance,
                    'order_reward',
                    'Tích ' || v_coins_to_award || ' Xu từ đơn hàng #' || UPPER(SUBSTRING(NEW.id::text, 1, 8))
                );
            END IF;
        END IF;
    END IF;

    -- Hoàn lại xu cho khách nếu đơn hàng bị hủy (cancelled) mà trước đó khách đã dùng xu
    IF NEW.status = 'cancelled' AND (OLD.status IS NULL OR OLD.status != 'cancelled') AND NEW.user_id IS NOT NULL AND NEW.coins_used > 0 THEN
        SELECT * INTO v_profile FROM public.profiles WHERE id = NEW.user_id;

        IF FOUND THEN
            v_new_balance := v_profile.coins_balance + NEW.coins_used;

            UPDATE public.profiles
            SET coins_balance = v_new_balance
            WHERE id = NEW.user_id;

            INSERT INTO public.coin_transactions (
                user_id,
                order_id,
                amount,
                balance_after,
                type,
                description
            ) VALUES (
                NEW.user_id,
                NEW.id,
                NEW.coins_used,
                v_new_balance,
                'order_refund',
                'Hoàn lại ' || NEW.coins_used || ' Xu do đơn hàng #' || UPPER(SUBSTRING(NEW.id::text, 1, 8)) || ' đã bị hủy'
            );
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_order_delivered_award_coins ON public.orders;

CREATE TRIGGER trg_order_delivered_award_coins
BEFORE UPDATE OF status ON public.orders FOR EACH ROW
EXECUTE FUNCTION public.trg_award_coins_on_order_delivered ();

-- 7. Stored Procedure Điểm Danh Hàng Ngày Nhận Xu (Daily Check-in)
CREATE OR REPLACE FUNCTION public.claim_daily_checkin () RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_user_id UUID;
    v_profile RECORD;
    v_today DATE := CURRENT_DATE;
    v_coins_reward INT := 200; -- Mặc định 200 xu mỗi ngày
    v_new_balance INT;
    v_new_lifetime INT;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Vui lòng đăng nhập để điểm danh.');
    END IF;

    SELECT * INTO v_profile FROM public.profiles WHERE id = v_user_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'Không tìm thấy hồ sơ người dùng.');
    END IF;

    -- Kiểm tra xem hôm nay đã điểm danh chưa
    IF v_profile.last_checkin_date IS NOT NULL AND v_profile.last_checkin_date = v_today THEN
        RETURN jsonb_build_object(
            'success', false, 
            'message', 'Hôm nay bạn đã điểm danh rồi. Hãy quay lại vào ngày mai nhé!',
            'already_claimed', true,
            'coins_balance', v_profile.coins_balance
        );
    END IF;

    -- Thưởng thêm xu nếu là hạng cao
    CASE v_profile.membership_tier
        WHEN 'diamond' THEN v_coins_reward := 500;
        WHEN 'gold'    THEN v_coins_reward := 350;
        WHEN 'silver'  THEN v_coins_reward := 250;
        ELSE                v_coins_reward := 200;
    END CASE;

    v_new_balance := v_profile.coins_balance + v_coins_reward;
    v_new_lifetime := v_profile.lifetime_coins + v_coins_reward;

    -- Cập nhật profiles
    UPDATE public.profiles
    SET coins_balance = v_new_balance,
        lifetime_coins = v_new_lifetime,
        last_checkin_date = v_today
    WHERE id = v_user_id;

    -- Ghi lịch sử
    INSERT INTO public.coin_transactions (
        user_id,
        amount,
        balance_after,
        type,
        description
    ) VALUES (
        v_user_id,
        v_coins_reward,
        v_new_balance,
        'daily_checkin',
        'Điểm danh nhận xu ngày ' || TO_CHAR(v_today, 'DD/MM/YYYY')
    );

    RETURN jsonb_build_object(
        'success', true,
        'message', 'Điểm danh thành công! Bạn nhận được +' || v_coins_reward || ' Xu.',
        'reward_coins', v_coins_reward,
        'coins_balance', v_new_balance,
        'lifetime_coins', v_new_lifetime,
        'membership_tier', public.calc_membership_tier(v_new_lifetime)
    );
END;
$$;

GRANT
EXECUTE ON FUNCTION public.claim_daily_checkin () TO authenticated;

GRANT
EXECUTE ON FUNCTION public.calc_membership_tier (INT) TO anon,
authenticated,
service_role;
