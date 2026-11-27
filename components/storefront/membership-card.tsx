"use client";

import { useState } from "react";
import { useAuth } from "@/components/providers/auth-provider";
import { TIER_CONFIGS, MembershipTier, claimDailyCheckin } from "@/lib/services/loyalty.service";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Sparkles, CheckCircle2, Award, Gift, ArrowRight, Zap } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/utils";

const TIER_ICON_MAP: Record<MembershipTier, string> = {
  bronze: "/icons/bronze.png",
  silver: "/icons/silver.png",
  gold: "/icons/gold.png",
  diamond: "/icons/diamond.png",
};

interface MembershipCardProps {
  compact?: boolean;
  onCheckinSuccess?: () => void;
  showCheckinButton?: boolean;
  showProgress?: boolean;
}

export function TierProgressWidget() {
  const { profile } = useAuth();
  const tier: MembershipTier = (profile?.membership_tier as MembershipTier) || "bronze";
  const tierConfig = TIER_CONFIGS[tier] || TIER_CONFIGS.bronze;
  const lifetimeCoins = Number(profile?.lifetime_coins || 0);

  const nextTierKey = tierConfig.nextTier;
  const nextTier = nextTierKey ? TIER_CONFIGS[nextTierKey] : null;
  const currentTierMin = tierConfig.minPoints;
  const nextTierMin = nextTier ? nextTier.minPoints : currentTierMin;
  const pointsRange = nextTierMin - currentTierMin;
  const pointsProgress = nextTier
    ? Math.min(Math.max(lifetimeCoins - currentTierMin, 0), pointsRange)
    : pointsRange;
  const progressPercent = nextTier && pointsRange > 0
    ? Math.min(Math.round((pointsProgress / pointsRange) * 100), 100)
    : 100;
  const pointsNeeded = nextTier ? Math.max(nextTierMin - lifetimeCoins, 0) : 0;

  const getProgressStyle = () => {
    switch (tier) {
      case "diamond":
        return {
          bar: "bg-gradient-to-r from-cyan-500 to-indigo-400",
          iconBox: "bg-cyan-500/12 text-cyan-600 dark:text-cyan-300",
          ambient: "bg-cyan-400/15",
        };
      case "gold":
        return {
          bar: "bg-gradient-to-r from-amber-500 to-yellow-400",
          iconBox: "bg-amber-500/12 text-amber-600 dark:text-amber-300",
          ambient: "bg-amber-400/15",
        };
      case "silver":
        return {
          bar: "bg-gradient-to-r from-slate-400 to-slate-500 dark:from-slate-300 dark:to-slate-400",
          iconBox: "bg-slate-500/12 text-slate-600 dark:text-slate-300",
          ambient: "bg-slate-400/15",
        };
      case "bronze":
      default:
        return {
          bar: "bg-gradient-to-r from-amber-600 to-orange-400",
          iconBox: "bg-amber-700/12 text-amber-700 dark:text-amber-400",
          ambient: "bg-amber-600/15",
        };
    }
  };

  const progressStyle = getProgressStyle();

  return (
    <div className="relative overflow-hidden bg-card/70 dark:bg-zinc-900/60 backdrop-blur-xl border border-border/50 dark:border-white/10 rounded-2xl p-4 sm:p-5 shadow-[0_8px_30px_-10px_rgba(15,23,42,0.08)] space-y-3">
      <div className={cn("absolute -top-10 -right-10 w-28 h-28 rounded-full blur-2xl pointer-events-none", progressStyle.ambient)} />
      <div className="relative z-10 flex items-center justify-between text-xs sm:text-sm">
        <div className="flex items-center gap-2 font-bold text-foreground">
          <span className={cn("w-6 h-6 rounded-lg flex items-center justify-center shrink-0", progressStyle.iconBox)}>
            <Award className="w-3.5 h-3.5" />
          </span>
          <span>Tiến trình thăng hạng</span>
        </div>

        {nextTier ? (
          <span className="text-xs text-muted-foreground font-medium">
            Cần thêm <strong className="text-foreground font-bold tabular-nums">{pointsNeeded.toLocaleString("vi-VN")}</strong> xu để lên{" "}
            <strong className="text-foreground">{nextTier.name}</strong>
          </span>
        ) : (
          <span className="text-xs text-cyan-600 dark:text-cyan-400 font-bold flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" /> Hạng cao nhất
          </span>
        )}
      </div>

      {/* Thanh Progress */}
      <div className="relative z-10 space-y-1.5">
        <div className="h-2.5 w-full bg-muted/80 dark:bg-white/10 rounded-full overflow-hidden p-0.5 shadow-inner">
          <div
            className={cn("h-full rounded-full transition-all duration-700", progressStyle.bar)}
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        <div className="flex justify-between items-center text-[11px] text-muted-foreground font-medium">
          <span className="flex items-center gap-1.5">
            <Image
              src={TIER_ICON_MAP[tier] || "/icons/bronze.png"}
              alt={tierConfig.name}
              width={14}
              height={14}
              unoptimized
              className="object-contain shrink-0"
            />
            <span>{tierConfig.name} ({tierConfig.minPoints.toLocaleString("vi-VN")} pts)</span>
          </span>
          <span className="font-mono font-bold text-foreground">{progressPercent}%</span>
          {nextTier ? (
            <span className="flex items-center gap-1.5">
              <Image
                src={TIER_ICON_MAP[nextTier.tier] || "/icons/gold.png"}
                alt={nextTier.name}
                width={14}
                height={14}
                unoptimized
                className="object-contain shrink-0"
              />
              <span>{nextTier.name} ({nextTier.minPoints.toLocaleString("vi-VN")} pts)</span>
            </span>
          ) : (
            <span className="flex items-center gap-1 text-cyan-600 dark:text-cyan-400 font-bold">
              <Image
                src="/icons/diamond.png"
                alt="Kim Cương"
                width={14}
                height={14}
                unoptimized
                className="object-contain shrink-0"
              />
              <span>Tối đa</span>
            </span>
          )}
        </div>
      </div>

      {/* Tóm tắt đặc quyền hạng hiện tại */}
      <div className="pt-2 border-t border-border/40 grid grid-cols-2  gap-2 text-[11.5px]">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Zap className="w-3.5 h-3.5 text-amber-500 shrink-0" />
          <span>Hoàn <strong className="text-foreground font-bold">{Math.round(tierConfig.rewardRate * 100 * 10) / 10}%</strong> xu/đơn</span>
        </div>

        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Gift className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
          <span>Điểm danh <strong className="text-foreground font-bold">+{tierConfig.dailyReward}</strong>🪙</span>
        </div>

        
      </div>
    </div>
  );
}

export function MembershipCard({
  compact = false,
  onCheckinSuccess,
  showCheckinButton = true,
  showProgress = true,
}: MembershipCardProps) {
  const { user, profile, refreshProfile } = useAuth();
  const [isClaiming, setIsClaiming] = useState(false);

  const tier: MembershipTier = (profile?.membership_tier as MembershipTier) || "bronze";
  const tierConfig = TIER_CONFIGS[tier] || TIER_CONFIGS.bronze;
  const coinsBalance = Number(profile?.coins_balance || 0);
  const lifetimeCoins = Number(profile?.lifetime_coins || 0);
  const lastCheckinDate = profile?.last_checkin_date;

  // Kiểm tra đã điểm danh hôm nay chưa theo giờ địa phương YYYY-MM-DD
  const todayStr = new Date().toISOString().split("T")[0];
  const isCheckedInToday = lastCheckinDate === todayStr;

  // Tính toán tiến trình thăng hạng
  const nextTierKey = tierConfig.nextTier;
  const nextTier = nextTierKey ? TIER_CONFIGS[nextTierKey] : null;
  const currentTierMin = tierConfig.minPoints;
  const nextTierMin = nextTier ? nextTier.minPoints : currentTierMin;
  const pointsRange = nextTierMin - currentTierMin;
  const pointsProgress = nextTier
    ? Math.min(Math.max(lifetimeCoins - currentTierMin, 0), pointsRange)
    : pointsRange;
  const progressPercent = nextTier && pointsRange > 0
    ? Math.min(Math.round((pointsProgress / pointsRange) * 100), 100)
    : 100;
  const pointsNeeded = nextTier ? Math.max(nextTierMin - lifetimeCoins, 0) : 0;

  const handleClaim = async () => {
    if (isClaiming || isCheckedInToday) return;
    setIsClaiming(true);
    try {
      const result = await claimDailyCheckin();
      if (result.success) {
        toast.success(result.message, {
          description: `Bạn vừa nhận được +${result.rewardCoins || tierConfig.dailyReward} xu vào ví!`,
          icon: "🎉",
        });
        await refreshProfile();
        onCheckinSuccess?.();
      } else {
        toast.info(result.message);
      }
    } catch (error: any) {
      toast.error(error?.message || "Không thể điểm danh lúc này, vui lòng thử lại sau.");
    } finally {
      setIsClaiming(false);
    }
  };

  // Styling thẻ kim loại tối giản cao cấp với sắc độ riêng biệt cho từng hạng
  const getCardTheme = () => {
    switch (tier) {
      case "diamond":
        return {
          wrapper: "bg-gradient-to-br from-[#232326] via-[#18181b] to-[#111113] border-white/15 text-white shadow-[0_20px_45px_-12px_rgba(0,0,0,0.65)]",
          ambientGlow: "from-cyan-400/[0.10] via-white/[0.04] to-transparent",
          chip: "bg-gradient-to-br from-[#F7DE7B] via-[#DFB346] to-[#B78520] border-[#FFE89C]/60",
          crownColor: "text-[#E6C367]",
          vipText: "text-[#E6C367]",
          unitText: "text-[#E6C367]",
          tierColor: "text-white/95",
          progressColor: "bg-gradient-to-r from-cyan-400 to-indigo-400",
          checkinWrapper: "bg-gradient-to-r from-cyan-500/[0.08] via-sky-500/[0.05] to-indigo-500/[0.06] border-cyan-500/20 dark:border-cyan-400/20",
          checkinIcon: "bg-cyan-500/15 text-cyan-600 dark:text-cyan-300",
          checkinBtn: "bg-gradient-to-r from-cyan-600 to-sky-600 hover:from-cyan-500 hover:to-sky-500 text-white shadow-sm shadow-cyan-500/20",
          checkinPill: "bg-cyan-500/12 text-cyan-700 dark:text-cyan-300 border-cyan-500/20",
        };
      case "gold":
        return {
          wrapper: "bg-gradient-to-br from-[#423214] via-[#2b200c] to-[#1a1307] border-amber-300/25 text-white shadow-[0_20px_45px_-12px_rgba(120,83,12,0.5)]",
          ambientGlow: "from-amber-300/[0.16] via-yellow-500/[0.05] to-transparent",
          chip: "bg-gradient-to-br from-[#F7DE7B] via-[#DFB346] to-[#B78520] border-[#FFE89C]/65",
          crownColor: "text-[#F4D77B]",
          vipText: "text-[#F4D77B]",
          unitText: "text-[#F4D77B]",
          tierColor: "text-amber-100",
          progressColor: "bg-gradient-to-r from-yellow-300 to-amber-400",
          checkinWrapper: "bg-gradient-to-r from-amber-500/[0.09] via-yellow-500/[0.06] to-orange-500/[0.05] border-amber-500/25",
          checkinIcon: "bg-amber-500/15 text-amber-600 dark:text-amber-300",
          checkinBtn: "bg-gradient-to-r from-amber-600 to-yellow-600 hover:from-amber-500 hover:to-yellow-500 text-white shadow-sm shadow-amber-500/20",
          checkinPill: "bg-amber-500/12 text-amber-700 dark:text-amber-300 border-amber-500/25",
        };
      case "silver":
        return {
          wrapper: "bg-gradient-to-br from-[#475263] via-[#2c3440] to-[#191e26] border-slate-200/30 text-white shadow-[0_20px_45px_-12px_rgba(30,41,59,0.5)]",
          ambientGlow: "from-white/[0.15] via-slate-300/[0.05] to-transparent",
          chip: "bg-gradient-to-br from-slate-100 via-slate-300 to-slate-400 border-white/65",
          crownColor: "text-slate-100",
          vipText: "text-slate-200",
          unitText: "text-slate-200",
          tierColor: "text-slate-100",
          progressColor: "bg-gradient-to-r from-slate-300 to-slate-500",
          checkinWrapper: "bg-gradient-to-r from-slate-500/[0.09] via-slate-400/[0.06] to-indigo-500/[0.05] border-slate-400/25",
          checkinIcon: "bg-slate-500/15 text-slate-600 dark:text-slate-300",
          checkinBtn: "bg-gradient-to-r from-slate-700 to-slate-600 hover:from-slate-600 hover:to-slate-500 text-white shadow-sm shadow-slate-500/20",
          checkinPill: "bg-slate-500/12 text-slate-700 dark:text-slate-300 border-slate-400/25",
        };
      case "bronze":
      default:
        return {
          wrapper: "bg-gradient-to-br from-[#4a2816] via-[#311a0e] to-[#1c0e07] border-amber-600/25 text-white shadow-[0_20px_45px_-12px_rgba(120,53,15,0.45)]",
          ambientGlow: "from-orange-400/[0.14] via-amber-500/[0.05] to-transparent",
          chip: "bg-gradient-to-br from-amber-200 via-amber-400 to-amber-600 border-amber-100/60",
          crownColor: "text-[#F0AE78]",
          vipText: "text-[#F0AE78]",
          unitText: "text-[#F0AE78]",
          tierColor: "text-amber-100",
          progressColor: "bg-gradient-to-r from-amber-500 to-orange-400",
          checkinWrapper: "bg-gradient-to-r from-orange-500/[0.08] via-amber-700/[0.06] to-amber-500/[0.05] border-amber-700/25",
          checkinIcon: "bg-amber-700/15 text-amber-700 dark:text-amber-400",
          checkinBtn: "bg-gradient-to-r from-amber-700 to-orange-600 hover:from-amber-600 hover:to-orange-500 text-white shadow-sm shadow-amber-700/20",
          checkinPill: "bg-amber-700/12 text-amber-800 dark:text-amber-300 border-amber-700/25",
        };
    }
  };

  const renderTierWireframeIcon = () => {
    switch (tier) {
      case "diamond":
        return (
          <svg
            className="w-4 h-4 sm:w-[18px] sm:h-[18px] shrink-0"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M6 4h12l4 6-10 11L2 10l4-6z" />
            <path d="M2 10h20" />
            <path d="M12 21L8 10l4-6 4 6-4 11z" />
          </svg>
        );
      case "gold":
        return (
          <svg
            className="w-4 h-4 sm:w-[18px] sm:h-[18px] shrink-0"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="9" r="6" />
            <path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11" />
          </svg>
        );
      case "silver":
        return (
          <svg
            className="w-4 h-4 sm:w-[18px] sm:h-[18px] shrink-0"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2z" />
          </svg>
        );
      case "bronze":
      default:
        return (
          <svg
            className="w-4 h-4 sm:w-[18px] sm:h-[18px] shrink-0"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
        );
    }
  };

  const theme = getCardTheme();

  return (
    <div className="space-y-4">
      {/* Thẻ VIP Digital Kim Loại Đen Tối Giản (Matte Metal Luxury Card) */}
      <div
        className={cn(
          "relative overflow-hidden rounded-[22px] border p-6 sm:p-7 transition-all duration-300 select-none shadow-[inset_0_1px_1px_rgba(255,255,255,0.12)]",
          theme.wrapper
        )}
      >
        {/* Hiệu ứng phản chiếu ánh sáng chéo trên bề mặt kim loại mờ */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "linear-gradient(52deg, transparent 47%, rgba(255,255,255,0.065) 47.4%, rgba(255,255,255,0.015) 68%, transparent 100%)",
          }}
        />
        <div
          className={cn(
            "absolute -right-24 -top-24 w-72 h-72 rounded-full blur-3xl pointer-events-none bg-gradient-to-br",
            theme.ambientGlow
          )}
        />

        {/* Header Thẻ: Logo Vương Miện & Hạng Thành Viên */}
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
          <div className="flex items-center gap-3 min-w-0">
            {/* Vương miện 3 đỉnh tối giản */}
            <svg
              className={cn("w-6 h-6 sm:w-7 sm:h-7 shrink-0", theme.crownColor)}
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M3 16.5L2 6.5L7.5 11.5L12 4.5L16.5 11.5L22 6.5L21 16.5H3Z" />
              <rect x="3" y="18.5" width="18" height="2.2" rx="1" />
            </svg>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-sm sm:text-base font-bold tracking-[0.14em] uppercase leading-tight truncate">
                <span className="text-white">LUXE</span>
                <span className={theme.vipText}>VIP CLUB</span>
              </div>
              <p className="text-[9.5px] sm:text-[10px] tracking-[0.22em] text-white/45 font-medium uppercase mt-0.5">
                MEMBERSHIP CARD
              </p>
            </div>
          </div>

          {/* Vách ngăn dọc & Tên Hạng VIP */}
          <div className="flex items-center gap-3 sm:gap-4 shrink-0">
            <div className="hidden sm:block w-[1px] h-6 bg-white/15" />
            <Link
              href="/account/coins"
              className={cn(
                "flex items-center gap-2 text-[11px] sm:text-xs font-semibold tracking-[0.12em] uppercase transition-opacity hover:opacity-80",
                theme.tierColor
              )}
            >
              {renderTierWireframeIcon()}
              <span>Hạng {tierConfig.name}</span>
            </Link>
          </div>
        </div>

        {/* Chip Kim Loại EMV & Biểu Tượng Sóng NFC */}
        <div className="relative z-10 my-6 sm:my-7 flex items-center justify-between">
          <div
            className={cn(
              "w-11 h-8 sm:w-12 sm:h-9 rounded-[7px] relative overflow-hidden shadow-[0_2px_6px_rgba(0,0,0,0.45),inset_0_1px_1px_rgba(255,255,255,0.6)] border",
              theme.chip
            )}
          >
            <svg className="w-full h-full" viewBox="0 0 48 36" fill="none">
              <path d="M0 12H15M0 24H15M33 12H48M33 24H48M24 0V8M24 28V36" stroke="rgba(0,0,0,0.28)" strokeWidth="1.3" />
              <rect x="15" y="8" width="18" height="20" rx="5" stroke="rgba(0,0,0,0.32)" strokeWidth="1.3" />
              <rect x="20" y="13" width="8" height="10" rx="4" stroke="rgba(0,0,0,0.22)" strokeWidth="1.1" />
            </svg>
          </div>

          <svg
            className="w-5 h-5 sm:w-6 sm:h-6 text-white/80 shrink-0"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <path d="M6.5 9.5a4.5 4.5 0 0 1 0 5" />
            <path d="M10 7a8 8 0 0 1 0 10" />
            <path d="M13.5 4.5a11.5 11.5 0 0 1 0 15" />
          </svg>
        </div>

        {/* Thông số Xu Khả Dụng & Điểm Trọn Đời (2 cột tối giản, thoáng) */}
        <div className="relative z-10 my-5 sm:my-6 grid grid-cols-[1fr_auto_1fr] items-start gap-4 sm:gap-7">
          {/* Cột Trái: Xu Khả Dụng */}
          <div className="min-w-0">
            <p className="text-[10px] sm:text-[11px] uppercase font-medium tracking-[0.12em] text-white/55 mb-1.5">
              Xu khả dụng
            </p>
            <div className="flex items-baseline gap-1.5 flex-wrap">
              <span className="text-xl sm:text-[28px] font-bold tracking-tight text-white tabular-nums leading-none">
                {coinsBalance.toLocaleString("vi-VN")}
              </span>
              <span className={cn("text-sm sm:text-base font-bold", theme.unitText)}>Xu</span>
            </div>
            <p className="text-[11px] sm:text-xs text-white/45 font-medium mt-1.5 tabular-nums">
              (≈ {coinsBalance.toLocaleString("vi-VN")}đ)
            </p>
          </div>

          {/* Vách ngăn dọc mảnh */}
          <div className="w-[1px] h-12 sm:h-14 bg-white/15 self-center" />

          {/* Cột Phải: Điểm Trọn Đời */}
          <div className="min-w-0">
            <p className="text-[10px] sm:text-[11px] uppercase font-medium tracking-[0.12em] text-white/55 mb-1.5">
              Điểm trọn đời
            </p>
            <div className="flex items-baseline gap-1.5 flex-wrap">
              <span className="text-xl sm:text-[28px] font-bold tracking-tight text-white tabular-nums leading-none">
                {lifetimeCoins.toLocaleString("vi-VN")}
              </span>
              <span className="text-sm sm:text-base font-medium text-white/55">pts</span>
            </div>
          </div>
        </div>

        {/* Footer Thẻ: Chủ Thẻ & Mã Thành Viên */}
        <div className="relative z-10 pt-2 flex items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[9.5px] sm:text-[10px] uppercase tracking-[0.14em] text-white/45 font-medium mb-1">
              Chủ thẻ
            </p>
            <p className="text-xs sm:text-[15px] font-bold uppercase tracking-[0.08em] text-white truncate max-w-[200px] sm:max-w-[300px]">
              {profile?.full_name || user?.email?.split("@")[0] || "QUÝ KHÁCH"}
            </p>
          </div>

          <div className="text-right font-mono text-[11px] sm:text-xs tracking-[0.12em] text-white/45 font-medium shrink-0">
            #LUXE-{user?.id ? user.id.slice(0, 8).toUpperCase() : "MEMBER"}
          </div>
        </div>
      </div>

      {/* Thanh tiến trình thăng hạng (nếu bật) */}
      {showProgress && (
        <div className="bg-card/70 backdrop-blur-xl border border-border/60 rounded-2xl p-4 sm:p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between text-xs sm:text-sm">
            <div className="flex items-center gap-1.5 font-bold text-foreground">
              <Award className="w-4 h-4 text-primary" />
              <span>Tiến trình thăng hạng</span>
            </div>

            {nextTier ? (
              <span className="text-xs text-muted-foreground font-medium">
                Cần thêm <strong className="text-primary font-bold">{pointsNeeded.toLocaleString("vi-VN")}</strong> xu để lên{" "}
                <strong className="text-foreground">{nextTier.name}</strong>
              </span>
            ) : (
              <span className="text-xs text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Hạng cao nhất
              </span>
            )}
          </div>

          {/* Thanh Progress */}
          <div className="space-y-1.5">
            <div className="h-2.5 w-full bg-muted rounded-full overflow-hidden p-0.5 shadow-inner">
              <div
                className={cn("h-full rounded-full transition-all duration-700", theme.progressColor)}
                style={{ width: `${progressPercent}%` }}
              />
            </div>

            <div className="flex justify-between items-center text-[11px] text-muted-foreground font-medium">
              <span className="flex items-center gap-1.5">
                <Image
                  src={TIER_ICON_MAP[tier] || "/icons/bronze.png"}
                  alt={tierConfig.name}
                  width={14}
                  height={14}
                  unoptimized
                  className="object-contain shrink-0"
                />
                <span>{tierConfig.name} ({tierConfig.minPoints.toLocaleString("vi-VN")} pts)</span>
              </span>
              <span className="font-mono font-bold text-foreground">{progressPercent}%</span>
              {nextTier ? (
                <span className="flex items-center gap-1.5">
                  <Image
                    src={TIER_ICON_MAP[nextTier.tier] || "/icons/gold.png"}
                    alt={nextTier.name}
                    width={14}
                    height={14}
                    unoptimized
                    className="object-contain shrink-0"
                  />
                  <span>{nextTier.name} ({nextTier.minPoints.toLocaleString("vi-VN")} pts)</span>
                </span>
              ) : (
                <span className="flex items-center gap-1 text-cyan-600 dark:text-cyan-400 font-bold">
                  <Image
                    src="/icons/diamond.png"
                    alt="Kim Cương"
                    width={14}
                    height={14}
                    unoptimized
                    className="object-contain shrink-0"
                  />
                  <span>Tối đa</span>
                </span>
              )}
            </div>
          </div>

          {/* Tóm tắt đặc quyền hạng hiện tại */}
          <div className="pt-2 border-t border-border/40 grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11.5px]">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Zap className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              <span>Hoàn <strong className="text-foreground font-bold">{Math.round(tierConfig.rewardRate * 100 * 10) / 10}%</strong> xu/đơn</span>
            </div>

            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Gift className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
              <span>Điểm danh hàng ngày </span>
            </div>

            <div className="col-span-2 sm:col-span-1 flex items-center gap-1.5 text-muted-foreground">
              <Sparkles className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              <span>
                {tier === "diamond"
                  ? "Freeship toàn quốc 100%"
                  : tier === "gold"
                  ? "Giảm 50% phí ship"
                  : "Tích xu thăng hạng"}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Nút điểm danh nhận xu hôm nay thích ứng theo hạng (nếu bật) */}
      {showCheckinButton && (
        <div
          className={cn(
            "backdrop-blur-xl border rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm transition-colors",
            theme.checkinWrapper
          )}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-inner", theme.checkinIcon)}>
              <Gift className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="text-xs sm:text-sm font-bold text-foreground">
                  Điểm danh nhận xu hằng ngày
                </h4>
                <span className={cn("text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border", theme.checkinPill)}>
                  Hạng {tierConfig.name}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {isCheckedInToday
                  ? `Bạn đã nhận +${tierConfig.dailyReward} Xu hôm nay! Hãy quay lại vào ngày mai nhé.`
                  : `Nhận ngay +${tierConfig.dailyReward} Xu mỗi ngày dành riêng cho thành viên hạng ${tierConfig.name}.`}
              </p>
            </div>
          </div>

          <Button
            type="button"
            onClick={handleClaim}
            disabled={isCheckedInToday || isClaiming}
            size="sm"
            className={cn(
              "rounded-xl font-bold text-xs h-9 px-5 shrink-0 transition-all",
              isCheckedInToday
                ? "bg-emerald-600/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/25 hover:bg-emerald-600/15 cursor-default"
                : cn(theme.checkinBtn, "active:scale-95 cursor-pointer")
            )}
          >
            {isClaiming ? (
              <span>Đang nhận...</span>
            ) : isCheckedInToday ? (
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" /> Đã điểm danh
              </span>
            ) : (
              <span className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" /> Điểm danh (+{tierConfig.dailyReward} Xu)
              </span>
            )}
          </Button>
        </div>
      )}

      {/* Link xem chi tiết chính sách nếu ở compact mode */}
      {compact && (
        <div className="text-center pt-1">
          <Link
            href="/account/coins"
            className="text-xs font-semibold text-primary hover:underline inline-flex items-center gap-1"
          >
            <span>Xem lịch sử tích xu & chi tiết quyền lợi thành viên</span>
            <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      )}
    </div>
  );
}
