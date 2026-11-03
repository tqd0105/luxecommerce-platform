-- Migration: Hệ thống Giới thiệu bạn bè (Referral & Viral Growth Program)
-- File: 20261101000000_create_referral_system.sql

-- 1. Bổ sung các cột phục vụ Giới thiệu vào bảng profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS referral_code VARCHAR(30) UNIQUE,
ADD COLUMN IF NOT EXISTS referred_by UUID REFERENCES public.profiles (id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS referral_count INT NOT NULL DEFAULT 0 CHECK (referral_count >= 0),
ADD COLUMN IF NOT EXISTS has_customized_referral_code BOOLEAN NOT NULL DEFAULT FALSE;

-- Index tăng tốc tìm kiếm hồ sơ theo mã giới thiệu khi khách đăng ký qua link
CREATE INDEX IF NOT EXISTS idx_profiles_referral_code ON public.profiles (referral_code);
CREATE INDEX IF NOT EXISTS idx_profiles_referred_by ON public.profiles (referred_by);

-- 2. Hàm sinh mã giới thiệu ngẫu nhiên duy nhất (Ví dụ: LUXE-363F88)
CREATE OR REPLACE FUNCTION public.generate_unique_referral_code()
RETURNS VARCHAR(30)
LANGUAGE plpgsql
AS $$
DECLARE
    v_code VARCHAR(30);
    v_exists BOOLEAN;
BEGIN
    LOOP
        -- Sinh mã tiền tố LUXE- kèm 6 ký tự hex in hoa ngẫu nhiên
        v_code := 'LUXE-' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 6));
        
        SELECT EXISTS(SELECT 1 FROM public.profiles WHERE referral_code = v_code) INTO v_exists;
        EXIT WHEN NOT v_exists;
    END LOOP;
    RETURN v_code;
END;
$$;

-- 3. Cập nhật Trigger tự động cấp referral_code cho tài khoản mới nếu chưa có
CREATE OR REPLACE FUNCTION public.trg_assign_referral_code_to_new_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.referral_code IS NULL OR TRIM(NEW.referral_code) = '' THEN
        NEW.referral_code := public.generate_unique_referral_code();
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_assign_referral_code ON public.profiles;

CREATE TRIGGER trg_profiles_assign_referral_code
BEFORE INSERT ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.trg_assign_referral_code_to_new_profile();

-- 4. Backfill (Cấp mã giới thiệu cho toàn bộ người dùng hiện có trong database)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN SELECT id FROM public.profiles WHERE referral_code IS NULL OR referral_code = '' LOOP
        UPDATE public.profiles
        SET referral_code = public.generate_unique_referral_code()
        WHERE id = r.id;
    END LOOP;
END $$;

-- 5. Bảng ghi nhận quan hệ và tiến trình giới thiệu (referral_records)
CREATE TABLE IF NOT EXISTS public.referral_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    referrer_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
    referee_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
    status VARCHAR(30) NOT NULL DEFAULT 'registered' CHECK (
        status IN ('registered', 'rewarded', 'cancelled')
    ),
    qualifying_order_id UUID REFERENCES public.orders (id) ON DELETE SET NULL,
    reward_coins INT NOT NULL DEFAULT 10000 CHECK (reward_coins >= 0),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    rewarded_at TIMESTAMPTZ,
    CONSTRAINT chk_no_self_referral CHECK (referrer_id != referee_id),
    CONSTRAINT uq_referee UNIQUE (referee_id) -- Mỗi người chỉ được người khác giới thiệu 1 lần
);

-- Index tăng tốc truy vấn lịch sử giới thiệu của người mời
CREATE INDEX IF NOT EXISTS idx_referral_records_referrer_id ON public.referral_records (referrer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_referral_records_referee_id ON public.referral_records (referee_id);
CREATE INDEX IF NOT EXISTS idx_referral_records_qualifying_order_id ON public.referral_records (qualifying_order_id);

-- 6. Bật Row Level Security (RLS) cho referral_records
ALTER TABLE public.referral_records ENABLE ROW LEVEL SECURITY;

-- Policy: Khách hàng được xem danh sách những người mình đã mời
CREATE POLICY "Users can view their own referrals" ON public.referral_records FOR
SELECT
    USING (auth.uid() = referrer_id OR auth.uid() = referee_id);

-- Policy: Admin có toàn quyền
CREATE POLICY "Admins have full access on referral_records" ON public.referral_records FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public.profiles p
        JOIN public.roles r ON p.role_id = r.id
        WHERE p.id = auth.uid() AND r.name = 'admin'
    )
);

-- Policy: Service role / Authenticated user có thể insert khi đăng ký
CREATE POLICY "Allow insert referral records" ON public.referral_records FOR INSERT
WITH CHECK (
    auth.uid() = referee_id
    OR EXISTS (
        SELECT 1 FROM public.profiles p
        JOIN public.roles r ON p.role_id = r.id
        WHERE p.id = auth.uid() AND r.name = 'admin'
    )
);

-- 7. Cập nhật ràng buộc type của coin_transactions để chấp nhận 'referral_reward'
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
        'referral_reward', -- Bổ sung loại giao dịch thưởng giới thiệu
        'admin_adjustment'
    )
);

-- 8. Stored Procedure cho phép người dùng đổi mã giới thiệu riêng (Vanity Code) 1 lần
CREATE OR REPLACE FUNCTION public.customize_referral_code(p_new_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID;
    v_profile RECORD;
    v_cleaned_code VARCHAR(30);
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Vui lòng đăng nhập để thực hiện.');
    END IF;

    SELECT * INTO v_profile FROM public.profiles WHERE id = v_user_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'Không tìm thấy hồ sơ người dùng.');
    END IF;

    -- Kiểm tra xem người dùng đã từng đổi mã chưa
    IF v_profile.has_customized_referral_code = TRUE THEN
        RETURN jsonb_build_object('success', false, 'message', 'Bạn chỉ được đổi mã giới thiệu cá nhân hóa 1 lần duy nhất.');
    END IF;

    -- Chuẩn hóa mã: Viết hoa, loại bỏ khoảng trắng
    v_cleaned_code := UPPER(REGEXP_REPLACE(TRIM(p_new_code), '[^a-zA-Z0-9_-]', '', 'g'));

    -- Kiểm tra độ dài mã (từ 4 đến 20 ký tự)
    IF LENGTH(v_cleaned_code) < 4 OR LENGTH(v_cleaned_code) > 20 THEN
        RETURN jsonb_build_object('success', false, 'message', 'Mã giới thiệu phải có độ dài từ 4 đến 20 ký tự (chữ cái và số).');
    END IF;

    -- Kiểm tra xem mã đã bị ai sử dụng chưa
    IF EXISTS (SELECT 1 FROM public.profiles WHERE referral_code = v_cleaned_code AND id != v_user_id) THEN
        RETURN jsonb_build_object('success', false, 'message', 'Mã giới thiệu này đã có người sử dụng. Vui lòng chọn mã khác.');
    END IF;

    -- Cập nhật mã và đánh dấu đã tùy chỉnh
    UPDATE public.profiles
    SET referral_code = v_cleaned_code,
        has_customized_referral_code = TRUE
    WHERE id = v_user_id;

    RETURN jsonb_build_object(
        'success', true,
        'message', 'Đổi mã giới thiệu thành công!',
        'new_code', v_cleaned_code
    );
END;
$$;

-- 9. Hàm tính số xu thưởng giới thiệu theo Hạng VIP của người mời
CREATE OR REPLACE FUNCTION public.calc_referral_reward_coins(p_tier VARCHAR(20))
RETURNS INT
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
    CASE p_tier
        WHEN 'diamond' THEN RETURN 20000; -- Hạng Kim Cương: 20.000 Xu
        WHEN 'gold'    THEN RETURN 15000; -- Hạng Vàng: 15.000 Xu
        WHEN 'silver'  THEN RETURN 12000; -- Hạng Bạc: 12.000 Xu
        ELSE                RETURN 10000; -- Hạng Đồng: 10.000 Xu
    END CASE;
END;
$$;

-- 10. Tích hợp trao thưởng giới thiệu vào Trigger trg_award_coins_on_order_delivered
CREATE OR REPLACE FUNCTION public.trg_award_coins_on_order_delivered () 
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER 
AS $$
DECLARE
    v_profile RECORD;
    v_referrer RECORD;
    v_ref_record RECORD;
    v_rate NUMERIC;
    v_coins_to_award INT;
    v_new_balance INT;
    v_new_lifetime INT;
    v_ref_reward_coins INT;
    v_qualifying_threshold NUMERIC := 100000; -- Mốc đơn tối thiểu 100.000đ để kích hoạt thưởng
    v_referee_name TEXT;
BEGIN
    -- PHẦN 1: TÍCH XU MUA HÀNG CHO CHÍNH NGƯỜI ĐẶT ĐƠN (LOGIC CŨ ĐÃ CÓ)
    IF NEW.status = 'delivered' AND (OLD.status IS NULL OR OLD.status != 'delivered') AND NEW.user_id IS NOT NULL AND NEW.coins_earned = 0 THEN
        SELECT * INTO v_profile FROM public.profiles WHERE id = NEW.user_id;

        IF FOUND THEN
            CASE v_profile.membership_tier
                WHEN 'diamond' THEN v_rate := 0.03;
                WHEN 'gold'    THEN v_rate := 0.02;
                WHEN 'silver'  THEN v_rate := 0.015;
                ELSE                v_rate := 0.01;
            END CASE;

            v_coins_to_award := FLOOR(GREATEST(0, (NEW.total_amount - COALESCE(NEW.shipping_fee, 0))) * v_rate);

            IF v_coins_to_award > 0 THEN
                v_new_balance := v_profile.coins_balance + v_coins_to_award;
                v_new_lifetime := v_profile.lifetime_coins + v_coins_to_award;

                UPDATE public.profiles
                SET coins_balance = v_new_balance,
                    lifetime_coins = v_new_lifetime
                WHERE id = NEW.user_id;

                NEW.coins_earned := v_coins_to_award;

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

            -- PHẦN 2: KIỂM TRA VÀ THƯỞNG CHO NGƯỜI GIỚI THIỆU (REFERRAL REWARD)
            -- Kiểm tra xem người đặt đơn có người giới thiệu đang ở trạng thái 'registered' không
            SELECT * INTO v_ref_record 
            FROM public.referral_records 
            WHERE referee_id = NEW.user_id AND status = 'registered'
            LIMIT 1;

            -- Nếu có quan hệ giới thiệu và đơn hàng đạt tối thiểu 100.000đ
            IF FOUND AND NEW.total_amount >= v_qualifying_threshold THEN
                SELECT * INTO v_referrer FROM public.profiles WHERE id = v_ref_record.referrer_id;
                
                IF FOUND THEN
                    -- Tính số xu thưởng theo hạng VIP của người mời
                    v_ref_reward_coins := public.calc_referral_reward_coins(v_referrer.membership_tier);
                    v_referee_name := COALESCE(v_profile.full_name, 'bạn bè');

                    -- 1. Cộng xu cho người mời
                    UPDATE public.profiles
                    SET coins_balance = coins_balance + v_ref_reward_coins,
                        lifetime_coins = lifetime_coins + v_ref_reward_coins,
                        referral_count = referral_count + 1
                    WHERE id = v_referrer.id;

                    -- 2. Cập nhật bản ghi giới thiệu sang 'rewarded'
                    UPDATE public.referral_records
                    SET status = 'rewarded',
                        qualifying_order_id = NEW.id,
                        reward_coins = v_ref_reward_coins,
                        rewarded_at = NOW()
                    WHERE id = v_ref_record.id;

                    -- 3. Ghi lịch sử xu cho người mời
                    INSERT INTO public.coin_transactions (
                        user_id,
                        order_id,
                        amount,
                        balance_after,
                        type,
                        description
                    ) VALUES (
                        v_referrer.id,
                        NEW.id,
                        v_ref_reward_coins,
                        v_referrer.coins_balance + v_ref_reward_coins,
                        'referral_reward',
                        'Thưởng ' || v_ref_reward_coins || ' Xu: Giới thiệu ' || v_referee_name || ' hoàn tất đơn hàng đầu tiên'
                    );

                    -- 4. Bắn thông báo chuông cho người mời (nếu bảng notifications tồn tại)
                    BEGIN
                        INSERT INTO public.notifications (
                            user_id,
                            title,
                            message,
                            type,
                            link
                        ) VALUES (
                            v_referrer.id,
                            '🎁 Nhận thưởng giới thiệu bạn bè!',
                            'Bạn vừa nhận được +' || v_ref_reward_coins || ' Xu khi ' || v_referee_name || ' hoàn thành đơn hàng đầu tiên!',
                            'order',
                            '/account/coins'
                        );
                    EXCEPTION WHEN OTHERS THEN
                        NULL;
                    END;
                END IF;
            END IF;
        END IF;
    END IF;

    -- PHẦN 3: HOÀN LẠI XU NẾU ĐƠN BỊ HỦY (LOGIC CŨ ĐÃ CÓ)
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

-- 11. Stored Procedure lấy thông tin công khai của người giới thiệu khi khách vào web bằng link (?ref=CODE)
CREATE OR REPLACE FUNCTION public.get_referrer_preview(p_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_referrer RECORD;
    v_cleaned_code VARCHAR(30);
BEGIN
    v_cleaned_code := UPPER(TRIM(p_code));

    SELECT id, full_name, membership_tier, referral_code
    INTO v_referrer
    FROM public.profiles
    WHERE UPPER(referral_code) = v_cleaned_code;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'Mã giới thiệu không tồn tại.');
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'referrer_name', COALESCE(v_referrer.full_name, 'Thành viên Luxe VIP'),
        'membership_tier', v_referrer.membership_tier,
        'referral_code', v_referrer.referral_code
    );
END;
$$;

-- 12. Stored Procedure liên kết người được mời với người giới thiệu (apply_referral_code)
CREATE OR REPLACE FUNCTION public.apply_referral_code(p_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_referee_id UUID;
    v_referee RECORD;
    v_referrer RECORD;
    v_cleaned_code VARCHAR(30);
BEGIN
    v_referee_id := auth.uid();
    IF v_referee_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Vui lòng đăng nhập để áp dụng mã giới thiệu.');
    END IF;

    -- Kiểm tra hồ sơ người được mời
    SELECT * INTO v_referee FROM public.profiles WHERE id = v_referee_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'Không tìm thấy hồ sơ người dùng.');
    END IF;

    -- Nếu đã có người giới thiệu từ trước, không cho phép đổi
    IF v_referee.referred_by IS NOT NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Tài khoản của bạn đã được liên kết với một người giới thiệu trước đó.');
    END IF;

    v_cleaned_code := UPPER(TRIM(p_code));

    -- Tìm thông tin người giới thiệu
    SELECT * INTO v_referrer FROM public.profiles WHERE UPPER(referral_code) = v_cleaned_code;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'Mã giới thiệu không hợp lệ hoặc không tồn tại.');
    END IF;

    -- Chặn tự mời chính mình
    IF v_referrer.id = v_referee_id THEN
        RETURN jsonb_build_object('success', false, 'message', 'Bạn không thể tự nhập mã giới thiệu của chính mình.');
    END IF;

    -- Cập nhật vào bảng profiles
    UPDATE public.profiles
    SET referred_by = v_referrer.id
    WHERE id = v_referee_id;

    -- Tạo bản ghi trong referral_records (nếu chưa có)
    INSERT INTO public.referral_records (
        referrer_id,
        referee_id,
        status,
        reward_coins
    ) VALUES (
        v_referrer.id,
        v_referee_id,
        'registered',
        public.calc_referral_reward_coins(v_referrer.membership_tier)
    )
    ON CONFLICT (referee_id) DO NOTHING;

    -- Gửi thông báo cho người mời biết có bạn mới tham gia
    BEGIN
        INSERT INTO public.notifications (
            user_id,
            title,
            message,
            type,
            link
        ) VALUES (
            v_referrer.id,
            '👋 Bạn có lời mời mới!',
            COALESCE(v_referee.full_name, 'Một người bạn') || ' vừa đăng ký tài khoản qua liên kết giới thiệu của bạn.',
            'order',
            '/account/referrals'
        );
    EXCEPTION WHEN OTHERS THEN
        NULL;
    END;

    RETURN jsonb_build_object(
        'success', true,
        'message', 'Áp dụng mã giới thiệu thành công!',
        'referrer_name', COALESCE(v_referrer.full_name, 'Thành viên Luxe VIP'),
        'membership_tier', v_referrer.membership_tier
    );
END;
$$;

-- 13. Phân quyền thực thi (GRANT EXECUTE) cho người dùng
GRANT EXECUTE ON FUNCTION public.customize_referral_code(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_referrer_preview(TEXT) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.apply_referral_code(TEXT) TO authenticated;

-- 14. Yêu cầu PostgREST nạp lại schema cache ngay lập tức
NOTIFY pgrst, 'reload schema';

