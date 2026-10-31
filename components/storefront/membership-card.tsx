"use client";

import { useState } from "react";
import { useAuth } from "@/components/providers/auth-provider";
import { TIER_CONFIGS, MembershipTier, claimDailyCheckin } from "@/lib/services/loyalty.service";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Sparkles, CheckCircle2, Award, Gift, ArrowRight, Zap, ChevronRight } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

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

  const getProgressColor = () => {
    switch (tier) {
      case "diamond": return "bg-gradient-to-r from-cyan-400 to-indigo-400";
      case "gold": return "bg-gradient-to-r from-yellow-300 to-amber-400";
      case "silver": return "bg-gradient-to-r from-slate-300 to-slate-500";
      case "bronze":
      default: return "bg-gradient-to-r from-amber-500 to-orange-400";
    }
  };

  return (
    <div className="bg-card/60 backdrop-blur-md border border-border/50 rounded-2xl p-4 sm:p-5 shadow-2xs space-y-3">
      <div className="flex items-center justify-between text-xs sm:text-sm">
        <div className="flex items-center gap-1.5 font-bold text-foreground">
          <Award className="w-4 h-4 text-primary" />
          <span>Tiến trình </span>
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
            className={cn("h-full rounded-full transition-all duration-700", getProgressColor())}
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        <div className="flex justify-between text-[11px] text-muted-foreground font-medium">
          <span>
            {tierConfig.iconName} {tierConfig.name} ({tierConfig.minPoints.toLocaleString("vi-VN")} pts)
          </span>
          <span>{progressPercent}%</span>
          {nextTier ? (
            <span>
              {nextTier.iconName} {nextTier.name} ({nextTier.minPoints.toLocaleString("vi-VN")} pts)
            </span>
          ) : (
            <span>💎 Tối đa</span>
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

  // Styling bóng bẩy sang trọng theo từng hạng thẻ (Glassmorphism & Molten Metallic)
  const getCardTheme = () => {
    switch (tier) {
      case "diamond":
        return {
          wrapper: "bg-gradient-to-br from-[#0c1322] via-[#071328] to-[#040814] border-cyan-400/40 text-cyan-50 shadow-[0_16px_40px_rgba(6,182,212,0.25)]",
          glow: "from-cyan-500/30 via-sky-400/15 to-transparent",
          chip: "bg-gradient-to-br from-cyan-200 via-sky-300 to-indigo-500 border-cyan-200/80 shadow-[0_0_12px_rgba(6,182,212,0.4)]",
          chipPads: "border-cyan-900/40",
          pill: "bg-black/40 border-cyan-400/30 text-cyan-100 hover:border-cyan-400/60 shadow-[inset_0_1px_1px_rgba(255,255,255,0.2)]",
          crownColor: "text-cyan-300 drop-shadow-[0_2px_8px_rgba(6,182,212,0.6)]",
          coinBg: "from-cyan-300 via-sky-400 to-blue-600 border-cyan-100/80",
          coinStar: "text-blue-950",
          giftBox: "bg-cyan-500/15 border-cyan-400/25 text-cyan-200",
          accentText: "text-cyan-300",
          progressColor: "bg-gradient-to-r from-cyan-400 to-indigo-400",
        };
      case "gold":
        return {
          wrapper: "bg-gradient-to-br from-[#713f12] via-[#451a03] to-[#1c0f06] border-yellow-400/45 text-yellow-50 shadow-[0_16px_40px_rgba(234,179,8,0.25)]",
          glow: "from-yellow-400/35 via-amber-400/20 to-transparent",
          chip: "bg-gradient-to-br from-yellow-200 via-amber-300 to-amber-500 border-yellow-100/90 shadow-[0_0_12px_rgba(245,158,11,0.4)]",
          chipPads: "border-amber-900/40",
          pill: "bg-black/40 border-yellow-400/30 text-yellow-100 hover:border-yellow-400/60 shadow-[inset_0_1px_1px_rgba(255,255,255,0.2)]",
          crownColor: "text-yellow-300 drop-shadow-[0_2px_8px_rgba(234,179,8,0.6)]",
          coinBg: "from-yellow-200 via-amber-400 to-amber-600 border-yellow-100/90",
          coinStar: "text-amber-950",
          giftBox: "bg-yellow-500/15 border-yellow-400/25 text-yellow-200",
          accentText: "text-yellow-300",
          progressColor: "bg-gradient-to-r from-yellow-300 to-amber-400",
        };
      case "silver":
        return {
          wrapper: "bg-gradient-to-br from-[#334155] via-[#1e293b] to-[#0f172a] border-slate-300/45 text-slate-50 shadow-[0_16px_40px_rgba(148,163,184,0.25)]",
          glow: "from-slate-300/25 via-sky-200/15 to-transparent",
          chip: "bg-gradient-to-br from-slate-100 via-slate-300 to-slate-400 border-white/80 shadow-[0_0_12px_rgba(255,255,255,0.3)]",
          chipPads: "border-slate-800/40",
          pill: "bg-black/40 border-slate-300/30 text-slate-100 hover:border-slate-300/60 shadow-[inset_0_1px_1px_rgba(255,255,255,0.2)]",
          crownColor: "text-slate-200 drop-shadow-[0_2px_8px_rgba(255,255,255,0.5)]",
          coinBg: "from-slate-100 via-slate-300 to-slate-500 border-white/90",
          coinStar: "text-slate-900",
          giftBox: "bg-slate-400/15 border-slate-300/25 text-slate-200",
          accentText: "text-slate-200",
          progressColor: "bg-gradient-to-r from-slate-300 to-slate-500",
        };
      case "bronze":
      default:
        return {
          wrapper: "bg-gradient-to-br from-[#622a0f] via-[#3a1807] to-[#180a03] border-amber-500/40 text-amber-50 shadow-[0_16px_40px_rgba(180,83,9,0.3)]",
          glow: "from-amber-500/35 via-orange-500/20 to-transparent",
          chip: "bg-gradient-to-br from-amber-200 via-amber-400 to-amber-600 border-amber-100/90 shadow-[0_0_12px_rgba(217,119,6,0.4)]",
          chipPads: "border-amber-950/40",
          pill: "bg-black/45 border-amber-400/35 text-amber-100 hover:border-amber-400/60 shadow-[inset_0_1px_1px_rgba(255,255,255,0.25)]",
          crownColor: "text-amber-300 drop-shadow-[0_2px_8px_rgba(245,158,11,0.6)]",
          coinBg: "from-amber-200 via-amber-400 to-amber-600 border-amber-100/90",
          coinStar: "text-amber-950",
          giftBox: "bg-amber-500/15 border-amber-400/25 text-amber-200",
          accentText: "text-amber-200",
          progressColor: "bg-gradient-to-r from-amber-500 to-orange-400",
        };
    }
  };

  const theme = getCardTheme();

  return (
    <div className="space-y-4">
      {/* Thẻ VIP Digital Siêu Bóng Bẩy (Glassmorphic Luxury Card) */}
      <div
        className={cn(
          "relative overflow-hidden rounded-[28px] border p-6 sm:p-7 transition-all duration-300 select-none group shadow-[inset_0_1px_2px_rgba(255,255,255,0.4)]",
          theme.wrapper
        )}
      >
        {/* Lớp phản chiếu ánh sáng thủy tinh (Glossy Glass Reflection) */}
        <div className="absolute inset-0 bg-gradient-to-b from-white/10 via-yellow/10 to-transparent pointer-events-none rounded-[28px]" />
        <div className="absolute -top-32 -left-20 w-80 h-80 bg-black/10 rounded-full blur-3xl pointer-events-none transform -rotate-12" />

        {/* Glow ambient background */}
        <div
          className={cn(
            "absolute -right-20 -top-20 w-72 h-72 rounded-full blur-3xl opacity-75 pointer-events-none bg-gradient-to-br",
            theme.glow
          )}
        />

        {/* Vân sáng gợn sóng nghệ thuật (Silky Wave Lines) */}
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none opacity-40 mix-blend-screen"
          preserveAspectRatio="none"
          viewBox="0 0 500 300"
        >
          <path
            d="M -50 180 Q 150 100 280 180 T 550 120 L 550 350 L -50 350 Z"
            fill="url(#card-wave-glow)"
          />
          <defs>
            <linearGradient id="card-wave-glow" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="rgba(255,255,255,0.02)" />
              <stop offset="50%" stopColor="rgba(255,215,160,0.22)" />
              <stop offset="100%" stopColor="rgba(255,255,255,0.01)" />
            </linearGradient>
          </defs>
        </svg>

        {/* Watermark vương miện chìm khổng lồ bên phải */}
        <svg
          className="absolute -right-6 -bottom-10 w-48 h-48 text-white/[0.06] pointer-events-none transform rotate-[-8deg]"
          viewBox="0 0 24 24"
          fill="currentColor"
        >
          <path d="M5 16L3 5L8.5 10L12 4L15.5 10L21 5L19 16H5ZM5 18H19V20H5V18Z" />
        </svg>

        {/* Header Thẻ: Logo Vương Miện & Pill Hạng VIP */}
        <div className="relative z-10 flex items-start justify-between gap-4">
          <div className="flex items-center gap-2.5">
            {/* Biểu tượng Vương Miện */}
            <svg
              className={cn("w-7 h-7 sm:w-8 sm:h-8 shrink-0", theme.crownColor)}
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M5 16L3 5L8.5 10L12 4L15.5 10L21 5L19 16H5ZM5 18H19V20H5V18Z" />
            </svg>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs sm:text-[13px] font-black tracking-[0.2em] uppercase text-white drop-shadow-sm">
                  LUXE VIP CLUB
                </span>
                <span className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-amber-400 text-amber-950 font-black text-[9px] shadow-xs">
                  ✓
                </span>
              </div>
              <p className="text-[9.5px] font-mono tracking-[0.25em] text-white/70 uppercase">
                MEMBERSHIP CARD
              </p>
            </div>
          </div>

          {/* Nút Pill Hạng VIP bo tròn sang trọng */}
          <Link
            href="/account/coins"
            className={cn(
              "px-3 py-1.5 rounded-full border text-xs font-bold uppercase tracking-wide flex items-center gap-1.5 transition-all duration-200 cursor-pointer",
              theme.pill
            )}
          >
            <span className="text-sm">{tierConfig.iconName}</span>
            <span className="font-extrabold text-[11px] sm:text-xs">Hạng {tierConfig.name}</span>
            <ChevronRight className="w-3.5 h-3.5 opacity-70 ml-0.5" />
          </Link>
        </div>

        {/* EMV Chip Kim Loại & Sóng Không Chạm NFC */}
        <div className="relative z-10 my-4 sm:my-5 flex items-center justify-between">
          {/* Chip 6 mạch kim loại viền nổi */}
          <div
            className={cn(
              "w-12 h-9 sm:w-13 sm:h-9.5 rounded-xl border p-1 relative overflow-hidden shadow-md",
              theme.chip
            )}
          >
            <div className={cn("w-full h-full rounded-md border grid grid-cols-3 grid-rows-2 gap-[2px]", theme.chipPads)}>
              <div className="border-r border-b border-black/20 rounded-tl-sm" />
              <div className="border-r border-b border-black/20" />
              <div className="border-b border-black/20 rounded-tr-sm" />
              <div className="border-r border-black/20 rounded-bl-sm" />
              <div className="border-r border-black/20" />
              <div className="rounded-br-sm" />
            </div>
          </div>

          {/* Biểu tượng sóng không chạm NFC */}
          <div className="opacity-75 flex items-center">
            <svg className="w-5 h-6 text-white drop-shadow-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M12 6c3.3 3.3 3.3 8.7 0 12" />
              <path d="M15.5 3.5c4.7 4.7 4.7 12.3 0 17" />
              <path d="M19 1c6.1 6.1 6.1 15.9 0 22" />
            </svg>
          </div>
        </div>

        {/* Khối Kính Nổi Trưng Bày Xu & Điểm (Floating Glass Capsule Dock) */}
        <div className="relative z-10 my-4 sm:my-5 rounded-2xl bg-black/30 backdrop-blur-md border border-white/15 p-3.5 sm:p-4 shadow-[inset_0_1px_1px_rgba(255,255,255,0.2),0_8px_24px_rgba(0,0,0,0.25)] flex items-center justify-between">
          {/* Cột trái: Xu khả dụng */}
          <div className="flex items-center gap-3 min-w-0">
            {/* Đồng xu vàng 3D đính ngôi sao */}
            <div
              className={cn(
                "w-11 h-11 sm:w-12 sm:h-12 rounded-full p-[2px] shadow-md flex items-center justify-center shrink-0 border bg-gradient-to-b",
                theme.coinBg
              )}
            >
              <div className="w-full h-full rounded-full border border-black/15 bg-gradient-to-b from-white/20 to-black/10 flex items-center justify-center">
                <svg className={cn("w-5 h-5 fill-current drop-shadow-xs", theme.coinStar)} viewBox="0 0 24 24">
                  <path d="M12 2l2.4 7.4h7.6l-6.1 4.5 2.3 7.1-6.2-4.5-6.2 4.5 2.3-7.1-6.1-4.5h7.6z" />
                </svg>
              </div>
            </div>

            <div className="min-w-0 space-y-0.5">
              <p className="text-[9.5px] uppercase font-bold tracking-widest text-white/70 truncate">
                Xu khả dụng để tiêu
              </p>
              <div className="flex items-baseline gap-1.5 flex-wrap">
                <span className="text-xl sm:text-2xl font-black tracking-tight text-white drop-shadow-sm">
                  {coinsBalance.toLocaleString("vi-VN")}
                </span>
                <span className="text-xs sm:text-sm font-bold text-amber-200">Xu</span>
                <span className="text-[11px] text-white/60 font-mono">
                  (≈ {coinsBalance.toLocaleString("vi-VN")}đ)
                </span>
              </div>
            </div>
          </div>

          {/* Vách ngăn mờ ở giữa */}
          <div className="w-[1px] h-9 bg-white/15 mx-2.5 sm:mx-4 shrink-0" />

          {/* Cột phải: Điểm trọn đời */}
          <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
            <div className={cn("w-10 h-10 sm:w-11 sm:h-11 rounded-xl border flex items-center justify-center shrink-0 shadow-inner", theme.giftBox)}>
              <Gift className="w-5 h-5" />
            </div>

            <div className="space-y-0.5">
              <p className="text-[9.5px] uppercase font-bold tracking-widest text-white/70">
                Điểm trọn đời
              </p>
              <p className="text-base sm:text-lg font-black tracking-tight text-white drop-shadow-sm">
                {lifetimeCoins.toLocaleString("vi-VN")}{" "}
                <span className="text-xs font-semibold text-white/80 font-mono">pts</span>
              </p>
            </div>
          </div>
        </div>

        {/* Thông tin chủ thẻ & Mã thành viên */}
        <div className="relative z-10 pt-1 flex items-end justify-between gap-2">
          <div>
            <p className="text-[9.5px] uppercase tracking-widest text-white/60 font-bold mb-0.5">
              Chủ thẻ
            </p>
            <p className="text-xs sm:text-sm font-black uppercase tracking-wider text-white drop-shadow-sm truncate max-w-[200px] sm:max-w-[280px]">
              {profile?.full_name || user?.email?.split("@")[0] || "QUÝ KHÁCH"}
            </p>
          </div>

          <div className="text-right font-mono text-[11px] sm:text-xs tracking-widest text-white/75 font-semibold">
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

            <div className="flex justify-between text-[11px] text-muted-foreground font-medium">
              <span>
                {tierConfig.iconName} {tierConfig.name} ({tierConfig.minPoints.toLocaleString("vi-VN")} pts)
              </span>
              <span>{progressPercent}%</span>
              {nextTier ? (
                <span>
                  {nextTier.iconName} {nextTier.name} ({nextTier.minPoints.toLocaleString("vi-VN")} pts)
                </span>
              ) : (
                <span>💎 Tối đa</span>
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

      {/* Nút điểm danh nhận xu hôm nay (nếu bật) */}
      {showCheckinButton && (
        <div className="bg-gradient-to-r from-amber-500/10 via-yellow-500/10 to-orange-500/10 border border-amber-500/25 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 shadow-inner">
              <Gift className="w-5 h-5 " />
            </div>
            <div>
              <h4 className="text-xs sm:text-sm font-bold text-foreground flex items-center gap-1.5">
                <span>Điểm danh nhận xu hằng ngày</span>
                
              </h4>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {isCheckedInToday
                  ? "Bạn đã điểm danh thành công hôm nay! Hãy quay lại vào ngày mai nhé."
                  : "Mỗi ngày đăng nhập nhận ngay xu thưởng thăng hạng thành viên."}
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
                ? "bg-emerald-600/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 hover:bg-emerald-600/20 cursor-default"
                : "bg-gradient-to-r from-amber-600 to-yellow-600 hover:from-amber-500 hover:to-yellow-500 text-white shadow-md shadow-amber-500/25 active:scale-95 cursor-pointer"
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
                <Sparkles className="w-3.5 h-3.5" /> Điểm danh (+{tierConfig.dailyReward}🪙)
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
