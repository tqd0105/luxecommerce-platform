"use client";

import { useEffect, Suspense, useRef } from "react";
import { useSearchParams } from "next/navigation";
import {
  saveReferralCookie,
  getReferrerPreview,
} from "@/lib/services/referral.service";
import { toast } from "sonner";
import { TIER_CONFIGS, MembershipTier } from "@/lib/services/loyalty.service";

function ReferralTrackerContent() {
  const searchParams = useSearchParams();
  const hasHandled = useRef(false);

  useEffect(() => {
    const refCode = searchParams.get("ref");
    if (!refCode || hasHandled.current) return;

    hasHandled.current = true;
    const cleanCode = refCode.trim().toUpperCase();

    // 1. Lưu mã giới thiệu vào Cookie & LocalStorage
    saveReferralCookie(cleanCode);

    // 2. Tra cứu thông tin người giới thiệu và hiển thị lời chào sang trọng
    getReferrerPreview(cleanCode).then((res) => {
      if (res.success && res.referrer_name) {
        const tier = (res.membership_tier as MembershipTier) || "bronze";
        const tierName = TIER_CONFIGS[tier]?.name || "VIP";

        toast.info("Đặc quyền từ bạn bè!", {
          description: `Bạn được bảo trợ bởi thành viên ${tierName} ${res.referrer_name}. Đăng ký ngay để nhận quà chào mừng!`,
          duration: 6000,
        });
      }
    });
  }, [searchParams]);

  return null;
}

export function ReferralTracker() {
  return (
    <Suspense fallback={null}>
      <ReferralTrackerContent />
    </Suspense>
  );
}

