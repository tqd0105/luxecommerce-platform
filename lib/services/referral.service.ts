import { supabase } from "@/lib/supabase/client";
import { MembershipTier, TIER_CONFIGS } from "./loyalty.service";

export interface ReferralRecordItem {
  id: string;
  referee_id: string;
  referee_name: string;
  referee_avatar?: string | null;
  status: "registered" | "rewarded" | "cancelled";
  reward_coins: number;
  created_at: string;
  rewarded_at?: string | null;
}

export interface ReferralDashboardData {
  referralCode: string;
  hasCustomizedCode: boolean;
  membershipTier: MembershipTier;
  rewardPerReferral: number;
  totalReferrals: number;
  successfulReferrals: number;
  pendingReferrals: number;
  totalCoinsEarned: number;
  referralHistory: ReferralRecordItem[];
}

export interface ReferrerPreview {
  success: boolean;
  referrer_name?: string;
  membership_tier?: MembershipTier;
  referral_code?: string;
  message?: string;
}

const REFERRAL_COOKIE_KEY = "luxe_referral_code";

/**
 * Lưu mã giới thiệu vào Cookie và LocalStorage (Thời hạn 30 ngày)
 */
export function saveReferralCookie(code: string): void {
  if (typeof window === "undefined" || !code) return;
  const cleaned = code.trim().toUpperCase();
  try {
    localStorage.setItem(REFERRAL_COOKIE_KEY, cleaned);
    const maxAge = 30 * 24 * 60 * 60; // 30 ngày
    document.cookie = `${REFERRAL_COOKIE_KEY}=${encodeURIComponent(cleaned)}; path=/; max-age=${maxAge}; SameSite=Lax`;
  } catch (e) {
    console.error("Lỗi khi lưu mã giới thiệu:", e);
  }
}

/**
 * Lấy mã giới thiệu đang được lưu từ Cookie hoặc LocalStorage
 */
export function getSavedReferralCode(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const fromLocal = localStorage.getItem(REFERRAL_COOKIE_KEY);
    if (fromLocal) return fromLocal.toUpperCase();

    const match = document.cookie.match(new RegExp("(^| )" + REFERRAL_COOKIE_KEY + "=([^;]+)"));
    if (match) return decodeURIComponent(match[2]).toUpperCase();
  } catch (e) {
    console.error("Lỗi khi đọc mã giới thiệu:", e);
  }
  return null;
}

/**
 * Xóa mã giới thiệu đã lưu (khi đã áp dụng thành công)
 */
export function clearSavedReferralCode(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(REFERRAL_COOKIE_KEY);
    document.cookie = `${REFERRAL_COOKIE_KEY}=; path=/; max-age=0; SameSite=Lax`;
  } catch (e) { }
}

/**
 * Lấy thông tin công khai của người mời khi khách truy cập ?ref=CODE
 */
export async function getReferrerPreview(code: string): Promise<ReferrerPreview> {
  try {
    if (!code || !code.trim()) {
      return { success: false, message: "Mã giới thiệu không hợp lệ" };
    }

    const { data, error } = await supabase.rpc("get_referrer_preview", {
      p_code: code.trim(),
    });

    if (error) {
      return { success: false, message: error.message };
    }

    return data as ReferrerPreview;
  } catch (err: any) {
    return { success: false, message: err.message || "Lỗi tra cứu mã giới thiệu" };
  }
}

/**
 * Liên kết tài khoản hiện tại với người giới thiệu
 */
export async function applyReferralCode(code: string): Promise<{
  success: boolean;
  message: string;
  referrer_name?: string;
  membership_tier?: MembershipTier;
}> {
  try {
    if (!code || !code.trim()) {
      return { success: false, message: "Vui lòng nhập mã giới thiệu." };
    }

    // 1. Thử gọi RPC
    const { data, error } = await supabase.rpc("apply_referral_code", {
      p_code: code.trim(),
    });

    if (!error && data?.success) {
      clearSavedReferralCode();
      return data;
    }

    // 2. Fallback nếu RPC chưa nạp vào schema cache
    const { data: authData } = await supabase.auth.getUser();
    const user = authData?.user;
    if (!user) {
      return { success: false, message: "Vui lòng đăng nhập để áp dụng mã giới thiệu." };
    }

    const { data: myProfile } = await supabase
      .from("profiles")
      .select("referred_by")
      .eq("id", user.id)
      .single();

    if (myProfile?.referred_by) {
      return {
        success: false,
        message: "Tài khoản của bạn đã được liên kết với một người giới thiệu trước đó.",
      };
    }

    const cleaned = code.trim().toUpperCase();
    const { data: referrer } = await supabase
      .from("profiles")
      .select("id, full_name, membership_tier")
      .eq("referral_code", cleaned)
      .maybeSingle();

    if (!referrer) {
      return { success: false, message: "Mã giới thiệu không tồn tại hoặc không hợp lệ." };
    }

    if (referrer.id === user.id) {
      return { success: false, message: "Bạn không thể tự nhập mã của chính mình." };
    }

    const { error: updateErr } = await supabase
      .from("profiles")
      .update({ referred_by: referrer.id })
      .eq("id", user.id);

    if (updateErr) {
      return { success: false, message: updateErr.message };
    }

    clearSavedReferralCode();
    return {
      success: true,
      message: "Áp dụng mã giới thiệu thành công!",
      referrer_name: referrer.full_name || "Thành viên Luxe VIP",
      membership_tier: referrer.membership_tier as MembershipTier,
    };
  } catch (err: any) {
    return { success: false, message: err.message || "Không thể áp dụng mã giới thiệu." };
  }
}

/**
 * Tùy chỉnh mã giới thiệu cá nhân hóa (Vanity Code, chỉ được đổi 1 lần)
 */
export async function customizeReferralCode(newCode: string): Promise<{
  success: boolean;
  message: string;
  new_code?: string;
}> {
  try {
    const cleanedCode = newCode.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "");
    if (cleanedCode.length < 4 || cleanedCode.length > 20) {
      return {
        success: false,
        message: "Mã giới thiệu phải có độ dài từ 4 đến 20 ký tự (chữ cái và số).",
      };
    }

    // 1. Thử gọi RPC đã tối ưu
    const { data, error } = await supabase.rpc("customize_referral_code", {
      p_new_code: cleanedCode,
    });

    if (!error && data) {
      return data;
    }

    // 2. Fallback an toàn qua RLS nếu RPC chưa được nạp vào schema cache
    const { data: authData } = await supabase.auth.getUser();
    const user = authData?.user;
    if (!user) {
      return { success: false, message: "Vui lòng đăng nhập để thực hiện." };
    }

    const { data: myProfile, error: profileErr } = await supabase
      .from("profiles")
      .select("has_customized_referral_code, referral_code")
      .eq("id", user.id)
      .single();

    if (profileErr || !myProfile) {
      return { success: false, message: error?.message || "Không tìm thấy hồ sơ người dùng." };
    }

    if (myProfile.has_customized_referral_code) {
      return {
        success: false,
        message: "Bạn chỉ được đổi mã giới thiệu cá nhân hóa 1 lần duy nhất.",
      };
    }

    // Kiểm tra xem mã đã có ai dùng chưa
    const { data: existingUser } = await supabase
      .from("profiles")
      .select("id")
      .eq("referral_code", cleanedCode)
      .neq("id", user.id)
      .maybeSingle();

    if (existingUser) {
      return {
        success: false,
        message: "Mã giới thiệu này đã có người sử dụng. Vui lòng chọn mã khác.",
      };
    }

    // Cập nhật profile theo chính sách RLS
    const { error: updateErr } = await supabase
      .from("profiles")
      .update({
        referral_code: cleanedCode,
        has_customized_referral_code: true,
      })
      .eq("id", user.id);

    if (updateErr) {
      return { success: false, message: updateErr.message };
    }

    return {
      success: true,
      message: "Đổi mã giới thiệu thành công!",
      new_code: cleanedCode,
    };
  } catch (err: any) {
    return { success: false, message: err.message || "Lỗi khi đổi mã giới thiệu." };
  }
}

/**
 * Lấy toàn bộ dữ liệu thống kê trang Giới thiệu bạn bè của người dùng hiện tại
 */
export async function getReferralDashboardData(userId?: string): Promise<{
  data: ReferralDashboardData | null;
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

    const defaultReferralCode = `LUXE-${targetUserId.slice(0, 8).toUpperCase()}`;

    // 1. Lấy thông tin profile người mời
    let referralCode = defaultReferralCode;
    let hasCustomizedCode = false;
    let tier: MembershipTier = "bronze";

    const { data: profile } = await supabase
      .from("profiles")
      .select("referral_code, has_customized_referral_code, membership_tier, referral_count")
      .eq("id", targetUserId)
      .maybeSingle();

    if (profile) {
      tier = (profile.membership_tier as MembershipTier) || "bronze";
      hasCustomizedCode = !!profile.has_customized_referral_code;

      if (profile.referral_code && profile.referral_code.trim()) {
        referralCode = profile.referral_code;
      } else {
        // Tự động lưu mã mặc định này vào database nếu user chưa có mã
        supabase
          .from("profiles")
          .update({ referral_code: defaultReferralCode })
          .eq("id", targetUserId)
          .then(({ error }: { error: any }) => {
            if (error) console.warn("Chưa thể cập nhật referral_code vào DB (vui lòng chạy migration):", error.message);
          });
      }
    }

    // Mức thưởng xu theo hạng VIP
    const rewardMapping: Record<MembershipTier, number> = {
      diamond: 20000,
      gold: 15000,
      silver: 12000,
      bronze: 10000,
    };
    const rewardPerReferral = rewardMapping[tier] || 10000;

    // 2. Lấy danh sách các lượt giới thiệu (fallback an toàn nếu bảng chưa tạo)
    let records: any[] = [];
    try {
      const { data: recordsData, error: recordsErr } = await supabase
        .from("referral_records")
        .select(`
          id,
          referee_id,
          status,
          reward_coins,
          created_at,
          rewarded_at,
          referee:profiles!referral_records_referee_id_fkey(
            full_name,
            avatar_url,
            email
          )
        `)
        .eq("referrer_id", targetUserId)
        .order("created_at", { ascending: false });

      if (!recordsErr && recordsData) {
        records = recordsData;
      }
    } catch {
      records = [];
    }

    const list = records || [];

    let totalCoinsEarned = 0;
    let successfulReferrals = 0;
    let pendingReferrals = 0;

    const referralHistory: ReferralRecordItem[] = list.map((item: any) => {
      if (item.status === "rewarded") {
        successfulReferrals += 1;
        totalCoinsEarned += Number(item.reward_coins || 0);
      } else if (item.status === "registered") {
        pendingReferrals += 1;
      }

      // Che tên bạn bè để bảo vệ quyền riêng tư (VD: Nguyễn Văn An -> Ng*** An)
      const rawName = item.referee?.full_name || item.referee?.email?.split("@")[0] || "Bạn mới";
      const parts = rawName.trim().split(" ");
      let maskedName = rawName;
      if (parts.length > 1) {
        maskedName = `${parts[0].slice(0, 2)}*** ${parts[parts.length - 1]}`;
      } else if (rawName.length > 3) {
        maskedName = `${rawName.slice(0, 2)}***${rawName.slice(-1)}`;
      }

      return {
        id: item.id,
        referee_id: item.referee_id,
        referee_name: maskedName,
        referee_avatar: item.referee?.avatar_url,
        status: item.status,
        reward_coins: item.reward_coins,
        created_at: item.created_at,
        rewarded_at: item.rewarded_at,
      };
    });

    return {
      data: {
        referralCode: referralCode,
        hasCustomizedCode: hasCustomizedCode,
        membershipTier: tier,
        rewardPerReferral,
        totalReferrals: list.length,
        successfulReferrals,
        pendingReferrals,
        totalCoinsEarned,
        referralHistory,
      },
      error: null,
    };
  } catch (err: any) {
    return { data: null, error: err };
  }
}

