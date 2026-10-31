import { supabase } from "@/lib/supabase/client";

export type MembershipTier = "bronze" | "silver" | "gold" | "diamond";

export type CoinTransactionType =
  | "order_reward"
  | "order_spent"
  | "order_refund"
  | "daily_checkin"
  | "review_reward"
  | "admin_adjustment";

export interface CoinTransaction {
  id: string;
  user_id: string;
  order_id?: string | null;
  amount: number;
  balance_after: number;
  type: CoinTransactionType;
  description: string;
  created_at: string;
}

export interface TierBenefit {
  tier: MembershipTier;
  name: string;
  label: string;
  minPoints: number;
  nextTier?: MembershipTier;
  nextTierMinPoints?: number;
  rewardRate: number; // Tỷ lệ tích xu: 0.01 = 1%
  rewardRateLabel: string;
  dailyReward: number; // Điểm danh hàng ngày: 200, 300, 400, 500 xu
  shippingDiscountPercent: number; // 0, 50, 100
  shippingDiscountLabel: string;
  badgeClass: string;
  cardGradient: string;
  iconName: string;
}

export const TIER_CONFIGS: Record<MembershipTier, TierBenefit> = {
  bronze: {
    tier: "bronze",
    name: "Đồng",
    label: "Thành viên Đồng",
    minPoints: 0,
    nextTier: "silver",
    nextTierMinPoints: 5000,
    rewardRate: 0.01,
    rewardRateLabel: "Tích 1% Xu mỗi đơn",
    dailyReward: 200,
    shippingDiscountPercent: 0,
    shippingDiscountLabel: "Phí ship tiêu chuẩn",
    badgeClass: "bg-amber-700/15 text-amber-800 dark:text-amber-400 border-amber-700/30",
    cardGradient: "from-[#8B5A2B] via-[#A0522D] to-[#6E3C1B]",
    iconName: "🥉",
  },
  silver: {
    tier: "silver",
    name: "Bạc",
    label: "Thành viên Bạc",
    minPoints: 5000,
    nextTier: "gold",
    nextTierMinPoints: 20000,
    rewardRate: 0.015,
    rewardRateLabel: "Tích 1.5% Xu mỗi đơn",
    dailyReward: 300,
    shippingDiscountPercent: 0,
    shippingDiscountLabel: "Tặng Voucher sinh nhật 5%",
    badgeClass: "bg-slate-300/30 text-slate-700 dark:text-slate-200 border-slate-400/40",
    cardGradient: "from-[#718096] via-[#A0AEC0] to-[#4A5568]",
    iconName: "🥈",
  },
  gold: {
    tier: "gold",
    name: "Vàng",
    label: "Thành viên Vàng",
    minPoints: 20000,
    nextTier: "diamond",
    nextTierMinPoints: 50000,
    rewardRate: 0.02,
    rewardRateLabel: "Tích 2% Xu mỗi đơn",
    dailyReward: 400,
    shippingDiscountPercent: 50,
    shippingDiscountLabel: "Giảm 50% phí vận chuyển",
    badgeClass: "bg-yellow-500/20 text-yellow-700 dark:text-yellow-400 border-yellow-500/40",
    cardGradient: "from-[#D4AF37] via-[#F3E5AB] to-[#AA771C]",
    iconName: "🥇",
  },
  diamond: {
    tier: "diamond",
    name: "Kim Cương",
    label: "Thành viên Kim Cương",
    minPoints: 50000,
    nextTier: undefined,
    nextTierMinPoints: undefined,
    rewardRate: 0.03,
    rewardRateLabel: "Tích 3% Xu mỗi đơn",
    dailyReward: 500,
    shippingDiscountPercent: 100,
    shippingDiscountLabel: "Freeship toàn quốc mọi đơn",
    badgeClass: "bg-blue-500/20 text-blue-600 dark:text-blue-400 border-blue-500/40",
    cardGradient: "from-[#1E293B] via-[#0F172A] to-[#0284C7]",
    iconName: "💎",
  },
};

export interface LoyaltyProfile {
  coinsBalance: number;
  lifetimeCoins: number;
  tier: MembershipTier;
  tierConfig: TierBenefit;
  nextTier?: MembershipTier;
  nextTierConfig?: TierBenefit;
  pointsToNextTier: number;
  progressPercent: number;
  lastCheckinDate?: string | null;
  hasCheckedInToday: boolean;
}

/**
 * Lấy hồ sơ Tích xu & Hạng thành viên của người dùng
 */
export async function getLoyaltyProfile(userId?: string): Promise<{
  data: LoyaltyProfile | null;
  error: any;
}> {
  try {
    let targetUserId = userId;
    if (!targetUserId) {
      const { data: authData } = await supabase.auth.getUser();
      targetUserId = authData.user?.id;
    }

    if (!targetUserId) {
      return { data: null, error: new Error("Chưa đăng nhập") };
    }

    const { data: profile, error } = await supabase
      .from("profiles")
      .select("coins_balance, lifetime_coins, membership_tier, last_checkin_date")
      .eq("id", targetUserId)
      .single();

    if (error || !profile) {
      return { data: null, error };
    }

    const tier = (profile.membership_tier as MembershipTier) || "bronze";
    const tierConfig = TIER_CONFIGS[tier] || TIER_CONFIGS.bronze;

    let nextTier: MembershipTier | undefined;
    let nextTierConfig: TierBenefit | undefined;
    let pointsToNextTier = 0;
    let progressPercent = 100;

    if (tier === "bronze") {
      nextTier = "silver";
    } else if (tier === "silver") {
      nextTier = "gold";
    } else if (tier === "gold") {
      nextTier = "diamond";
    }

    if (nextTier) {
      nextTierConfig = TIER_CONFIGS[nextTier];
      const currentTierMin = tierConfig.minPoints;
      const targetMin = nextTierConfig.minPoints;
      const range = targetMin - currentTierMin;
      const gained = Math.max(0, profile.lifetime_coins - currentTierMin);

      pointsToNextTier = Math.max(0, targetMin - profile.lifetime_coins);
      progressPercent = Math.min(100, Math.max(0, Math.round((gained / range) * 100)));
    }

    const todayStr = new Date().toISOString().split("T")[0];
    const hasCheckedInToday = profile.last_checkin_date === todayStr;

    return {
      data: {
        coinsBalance: profile.coins_balance || 0,
        lifetimeCoins: profile.lifetime_coins || 0,
        tier,
        tierConfig,
        nextTier,
        nextTierConfig,
        pointsToNextTier,
        progressPercent,
        lastCheckinDate: profile.last_checkin_date,
        hasCheckedInToday,
      },
      error: null,
    };
  } catch (err) {
    return { data: null, error: err };
  }
}

/**
 * Lấy lịch sử biến động Xu của người dùng
 */
export async function getCoinTransactions(
  userId?: string,
  limit = 20
): Promise<{ data: CoinTransaction[] | null; error: any }> {
  try {
    let targetUserId = userId;
    if (!targetUserId) {
      const { data: authData } = await supabase.auth.getUser();
      targetUserId = authData.user?.id;
    }

    if (!targetUserId) {
      return { data: [], error: null };
    }

    const { data, error } = await supabase
      .from("coin_transactions")
      .select("*")
      .eq("user_id", targetUserId)
      .order("created_at", { ascending: false })
      .limit(limit);

    return { data, error };
  } catch (err) {
    return { data: null, error: err };
  }
}

/**
 * Điểm danh nhận Xu hàng ngày
 */
export async function claimDailyCheckin(): Promise<{
  success: boolean;
  message: string;
  rewardCoins?: number;
  coinsBalance?: number;
  lifetimeCoins?: number;
  membershipTier?: string;
  alreadyClaimed?: boolean;
}> {
  try {
    const { data, error } = await supabase.rpc("claim_daily_checkin");
    if (error) {
      return { success: false, message: error.message };
    }
    return data;
  } catch (err: any) {
    return { success: false, message: err.message || "Lỗi khi điểm danh" };
  }
}

/**
 * Tính toán số tiền được giảm từ Xu (1 Xu = 1 VNĐ, tối đa 50% tiền hàng)
 */
export function calculateCoinDiscount(params: {
  coinsToUse: number;
  subtotal: number;
  userBalance: number;
  maxPercent?: number; // Mặc định tối đa 50%
}) {
  const { coinsToUse, subtotal, userBalance, maxPercent = 0.5 } = params;

  // Số xu tối đa được phép dùng theo giới hạn đơn hàng
  const maxCoinsAllowedByOrder = Math.floor(subtotal * maxPercent);

  // Số xu thực tế có thể dùng (không vượt quá số dư ví và không vượt quá trần đơn hàng)
  const effectiveCoins = Math.max(
    0,
    Math.min(coinsToUse, userBalance, maxCoinsAllowedByOrder)
  );

  const discountAmount = effectiveCoins; // 1 Xu = 1 VNĐ
  const remainingSubtotal = Math.max(0, subtotal - discountAmount);

  return {
    effectiveCoins,
    discountAmount,
    remainingSubtotal,
    maxCoinsAllowedByOrder,
  };
}
