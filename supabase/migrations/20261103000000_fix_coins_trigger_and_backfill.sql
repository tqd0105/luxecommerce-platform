-- Migration: Hỗ trợ tích xu và trả thưởng giới thiệu cho cả trạng thái 'delivered' và 'completed'
-- File: 20261103000000_fix_coins_trigger_and_backfill.sql

-- 1. Cập nhật Trigger function trg_award_coins_on_order_delivered
CREATE OR REPLACE FUNCTION public.trg_award_coins_on_order_delivered () 
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public
AS $$
DECLARE
    v_profile RECORD;
    v_referrer RECORD;
    v_ref_record RECORD;
    v_rate NUMERIC;
    v_coins_to_award INT := 0;
    v_new_balance INT;
    v_new_lifetime INT;
    v_ref_reward_coins INT;
    v_new_referrer_balance INT;
    v_qualifying_threshold NUMERIC := 100000; -- Mốc đơn tối thiểu 100.000đ để kích hoạt thưởng
    v_referee_name TEXT;
    v_should_award BOOLEAN := FALSE;
BEGIN
    -- Điều kiện kích hoạt:
    -- Trạng thái đơn chuyển sang 'delivered' HOẶC 'completed'
    -- VÀ (trước đó chưa là delivered/completed HOẶC đơn chưa từng được cộng xu (coins_earned = 0))
    IF (NEW.status IN ('delivered', 'completed')) 
       AND (
           OLD.status IS NULL 
           OR OLD.status NOT IN ('delivered', 'completed')
           OR COALESCE(OLD.coins_earned, 0) = 0
       )
       AND NEW.user_id IS NOT NULL 
       AND COALESCE(NEW.coins_earned, 0) = 0 
    THEN
        v_should_award := TRUE;
    END IF;

    IF v_should_award THEN
        -- PHẦN 1: TÍCH XU MUA HÀNG CHO CHÍNH NGƯỜI ĐẶT ĐƠN (BUYER / REFEREE)
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
                v_new_balance := COALESCE(v_profile.coins_balance, 0) + v_coins_to_award;
                v_new_lifetime := COALESCE(v_profile.lifetime_coins, 0) + v_coins_to_award;

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
                    v_new_referrer_balance := COALESCE(v_referrer.coins_balance, 0) + v_ref_reward_coins;

                    -- 1. Cộng xu và tăng số lượt giới thiệu thành công cho người mời
                    UPDATE public.profiles
                    SET coins_balance = v_new_referrer_balance,
                        lifetime_coins = COALESCE(lifetime_coins, 0) + v_ref_reward_coins,
                        referral_count = COALESCE(referral_count, 0) + 1
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
                        v_new_referrer_balance,
                        'referral_reward',
                        'Thưởng ' || v_ref_reward_coins || ' Xu: Giới thiệu ' || v_referee_name || ' hoàn tất đơn hàng đầu tiên'
                    );

                    -- 4. Bắn thông báo chuông cho người mời
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
            v_new_balance := COALESCE(v_profile.coins_balance, 0) + NEW.coins_used;

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

-- 2. Tái tạo Trigger để bắt cả INSERT và UPDATE OF status trên bảng orders
DROP TRIGGER IF EXISTS trg_order_delivered_award_coins ON public.orders;

CREATE TRIGGER trg_order_delivered_award_coins
BEFORE INSERT OR UPDATE OF status ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.trg_award_coins_on_order_delivered ();

-- 3. Cấp quyền thực thi hàm
GRANT EXECUTE ON FUNCTION public.trg_award_coins_on_order_delivered() TO authenticated, service_role;

-- 4. Backfill: Quét và cập nhật ngay cho các đơn hàng đã nhận hàng (delivered hoặc completed) trong quá khứ chưa được tích xu/thưởng
DO $$
DECLARE
    r_order RECORD;
    v_profile RECORD;
    v_referrer RECORD;
    v_ref_record RECORD;
    v_rate NUMERIC;
    v_coins_to_award INT;
    v_new_balance INT;
    v_new_lifetime INT;
    v_ref_reward_coins INT;
    v_new_referrer_balance INT;
    v_qualifying_threshold NUMERIC := 100000;
    v_referee_name TEXT;
BEGIN
    FOR r_order IN 
        SELECT * FROM public.orders 
        WHERE status IN ('delivered', 'completed') 
          AND user_id IS NOT NULL 
          AND COALESCE(coins_earned, 0) = 0
        ORDER BY created_at ASC
    LOOP
        -- 1. Tích xu cho người mua (buyer)
        SELECT * INTO v_profile FROM public.profiles WHERE id = r_order.user_id;
        IF FOUND THEN
            CASE v_profile.membership_tier
                WHEN 'diamond' THEN v_rate := 0.03;
                WHEN 'gold'    THEN v_rate := 0.02;
                WHEN 'silver'  THEN v_rate := 0.015;
                ELSE                v_rate := 0.01;
            END CASE;

            v_coins_to_award := FLOOR(GREATEST(0, (r_order.total_amount - COALESCE(r_order.shipping_fee, 0))) * v_rate);

            IF v_coins_to_award > 0 THEN
                v_new_balance := COALESCE(v_profile.coins_balance, 0) + v_coins_to_award;
                v_new_lifetime := COALESCE(v_profile.lifetime_coins, 0) + v_coins_to_award;

                UPDATE public.profiles
                SET coins_balance = v_new_balance,
                    lifetime_coins = v_new_lifetime
                WHERE id = r_order.user_id;

                UPDATE public.orders
                SET coins_earned = v_coins_to_award
                WHERE id = r_order.id;

                INSERT INTO public.coin_transactions (
                    user_id,
                    order_id,
                    amount,
                    balance_after,
                    type,
                    description
                ) VALUES (
                    r_order.user_id,
                    r_order.id,
                    v_coins_to_award,
                    v_new_balance,
                    'order_reward',
                    'Tích ' || v_coins_to_award || ' Xu từ đơn hàng #' || UPPER(SUBSTRING(r_order.id::text, 1, 8))
                );
            END IF;

            -- 2. Thưởng cho người giới thiệu nếu người mua có referral_records ở trạng thái 'registered'
            SELECT * INTO v_ref_record 
            FROM public.referral_records 
            WHERE referee_id = r_order.user_id AND status = 'registered'
            LIMIT 1;

            IF FOUND AND r_order.total_amount >= v_qualifying_threshold THEN
                SELECT * INTO v_referrer FROM public.profiles WHERE id = v_ref_record.referrer_id;
                IF FOUND THEN
                    v_ref_reward_coins := public.calc_referral_reward_coins(v_referrer.membership_tier);
                    v_referee_name := COALESCE(v_profile.full_name, 'bạn bè');
                    v_new_referrer_balance := COALESCE(v_referrer.coins_balance, 0) + v_ref_reward_coins;

                    UPDATE public.profiles
                    SET coins_balance = v_new_referrer_balance,
                        lifetime_coins = COALESCE(lifetime_coins, 0) + v_ref_reward_coins,
                        referral_count = COALESCE(referral_count, 0) + 1
                    WHERE id = v_referrer.id;

                    UPDATE public.referral_records
                    SET status = 'rewarded',
                        qualifying_order_id = r_order.id,
                        reward_coins = v_ref_reward_coins,
                        rewarded_at = NOW()
                    WHERE id = v_ref_record.id;

                    INSERT INTO public.coin_transactions (
                        user_id,
                        order_id,
                        amount,
                        balance_after,
                        type,
                        description
                    ) VALUES (
                        v_referrer.id,
                        r_order.id,
                        v_ref_reward_coins,
                        v_new_referrer_balance,
                        'referral_reward',
                        'Thưởng ' || v_ref_reward_coins || ' Xu: Giới thiệu ' || v_referee_name || ' hoàn tất đơn hàng đầu tiên'
                    );

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
    END LOOP;
END $$;

