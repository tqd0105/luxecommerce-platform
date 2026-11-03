-- Migration: Hệ thống Trung Tâm Đổi Quà (Rewards Center - Đổi Xu Lấy Voucher)
-- File: 20261102000000_create_rewards_center.sql

-- 1. Bổ sung loại giao dịch 'reward_exchange' vào bảng coin_transactions
ALTER TABLE public.coin_transactions 
DROP CONSTRAINT IF EXISTS coin_transactions_type_check;

ALTER TABLE public.coin_transactions
ADD CONSTRAINT coin_transactions_type_check CHECK (
    type IN (
        'order_reward',
        'order_spent',
        'order_refund',
        'daily_checkin',
        'review_reward',
        'referral_reward',
        'reward_exchange', -- Đổi xu lấy voucher ưu đãi
        'admin_adjustment'
    )
);

-- 2. Tạo bảng danh mục quà tặng đổi thưởng (rewards_catalog)
CREATE TABLE IF NOT EXISTS public.rewards_catalog (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    discount_amount NUMERIC(15, 2) NOT NULL CHECK (discount_amount > 0),
    min_order_amount NUMERIC(15, 2) NOT NULL DEFAULT 0 CHECK (min_order_amount >= 0),
    coin_cost INT NOT NULL CHECK (coin_cost > 0),
    required_tier VARCHAR(20) NOT NULL DEFAULT 'bronze' CHECK (
        required_tier IN ('bronze', 'silver', 'gold', 'diamond')
    ),
    stock_limit INT DEFAULT NULL, -- NULL là không giới hạn số lượng đổi
    redeemed_count INT NOT NULL DEFAULT 0 CHECK (redeemed_count >= 0),
    is_active BOOLEAN NOT NULL DEFAULT true,
    valid_days INT NOT NULL DEFAULT 30 CHECK (valid_days > 0), -- Thời hạn sử dụng (ngày)
    badge_label VARCHAR(50), -- Tag nhãn: "TIẾT KIỆM", "PHỔ BIẾN", "VIP ONLY"
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rewards_catalog_active ON public.rewards_catalog (is_active, coin_cost);

-- 3. Tạo bảng ví voucher cá nhân của từng khách hàng (user_vouchers)
CREATE TABLE IF NOT EXISTS public.user_vouchers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
    reward_id UUID REFERENCES public.rewards_catalog (id) ON DELETE SET NULL,
    code VARCHAR(50) UNIQUE NOT NULL, -- Mã voucher riêng tự sinh dạng REW-XXXXXXXX
    title TEXT NOT NULL,
    discount_amount NUMERIC(15, 2) NOT NULL CHECK (discount_amount > 0),
    min_order_amount NUMERIC(15, 2) NOT NULL DEFAULT 0 CHECK (min_order_amount >= 0),
    coin_spent INT NOT NULL CHECK (coin_spent >= 0),
    is_used BOOLEAN NOT NULL DEFAULT false,
    used_order_id UUID REFERENCES public.orders (id) ON DELETE SET NULL,
    used_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_vouchers_user_id ON public.user_vouchers (user_id, is_used, expires_at);
CREATE INDEX IF NOT EXISTS idx_user_vouchers_code ON public.user_vouchers (code);

-- 4. Bật Row Level Security (RLS)
ALTER TABLE public.rewards_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_vouchers ENABLE ROW LEVEL SECURITY;

-- Policy cho rewards_catalog: Khách hàng được xem danh mục quà đang active
CREATE POLICY "Public can view active rewards" ON public.rewards_catalog FOR SELECT
USING (is_active = true);

-- Policy cho rewards_catalog: Admin có toàn quyền quản trị
CREATE POLICY "Admins full access on rewards_catalog" ON public.rewards_catalog FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public.profiles p
        JOIN public.roles r ON p.role_id = r.id
        WHERE p.id = auth.uid() AND r.name = 'admin'
    )
);

-- Policy cho user_vouchers: User chỉ xem và dùng voucher của chính mình
CREATE POLICY "Users can view their own vouchers" ON public.user_vouchers FOR SELECT
USING (auth.uid() = user_id);

-- Policy cho user_vouchers: Admin có toàn quyền
CREATE POLICY "Admins full access on user_vouchers" ON public.user_vouchers FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public.profiles p
        JOIN public.roles r ON p.role_id = r.id
        WHERE p.id = auth.uid() AND r.name = 'admin'
    )
);

-- 5. Hàm phụ trợ so sánh cấp bậc Hạng thành viên
CREATE OR REPLACE FUNCTION public.tier_rank_level(p_tier VARCHAR(20))
RETURNS INT
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
    CASE p_tier
        WHEN 'diamond' THEN RETURN 4;
        WHEN 'gold'    THEN RETURN 3;
        WHEN 'silver'  THEN RETURN 2;
        ELSE                RETURN 1; -- bronze
    END CASE;
END;
$$;

-- 6. Stored Procedure An Toàn: Đổi Xu Lấy Voucher (Atomic Transaction)
CREATE OR REPLACE FUNCTION public.redeem_voucher_with_coins(p_reward_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID;
    v_reward RECORD;
    v_profile RECORD;
    v_new_balance INT;
    v_voucher_code VARCHAR(50);
    v_exists BOOLEAN;
    v_user_tier_rank INT;
    v_req_tier_rank INT;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Vui lòng đăng nhập để đổi quà.');
    END IF;

    -- 1. Khóa hàng quà tặng để kiểm tra số lượng và tính hợp lệ (FOR UPDATE)
    SELECT * INTO v_reward 
    FROM public.rewards_catalog 
    WHERE id = p_reward_id AND is_active = true 
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'Món quà này không tồn tại hoặc đã ngừng áp dụng.');
    END IF;

    -- 2. Kiểm tra giới hạn số lượng còn lại (nếu có giới hạn)
    IF v_reward.stock_limit IS NOT NULL AND v_reward.redeemed_count >= v_reward.stock_limit THEN
        RETURN jsonb_build_object('success', false, 'message', 'Món quà này đã hết lượt đổi. Hãy quay lại sau nhé!');
    END IF;

    -- 3. Khóa hàng người dùng để kiểm tra số dư và hạng (FOR UPDATE chống trừ 2 lần)
    SELECT * INTO v_profile 
    FROM public.profiles 
    WHERE id = v_user_id 
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'Không tìm thấy hồ sơ người dùng.');
    END IF;

    -- 4. Kiểm tra điều kiện Hạng thành viên
    v_user_tier_rank := public.tier_rank_level(v_profile.membership_tier);
    v_req_tier_rank := public.tier_rank_level(v_reward.required_tier);

    IF v_user_tier_rank < v_req_tier_rank THEN
        RETURN jsonb_build_object(
            'success', false, 
            'message', 'Món quà này chỉ dành riêng cho thành viên hạng ' || UPPER(v_reward.required_tier) || ' trở lên!'
        );
    END IF;

    -- 5. Kiểm tra số dư Xu
    IF v_profile.coins_balance < v_reward.coin_cost THEN
        RETURN jsonb_build_object(
            'success', false, 
            'message', 'Bạn không đủ Xu để đổi quà. Bạn có ' || v_profile.coins_balance || ' Xu, cần ' || v_reward.coin_cost || ' Xu.'
        );
    END IF;

    -- 6. Tính số dư mới và trừ xu của người dùng
    v_new_balance := v_profile.coins_balance - v_reward.coin_cost;

    UPDATE public.profiles
    SET coins_balance = v_new_balance
    WHERE id = v_user_id;

    -- 7. Ghi lịch sử biến động xu vào coin_transactions
    INSERT INTO public.coin_transactions (
        user_id,
        amount,
        balance_after,
        type,
        description
    ) VALUES (
        v_user_id,
        -v_reward.coin_cost,
        v_new_balance,
        'reward_exchange',
        'Đổi ' || v_reward.coin_cost || ' Xu lấy: ' || v_reward.title
    );

    -- 8. Sinh mã Voucher độc quyền ngẫu nhiên (Ví dụ: REW-9A4B8F)
    LOOP
        v_voucher_code := 'REW-' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 8));
        SELECT EXISTS(SELECT 1 FROM public.user_vouchers WHERE code = v_voucher_code) INTO v_exists;
        EXIT WHEN NOT v_exists;
    END LOOP;

    -- 9. Cấp Voucher vào ví cá nhân (user_vouchers)
    INSERT INTO public.user_vouchers (
        user_id,
        reward_id,
        code,
        title,
        discount_amount,
        min_order_amount,
        coin_spent,
        expires_at
    ) VALUES (
        v_user_id,
        v_reward.id,
        v_voucher_code,
        v_reward.title,
        v_reward.discount_amount,
        v_reward.min_order_amount,
        v_reward.coin_cost,
        NOW() + (v_reward.valid_days || ' days')::INTERVAL
    );

    -- 10. Tăng số lượng đã đổi trong rewards_catalog
    UPDATE public.rewards_catalog
    SET redeemed_count = redeemed_count + 1
    WHERE id = v_reward.id;

    -- 11. Bắn thông báo chúc mừng vào hòm thư
    BEGIN
        INSERT INTO public.notifications (
            user_id,
            title,
            message,
            type,
            link
        ) VALUES (
            v_user_id,
            '🎉 Đổi quà thành công!',
            'Bạn vừa đổi thành công ' || v_reward.title || '. Mã voucher: ' || v_voucher_code || ' (Hạn ' || v_reward.valid_days || ' ngày).',
            'order',
            '/account/coins'
        );
    EXCEPTION WHEN OTHERS THEN
        NULL;
    END;

    RETURN jsonb_build_object(
        'success', true,
        'message', 'Đổi voucher thành công! Mã đã được lưu vào Ví của bạn.',
        'voucher_code', v_voucher_code,
        'title', v_reward.title,
        'discount_amount', v_reward.discount_amount,
        'new_balance', v_new_balance
    );
END;
$$;

-- 7. Seed dữ liệu mẫu ban đầu cho danh mục quà tặng (5 gói quà hấp dẫn)
INSERT INTO public.rewards_catalog (
    title, description, discount_amount, min_order_amount, coin_cost, required_tier, stock_limit, valid_days, badge_label
) VALUES 
(
    'Voucher Khởi Đầu 20K',
    'Giảm ngay 20.000đ cho đơn hàng từ 200.000đ',
    20000, 200000, 2000, 'bronze', NULL, 30, 'TIẾT KIỆM'
),
(
    'Voucher Mua Sắm 50K',
    'Giảm ngay 50.000đ cho đơn hàng từ 400.000đ',
    50000, 400000, 5000, 'bronze', NULL, 30, 'PHỔ BIẾN'
),
(
    'Voucher Freeship 35K',
    'Hỗ trợ tối đa 35.000đ phí vận chuyển toàn quốc',
    35000, 300000, 3500, 'silver', 100, 15, 'FREESHIP'
),
(
    'Đặc Quyền VIP Gold 100K',
    'Giảm cực sốc 100.000đ cho đơn hàng từ 700.000đ',
    100000, 700000, 8000, 'gold', 50, 30, 'VIP GOLD'
),
(
    'Đặc Quyền VIP Diamond 200K',
    'Giảm tối đa 200.000đ cho đơn hàng từ 1.200.000đ',
    200000, 1200000, 15000, 'diamond', 20, 30, 'VIP DIAMOND'
)
ON CONFLICT DO NOTHING;

