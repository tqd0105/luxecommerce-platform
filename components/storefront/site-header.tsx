"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { Search, ShoppingCart, Heart, Bell, User, Menu, LogOut, Package, HomeIcon, BoxIcon, UserIcon, LogOutIcon, Shield, MapPin, Settings, Sparkles, LayoutDashboard, ChevronRight, Gift } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useAuthModal } from "@/lib/store/use-auth-modal";
import { useCartStore } from "@/lib/store/use-cart-store";
import { useAuth } from "@/components/providers/auth-provider";
import { useEffect, useState, useRef } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ThemeToggle } from "./theme-toggle";
import { NotificationDropdown } from "@/components/notifications/notification-dropdown";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetClose,
} from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/lib/supabase/client";
import { getProduct } from "@/lib/services/product.service";
import { getGuestCartItems } from "@/lib/services/cart.service";
import { TIER_CONFIGS, MembershipTier } from "@/lib/services/loyalty.service";

/**
 * Trả về toàn bộ phong cách thị giác (màu sắc, viền, hiệu ứng hào quang, thẻ VIP)
 * tương ứng với từng Hạng thành viên (Đồng, Bạc, Vàng, Kim Cương) và Quyền (Admin, Staff)
 */
function getTierTheme(tier: MembershipTier, role: string | null) {
  if (role === "admin") {
    return {
      name: "Quản trị viên",
      tagline: "SYSTEM ADMINISTRATOR",
      icon: "👑",
      iconImg: "/icons/admin.png",
      triggerRing: "ring-2 ring-rose-500/90 hover:ring-rose-400",
      triggerGlow: "shadow-[0_0_14px_rgba(244,63,94,0.45)] hover:shadow-[0_0_22px_rgba(244,63,94,0.7)]",
      triggerBadgeBg: "bg-rose-950 text-rose-300 border-rose-500/80 shadow-[0_0_8px_rgba(244,63,94,0.5)]",
      dropdownBorder: "border-rose-500/35",
      dropdownGlow: "shadow-[0_20px_60px_rgba(244,63,94,0.18)]",
      cardBg: "bg-gradient-to-br from-[#290812] via-[#3d0d1b] to-[#1a050b] text-white",
      cardBorder: "border-rose-500/40",
      cardGlow: "shadow-[0_8px_24px_rgba(244,63,94,0.25),inset_0_1px_1px_rgba(255,255,255,0.2)]",
      cardShine: "bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-rose-500/30 via-pink-500/10 to-transparent",
      badgeBg: "bg-rose-500/25 text-rose-200 border-rose-400/50 shadow-[0_0_10px_rgba(244,63,94,0.3)]",
      privilegeText: "Toàn quyền Quản trị & Điều hành Hệ thống",
      privilegePill: "bg-rose-950/70 border-rose-500/30 text-rose-200",
      progressBg: "bg-gradient-to-r from-rose-500 to-amber-500",
      progressTrack: "bg-rose-950/60",
      accentColor: "text-rose-400",
      coinBadgeBg: "bg-rose-500/15",
      coinBadgeText: "text-rose-700 dark:text-rose-400",
      coinBadgeBorder: "border-rose-500/25",
      coinHover: "hover:bg-rose-500/10 focus:bg-rose-500/10 group-hover:text-rose-600 dark:group-hover:text-rose-400",
    };
  }

  if (role === "staff") {
    return {
      name: "Nhân viên Vận hành",
      tagline: "STAFF OPERATOR",
      icon: "🛡️",
      iconImg: "/icons/staff.png",
      triggerRing: "ring-2 ring-blue-500/90 hover:ring-blue-400",
      triggerGlow: "shadow-[0_0_14px_rgba(59,130,246,0.45)] hover:shadow-[0_0_22px_rgba(59,130,246,0.7)]",
      triggerBadgeBg: "bg-blue-950 text-blue-300 border-blue-500/80 shadow-[0_0_8px_rgba(59,130,246,0.5)]",
      dropdownBorder: "border-blue-500/35",
      dropdownGlow: "shadow-[0_20px_60px_rgba(59,130,246,0.18)]",
      cardBg: "bg-gradient-to-br from-[#0a162b] via-[#0f2547] to-[#060f1e] text-white",
      cardBorder: "border-blue-500/40",
      cardGlow: "shadow-[0_8px_24px_rgba(59,130,246,0.25),inset_0_1px_1px_rgba(255,255,255,0.2)]",
      cardShine: "bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-500/30 via-indigo-500/10 to-transparent",
      badgeBg: "bg-blue-500/25 text-blue-200 border-blue-400/50 shadow-[0_0_10px_rgba(59,130,246,0.3)]",
      privilegeText: "Xử lý Đơn hàng & Hỗ trợ Khách hàng",
      privilegePill: "bg-blue-950/70 border-blue-500/30 text-blue-200",
      progressBg: "bg-gradient-to-r from-blue-500 to-indigo-500",
      progressTrack: "bg-blue-950/60",
      accentColor: "text-blue-400",
      coinBadgeBg: "bg-blue-500/15",
      coinBadgeText: "text-blue-700 dark:text-blue-400",
      coinBadgeBorder: "border-blue-500/25",
      coinHover: "hover:bg-blue-500/10 focus:bg-blue-500/10 group-hover:text-blue-600 dark:group-hover:text-blue-400",
    };
  }

  switch (tier) {
    case "diamond":
      return {
        name: "Hội viên Kim Cương",
        tagline: "SUPREME PRESTIGE VIP",
        icon: "💎",
        iconImg: "/icons/diamond.png",
        triggerRing: "ring-2 ring-cyan-400 hover:ring-cyan-300",
        triggerGlow: "shadow-[0_0_14px_rgba(6,182,212,0.5)] hover:shadow-[0_0_22px_rgba(6,182,212,0.8)]",
        triggerBadgeBg: "bg-[#06182c] text-cyan-200 border-cyan-400/80 shadow-[0_0_8px_rgba(6,182,212,0.6)]",
        dropdownBorder: "border-cyan-500/35",
        dropdownGlow: "shadow-[0_20px_60px_rgba(6,182,212,0.2)]",
        cardBg: "bg-gradient-to-br from-[#061427] via-[#0c2445] to-[#041529] text-white",
        cardBorder: "border-cyan-400/40",
        cardGlow: "shadow-[0_8px_24px_rgba(6,182,212,0.28),inset_0_1px_1px_rgba(255,255,255,0.25)]",
        cardShine: "bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-cyan-400/30 via-sky-500/10 to-transparent",
        badgeBg: "bg-gradient-to-r from-cyan-500/25 to-blue-500/20 text-cyan-200 border-cyan-400/60 shadow-[0_0_12px_rgba(6,182,212,0.45)]",
        privilegeText: " Tích 3% Xu • Freeship toàn quốc mọi đơn",
        privilegePill: "bg-cyan-950/70 border-cyan-400/30 text-cyan-200",
        progressBg: "bg-gradient-to-r from-cyan-400 via-sky-300 to-indigo-300",
        progressTrack: "bg-cyan-950/70",
        accentColor: "text-cyan-400",
        coinBadgeBg: "bg-cyan-500/15",
        coinBadgeText: "text-cyan-700 dark:text-cyan-300",
        coinBadgeBorder: "border-cyan-500/30",
        coinHover: "hover:bg-cyan-500/10 focus:bg-cyan-500/10 group-hover:text-cyan-600 dark:group-hover:text-cyan-400",
      };

    case "gold":
      return {
        name: "Hội viên Vàng",
        tagline: "ROYAL ELITE VIP",
        icon: "🥇",
        iconImg: "/icons/gold.png",
        triggerRing: "ring-2 ring-amber-400 hover:ring-amber-300",
        triggerGlow: "shadow-[0_0_14px_rgba(251,191,36,0.5)] hover:shadow-[0_0_22px_rgba(251,191,36,0.8)]",
        triggerBadgeBg: "bg-[#281804] text-amber-200 border-amber-400/80 shadow-[0_0_8px_rgba(251,191,36,0.6)]",
        dropdownBorder: "border-amber-500/35",
        dropdownGlow: "shadow-[0_20px_60px_rgba(251,191,36,0.18)]",
        cardBg: "bg-gradient-to-br from-[#261703] via-[#422906] to-[#1c1102] text-white",
        cardBorder: "border-amber-400/40",
        cardGlow: "shadow-[0_8px_24px_rgba(251,191,36,0.28),inset_0_1px_1px_rgba(255,255,255,0.25)]",
        cardShine: "bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-amber-400/30 via-yellow-500/10 to-transparent",
        badgeBg: "bg-gradient-to-r from-amber-500/25 to-yellow-500/20 text-amber-200 border-amber-400/60 shadow-[0_0_12px_rgba(251,191,36,0.4)]",
        privilegeText: " Tích 2% Xu • Giảm 50% Phí vận chuyển",
        privilegePill: "bg-amber-950/70 border-amber-400/30 text-amber-200",
        progressBg: "bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-200",
        progressTrack: "bg-amber-950/70",
        accentColor: "text-amber-400",
        coinBadgeBg: "bg-amber-500/15",
        coinBadgeText: "text-amber-700 dark:text-amber-300",
        coinBadgeBorder: "border-amber-500/30",
        coinHover: "hover:bg-amber-500/10 focus:bg-amber-500/10 group-hover:text-amber-600 dark:group-hover:text-amber-400",
      };

    case "silver":
      return {
        name: "Hội viên Bạc",
        tagline: "PREMIUM SILVER MEMBER",
        icon: "🥈",
        iconImg: "/icons/silver.png",
        triggerRing: "ring-2 ring-slate-300 dark:ring-slate-400 hover:ring-slate-200",
        triggerGlow: "shadow-[0_0_12px_rgba(148,163,184,0.4)] hover:shadow-[0_0_18px_rgba(148,163,184,0.7)]",
        triggerBadgeBg: "bg-[#18202d] text-slate-200 border-slate-300/80 shadow-[0_0_8px_rgba(148,163,184,0.45)]",
        dropdownBorder: "border-slate-400/35",
        dropdownGlow: "shadow-[0_20px_60px_rgba(148,163,184,0.15)]",
        cardBg: "bg-gradient-to-br from-[#141b26] via-[#222d3d] to-[#101620] text-white",
        cardBorder: "border-slate-300/40",
        cardGlow: "shadow-[0_8px_24px_rgba(148,163,184,0.22),inset_0_1px_1px_rgba(255,255,255,0.2)]",
        cardShine: "bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-slate-200/25 via-slate-400/10 to-transparent",
        badgeBg: "bg-gradient-to-r from-slate-300/25 to-slate-400/20 text-slate-100 border-slate-300/60 shadow-[0_0_10px_rgba(148,163,184,0.3)]",
        privilegeText: " Tích 1.5% Xu • Voucher sinh nhật 5%",
        privilegePill: "bg-slate-900/70 border-slate-300/30 text-slate-200",
        progressBg: "bg-gradient-to-r from-slate-300 via-slate-100 to-slate-300",
        progressTrack: "bg-slate-900/70",
        accentColor: "text-slate-300",
        coinBadgeBg: "bg-slate-400/15",
        coinBadgeText: "text-slate-700 dark:text-slate-300",
        coinBadgeBorder: "border-slate-400/30",
        coinHover: "hover:bg-slate-400/10 focus:bg-slate-400/10 group-hover:text-slate-700 dark:group-hover:text-slate-300",
      };

    case "bronze":
    default:
      return {
        name: "Hội viên Đồng",
        tagline: "ARTISAN BRONZE MEMBER",
        icon: "🥉",
        iconImg: "/icons/bronze.png",
        triggerRing: "ring-2 ring-amber-700/60 dark:ring-amber-600/70 hover:ring-amber-600",
        triggerGlow: "shadow-[0_0_10px_rgba(180,83,9,0.3)] hover:shadow-[0_0_16px_rgba(180,83,9,0.55)]",
        triggerBadgeBg: "bg-[#2b160b] text-amber-200 border-amber-700/80 shadow-[0_0_8px_rgba(180,83,9,0.35)]",
        dropdownBorder: "border-amber-700/35",
        dropdownGlow: "shadow-[0_20px_60px_rgba(180,83,9,0.14)]",
        cardBg: "bg-gradient-to-br from-[#21130a] via-[#351e12] to-[#190e07] text-white",
        cardBorder: "border-amber-700/40",
        cardGlow: "shadow-[0_8px_24px_rgba(180,83,9,0.22),inset_0_1px_1px_rgba(255,255,255,0.18)]",
        cardShine: "bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-amber-600/25 via-orange-600/10 to-transparent",
        badgeBg: "bg-gradient-to-r from-amber-700/30 to-amber-900/20 text-amber-200 border-amber-600/60 shadow-[0_0_10px_rgba(180,83,9,0.25)]",
        privilegeText: " Tích 1% Xu • Điểm danh 200 Xu/ngày",
        privilegePill: "bg-[#2b160b]/70 border-amber-700/30 text-amber-200",
        progressBg: "bg-gradient-to-r from-amber-600 via-orange-400 to-amber-500",
        progressTrack: "bg-[#1f0f07]",
        accentColor: "text-amber-400",
        coinBadgeBg: "bg-amber-700/15",
        coinBadgeText: "text-amber-700 dark:text-amber-300",
        coinBadgeBorder: "border-amber-700/30",
        coinHover: "hover:bg-amber-700/10 focus:bg-amber-700/10 group-hover:text-amber-700 dark:group-hover:text-amber-400",
      };
  }
}

export function SiteHeader() {
  const { openModal } = useAuthModal();
  const { user, profile, role, logout } = useAuth();
  const userTier: MembershipTier = (profile?.membership_tier as MembershipTier) || "bronze";
  const tierConfig = TIER_CONFIGS[userTier] || TIER_CONFIGS.bronze;
  const tierStyle = getTierTheme(userTier, role);

  // Tính toán tiến trình thăng hạng VIP
  const lifetimeCoins = Number(profile?.lifetime_coins || 0);
  let progressPercent = 100;
  let pointsToNext = 0;
  let nextTierName = "";
  let nextTierIcon = "";
  let nextTierIconImg = "";

  if (userTier === "bronze") {
    const target = 5000;
    pointsToNext = Math.max(0, target - lifetimeCoins);
    progressPercent = Math.min(100, Math.max(0, Math.round((lifetimeCoins / target) * 100)));
    nextTierName = "Hạng Bạc";
    nextTierIcon = "🥈";
    nextTierIconImg = "/icons/silver.png";
  } else if (userTier === "silver") {
    const currentBase = 5000;
    const target = 20000;
    pointsToNext = Math.max(0, target - lifetimeCoins);
    const earned = Math.max(0, lifetimeCoins - currentBase);
    progressPercent = Math.min(100, Math.max(0, Math.round((earned / (target - currentBase)) * 100)));
    nextTierName = "Hạng Vàng";
    nextTierIcon = "🥇";
    nextTierIconImg = "/icons/gold.png";
  } else if (userTier === "gold") {
    const currentBase = 20000;
    const target = 50000;
    pointsToNext = Math.max(0, target - lifetimeCoins);
    const earned = Math.max(0, lifetimeCoins - currentBase);
    progressPercent = Math.min(100, Math.max(0, Math.round((earned / (target - currentBase)) * 100)));
    nextTierName = "Kim Cương";
    nextTierIcon = "💎";
    nextTierIconImg = "/icons/diamond.png";
  } else {
    // diamond
    progressPercent = 100;
    pointsToNext = 0;
  }
  const [cartCount, setCartCount] = useState(0);
  const [isBumping, setIsBumping] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const pathname = usePathname();
  const initialLoadDone = useRef(false);

  // Search Suggestions State
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    try {
      const history = JSON.parse(localStorage.getItem("searchHistory") || "[]");
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSearchHistory(history);
    } catch (e) { }
  }, []);

  const addToHistory = (term: string) => {
    if (!term.trim()) return;
    const newHistory = [term, ...searchHistory.filter(h => h !== term)].slice(0, 5);
    setSearchHistory(newHistory);
    localStorage.setItem("searchHistory", JSON.stringify(newHistory));
  };

  useEffect(() => {
    const fetchResults = async () => {
      if (searchQuery.trim().length === 0) {
        setSearchResults([]);
        return;
      }
      setIsSearching(true);
      const { data } = await getProduct(searchQuery, 1, 5);
      if (data) {
        setSearchResults(data);
      }
      setIsSearching(false);
    };

    const debounceTimer = setTimeout(fetchResults, 300);
    return () => clearTimeout(debounceTimer);
  }, [searchQuery]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const scrollToTop = () => {
    if (typeof window !== "undefined") {
      window.scrollTo(0, 0);
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    }
  };

  const handleMobileNav = (href: string, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
    }
    setIsMobileMenuOpen(false);
    scrollToTop();

    setTimeout(() => {
      if (pathname !== href) {
        router.push(href);
      }
      scrollToTop();
    }, 100);

    setTimeout(() => {
      scrollToTop();
    }, 350);
  };

  useEffect(() => {
    if (typeof window !== "undefined" && "scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual";
    }
    const timer = setTimeout(() => {
      setShowSuggestions(false);
      setIsMobileMenuOpen(false);
    }, 0);
    if (typeof window !== "undefined" && !window.location.hash) {
      scrollToTop();
      const scrollTimer = setTimeout(() => {
        scrollToTop();
      }, 350);
      return () => {
        clearTimeout(timer);
        clearTimeout(scrollTimer);
      };
    }
    return () => clearTimeout(timer);
  }, [pathname]);

  useEffect(() => {
    if (cartCount > 0 && initialLoadDone.current) {
      const startTimer = setTimeout(() => setIsBumping(true), 0);
      const endTimer = setTimeout(() => setIsBumping(false), 300);
      return () => {
        clearTimeout(startTimer);
        clearTimeout(endTimer);
      };
    }
  }, [cartCount]);

  useEffect(() => {
    if (!user) {
      const updateGuestCount = () => {
        const items = getGuestCartItems();
        const totalQty = items.reduce((sum, item) => sum + item.quantity, 0);
        setCartCount(totalQty);
        initialLoadDone.current = true;
      };
      setTimeout(updateGuestCount, 0);
      window.addEventListener("cart-updated", updateGuestCount);
      return () => {
        window.removeEventListener("cart-updated", updateGuestCount);
      };
    }
    const fetchCount = async () => {
      const { count } = await supabase.from('cart_items').select('id', { count: 'exact' }).eq('user_id', user.id);
      if (count !== null) setCartCount(count);
      initialLoadDone.current = true;
    };
    fetchCount();

    // Listen to custom event for instant updates from other components
    const handleCartUpdate = () => fetchCount();
    window.addEventListener("cart-updated", handleCartUpdate);

    const channel = supabase.channel('cart-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cart_items', filter: `user_id=eq.${user.id}` }, () => {
        fetchCount();
      })
      .subscribe();

    return () => {
      window.removeEventListener("cart-updated", handleCartUpdate);
      supabase.removeChannel(channel);
    };
  }, [user]);
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60 transition-all duration-300 shadow-lg ">
      <div className="grid grid-cols-[1fr_auto] md:flex md:flex-nowrap justify-between items-center w-full px-4 md:px-8 max-w-[1440px] mx-auto py-3 md:py-0 md:h-[80px] z-50 gap-y-3 md:gap-y-0">
        {/* Brand */}
        <div className="flex items-center gap-1.5 md:gap-4 order-1 min-w-0 pr-2">
          {/* Mobile Menu */}
          <div className="flex lg:hidden items-center shrink-0 ">
            <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="mr-1 md:mr-2 h-9 w-9">
                  <Image src="/icons/menu2.png" alt="Logo" width={25} height={25} />
                </Button>
              </SheetTrigger>
              <SheetContent
                side="left"
                onCloseAutoFocus={(e) => e.preventDefault()}
                className="w-[310px] sm:w-[360px] p-0 flex flex-col h-full bg-background/80 backdrop-blur-2xl overflow-hidden border-r border-border/50 shadow-2xl"
              >
                <SheetTitle className="sr-only">Menu Điều Hướng</SheetTitle>
                {/* 1. Header Khu Vực Tài Khoản */}
                <div className="p-4 sm:p-5 bg-card/40 border-b border-border/50 relative">
                  <div className="relative z-10">
                    {user ? (
                      <div className="space-y-3">
                        {/* VIP Card Thượng Hạng for Mobile Sheet */}
                        <div className={cn("p-4 rounded-[20px] relative overflow-hidden border shadow-lg transition-all", tierStyle.cardBg, tierStyle.cardBorder, tierStyle.cardGlow)}>
                          <div className={cn("absolute inset-0 pointer-events-none", tierStyle.cardShine)} />
                          <div className="absolute -top-10 -right-10 w-28 h-28 rounded-full blur-2xl opacity-40 pointer-events-none bg-white/20" />
                          <div className="relative z-10 space-y-2.5">
                            <div className="flex items-center gap-3">
                              <div className="relative shrink-0">
                                <Avatar className="h-12 w-12 ring-2 ring-white/30 shadow-md">
                                  <AvatarImage src={profile?.avatar_url || user.user_metadata?.avatar_url || user.user_metadata?.picture} className="object-cover" />
                                  <AvatarFallback className="bg-gradient-to-br from-primary to-primary/50 text-primary-foreground font-bold text-base">
                                    {user.email?.charAt(0).toUpperCase()}
                                  </AvatarFallback>
                                </Avatar>
                                <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-black/70 border border-white/40 flex items-center justify-center text-[9px] shadow-sm overflow-hidden p-0.5">
                                  {tierStyle.iconImg ? (
                                    <Image
                                      src={tierStyle.iconImg}
                                      alt={tierStyle.name}
                                      width={13}
                                      height={13}
                                      unoptimized
                                      className="object-contain"
                                    />
                                  ) : (
                                    tierStyle.icon
                                  )}
                                </span>
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-1.5">
                                  <h4 className="font-extrabold text-[15px] truncate text-white leading-tight">
                                    {profile?.full_name || user.user_metadata?.full_name || user.email?.split('@')[0]}
                                  </h4>
                                  <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black shrink-0 border uppercase tracking-wider", tierStyle.badgeBg)}>
                                    {tierStyle.iconImg ? (
                                      <Image
                                        src={tierStyle.iconImg}
                                        alt={tierStyle.name}
                                        width={13}
                                        height={13}
                                        unoptimized
                                        className="object-contain shrink-0"
                                      />
                                    ) : (
                                      <span>{tierStyle.icon}</span>
                                    )}
                                    <span>{role === "admin" ? "Admin" : role === "staff" ? "Staff" : tierConfig.name}</span>
                                  </span>
                                </div>
                                <p className="text-[12px] text-white/70 truncate font-mono mt-0.5">{user.email}</p>
                              </div>
                            </div>

                            {/* Privilege Ribbon */}
                            <div className={cn("px-2.5 py-1.5 rounded-xl border text-[11px] font-medium flex items-center justify-between gap-1.5 shadow-inner", tierStyle.privilegePill)}>
                              <span className="truncate">{tierStyle.privilegeText}</span>
                              {/* <Sparkles className="w-3.5 h-3.5 shrink-0 opacity-80" /> */}
                            </div>

                            {/* Coin balance & VIP link */}
                            <Link 
                              href="/account/coins"
                              onClick={(e) => handleMobileNav("/account/coins", e)}
                              className="flex items-center justify-between text-[11.5px] font-bold text-white/90 hover:text-white pt-1 border-t border-white/10 transition-colors"
                            >
                              <span className="flex items-center gap-1.5">
                                <span>Ví Xu:</span>
                                <span className="font-mono text-amber-300 font-extrabold text-[12.5px]">
                                  {Number(profile?.coins_balance || 0).toLocaleString("vi-VN")} Xu
                                </span>
                              </span>
                              <span className="inline-flex items-center gap-0.5 text-white/80">
                                <span>Xem đặc quyền VIP</span>
                                <ChevronRight className="w-3.5 h-3.5" />
                              </span>
                            </Link>
                          </div>
                        </div>

                        {/* Nút vào Bảng Quản Trị dành riêng cho Admin */}
                        {role === "admin" && (
                          <Link
                            href="/dashboard"
                            onClick={(e) => handleMobileNav("/dashboard", e)}
                            className="flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-[14px] bg-gradient-to-r from-red-600 to-amber-600 text-white font-bold text-[14.5px] shadow-md shadow-red-500/20 hover:opacity-90 hover:scale-[1.02] transition-all duration-300"
                          >
                            <Image src="/icons/dashboard3.png" alt="Logo" width={22} height={22} className="object-contain" /> Bảng Quản Trị (Admin)
                          </Link>
                        )}
                      </div>
                    ) : (
                      <div className="text-center py-2 space-y-3">

                        <div>
                          <h4 className="font-bold text-base text-foreground ">Chào mừng đến với</h4>
                          <div className="group text-lg md:text-2xl font-black tracking-tighter flex-shrink-0 flex justify-center items-center gap-1.5 md:gap-2.5 transition-all duration-300 min-w-0 overflow-hidden">
                            <div className="relative shrink-0">
                              <div className="absolute -inset-1 rounded-full group-hover:opacity-80 transition duration-800 animate-pulse" />
                              <Image src="/icons/luxecommerce.png" alt="Logo" width={28} height={28} className="relative md:w-[34px] md:h-[34px]" />
                            </div>
                            <span className="flex items-center tracking-tight truncate">
                              <span className="bg-gradient-to-r from-violet-500 via-purple-400 to-fuchsia-400 dark:from-violet-300 dark:via-purple-200 dark:to-fuchsia-300 bg-clip-text text-transparent animate-shimmer-metallic drop-shadow-[0_0_12px_rgba(168,85,247,0.45)]">
                                Luxe
                              </span>
                              <span className="ml-0.5 bg-gradient-to-r from-slate-700 via-slate-500 to-slate-800 dark:from-slate-100 dark:via-white dark:to-slate-300 bg-clip-text text-transparent drop-shadow-[0_0_8px_rgba(255,255,255,0.3)] truncate">
                                Commerce
                              </span>
                              <Image src="/icons/star.png" alt="Logo" width={20} height={20} className="ml-1 md:w-[25px] md:h-[25px] animate__animated animate__flash animate__infinite hidden sm:inline-block shrink-0" />
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Đăng nhập để nhận ưu đãi & theo dõi đơn hàng
                          </p>
                        </div>
                        <SheetClose asChild>
                          <Button
                            onClick={() => openModal("login")}
                            className="w-full font-bold shadow-md shadow-primary/20"
                            size="lg"
                          >
                            Đăng nhập / Đăng ký
                          </Button>
                        </SheetClose>
                      </div>
                    )}
                  </div>
                </div>

                {/* 2. Menu Điều Hướng Cuộn */}
                <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6 ">
                  {/* Khám Phá */}
                  <div className="space-y-1">
                    <p className="px-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground/80 mb-2">
                      Khám phá
                    </p>
                    <Link
                      href="/"
                      onClick={(e) => handleMobileNav("/", e)}
                      className={cn(
                        "flex items-center gap-3 px-3.5 py-3 rounded-[14px] font-bold text-[14.5px] transition-all duration-200",
                        pathname === "/" ? "bg-primary/10 text-primary shadow-sm ring-1 ring-primary/20" : "text-foreground/70 hover:bg-muted/50 hover:text-foreground"
                      )}
                    >
                      <Image src="/icons/home_black.png" alt="Home" width={22} height={22} className="dark:hidden" />
                      <Image src="/icons/home_white.png" alt="Home" width={22} height={22} className="hidden dark:block" />
                      Trang chủ
                    </Link>
                    <Link
                      href="/products"
                      onClick={(e) => handleMobileNav("/products", e)}
                      className={cn(
                        "flex items-center gap-3 px-3.5 py-3 rounded-[14px] font-bold text-[14.5px] transition-all duration-200",
                        pathname?.startsWith("/products") ? "bg-primary/10 text-primary shadow-sm ring-1 ring-primary/20" : "text-foreground/70 hover:bg-muted/50 hover:text-foreground"
                      )}
                    >
                      <Image src="/icons/product_black.png" alt="Products" width={22} height={22} className="dark:hidden" />
                      <Image src="/icons/product_white.png" alt="Products" width={22} height={22} className="hidden dark:block" />
                      Tất cả sản phẩm
                    </Link>
                    {/* Cart link — ẩn với Admin và Staff */}
                    {/* {role !== "admin" && role !== "staff" && (
                      <SheetClose asChild>
                        <Link
                          href="/cart"
                          className={cn(
                            "flex items-center justify-between px-3 py-2.5 rounded-xl font-medium text-sm transition-colors",
                            pathname === "/cart" ? "bg-primary/10 text-primary font-bold" : "text-foreground/80 hover:bg-muted"
                          )}
                        >
                          <span className="flex items-center gap-3">
                            <ShoppingCart className="w-4 h-4 text-blue-500" /> Giỏ hàng
                          </span>
                          {cartCount > 0 && (
                            <span className="bg-red-600 text-white text-[11px] font-bold px-2 py-0.5 rounded-full">
                              {cartCount}
                            </span>
                          )}
                        </Link>
                      </SheetClose>
                    )} */}
                    {/* <SheetClose asChild>
                      <Link
                        href="/account/wishlist"
                        className={cn(
                          "flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium text-sm transition-colors",
                          pathname === "/account/wishlist" ? "bg-primary/10 text-primary font-bold" : "text-foreground/80 hover:bg-muted"
                        )}
                      >
                        <Heart className="w-4 h-4 text-rose-500" /> Sản phẩm yêu thích
                      </Link>
                    </SheetClose> */}
                  </div>

                  {/* Cá Nhân (Chỉ hiện khi đăng nhập — Customer) */}
                  {user && role !== "admin" && role !== "staff" && (
                    <div className="space-y-1 pt-2 border-t border-border/40">
                      <p className="px-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground/80 mb-2 mt-2">
                        Tài khoản của tôi
                      </p>
                      <Link
                        href="/account/coins"
                        onClick={(e) => handleMobileNav("/account/coins", e)}
                        className="flex items-center justify-between px-3.5 py-3 rounded-[14px] font-bold text-[14.5px] bg-amber-500/10 text-amber-700 dark:text-amber-400 hover:bg-amber-500/20 shadow-xs transition-all duration-200"
                      >
                        <span className="flex items-center gap-3">
                          <Sparkles className="w-5 h-5 text-amber-500" /> Ví Xu & Điểm danh
                        </span>
                        <span className="text-xs bg-amber-500/20 px-2 py-0.5 rounded-full font-extrabold text-amber-800 dark:text-amber-300">
                          {Number(profile?.coins_balance || 0).toLocaleString("vi-VN")} Xu
                        </span>
                      </Link>
                      <Link
                        href="/account/referrals"
                        onClick={(e) => handleMobileNav("/account/referrals", e)}
                        className="flex items-center justify-between px-3.5 py-3 rounded-[14px] font-bold text-[14.5px] bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/20 shadow-xs transition-all duration-200"
                      >
                        <span className="flex items-center gap-3">
                          <Gift className="w-5 h-5 text-emerald-500" /> Giới thiệu bạn bè
                        </span>
                        <span className="text-xs bg-emerald-500/20 px-2 py-0.5 rounded-full font-extrabold text-emerald-800 dark:text-emerald-300">
                          🎁 +10.000 Xu
                        </span>
                      </Link>
                      <Link
                        href="/cart"
                        onClick={(e) => handleMobileNav("/cart", e)}
                        className="flex items-center justify-between px-3.5 py-3 rounded-[14px] font-bold text-[14.5px] text-foreground/70 hover:bg-muted/50 hover:text-foreground transition-all duration-200"
                      >
                        <span className="flex items-center gap-3">
                          <ShoppingCart className="w-5 h-5 text-blue-500" /> Giỏ hàng
                        </span>
                        {cartCount > 0 && (
                          <span className="bg-red-600 text-white text-[11px] font-bold px-2 py-0.5 rounded-full shadow-sm">
                            {cartCount}
                          </span>
                        )}
                      </Link>
                      <Link
                        href="/account/orders"
                        onClick={(e) => handleMobileNav("/account/orders", e)}
                        className="flex items-center gap-3 px-3.5 py-3 rounded-[14px] font-bold text-[14.5px] text-foreground/70 hover:bg-muted/50 hover:text-foreground transition-all duration-200"
                      >
                        <BoxIcon className="w-5 h-5 text-amber-500" /> Lịch sử đơn hàng
                      </Link>
                      <Link
                        href="/account/addresses"
                        onClick={(e) => handleMobileNav("/account/addresses", e)}
                        className="flex items-center gap-3 px-3.5 py-3 rounded-[14px] font-bold text-[14.5px] text-foreground/70 hover:bg-muted/50 hover:text-foreground transition-all duration-200"
                      >
                        <MapPin className="w-5 h-5 text-emerald-500" /> Sổ địa chỉ nhận hàng
                      </Link>
                      <Link
                        href="/account/settings"
                        onClick={(e) => handleMobileNav("/account/settings", e)}
                        className="flex items-center gap-3 px-3.5 py-3 rounded-[14px] font-bold text-[14.5px] text-foreground/70 hover:bg-muted/50 hover:text-foreground transition-all duration-200"
                      >
                        <Settings className="w-5 h-5 text-gray-500" /> Cài đặt tài khoản
                      </Link>
                    </div>
                  )}

                  {/* Staff: shortcut vào Staff Dashboard */}
                  {user && role === "staff" && (
                    <div className="space-y-1 pt-2 border-t border-border/40">
                      <p className="px-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground/80 mb-2 mt-2">
                        Khu vực nội bộ
                      </p>
                      <Link
                        href="/dashboard"
                        onClick={(e) => handleMobileNav("/dashboard", e)}
                        className="flex items-center gap-3 px-3.5 py-3 rounded-[14px] font-bold text-[14.5px] bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 shadow-sm transition-all duration-200"
                      >
                        <Image src="/icons/dashboard5.png" alt="Logo" width={22} height={22} />
                        Bảng điều hành (Staff)
                      </Link>
                    </div>
                  )}
                </div>

                {/* 3. Chân Drawer */}
                <div className="p-4 border-t border-border/50 bg-card/40 space-y-3 mt-auto">
                  <div className="flex items-center justify-between px-3 py-2">
                    <span className="text-[13.5px] font-bold text-foreground/80">Giao diện (Sáng/Tối)</span>
                    <ThemeToggle />
                  </div>
                  {user && (
                    <SheetClose asChild>
                      <Button
                        variant="ghost"
                        className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-500/10 dark:hover:bg-red-900/30 font-bold text-[14px] h-12 px-4 rounded-[14px] transition-all duration-200"
                        onClick={logout}
                      >
                        <LogOut className="w-5 h-5 mr-3" /> Đăng xuất tài khoản
                      </Button>
                    </SheetClose>
                  )}
                </div>
              </SheetContent>
            </Sheet>
          </div>
          <Link href="/" className="group text-lg md:text-2xl font-black tracking-tighter flex-shrink-0 flex items-center gap-1.5 md:gap-2.5 transition-all duration-300 min-w-0 overflow-hidden">
            <div className="relative shrink-0">
              <div className="absolute -inset-1 rounded-full group-hover:opacity-80 transition duration-800 animate-pulse" />
              <Image src="/icons/luxecommerce.png" alt="Logo" width={28} height={28} className="relative md:w-[34px] md:h-[34px]" />
            </div>
            <span className="flex items-center tracking-tight truncate">
              <span className="bg-gradient-to-r from-violet-500 via-purple-400 to-fuchsia-400 dark:from-violet-300 dark:via-purple-200 dark:to-fuchsia-300 bg-clip-text text-transparent animate-shimmer-metallic drop-shadow-[0_0_12px_rgba(168,85,247,0.45)]">
                Luxe
              </span>
              <span className="ml-0.5 bg-gradient-to-r from-slate-700 via-slate-500 to-slate-800 dark:from-slate-100 dark:via-white dark:to-slate-300 bg-clip-text text-transparent drop-shadow-[0_0_8px_rgba(255,255,255,0.3)] truncate">
                Commerce
              </span>
              <Image src="/icons/star.png" alt="Logo" width={20} height={20} className="ml-1 md:w-[25px] md:h-[25px] animate__animated animate__flash animate__infinite hidden sm:inline-block shrink-0" />
            </span>
          </Link>
        </div>

        {/* Search (Row 2 on Mobile, Center on Desktop) */}
        <div ref={searchRef} className="col-span-2 md:col-span-1 flex w-full md:w-auto order-3 md:order-2 md:flex-1 md:max-w-[480px] lg:max-w-xl md:mx-8 relative group">
          <form action="/products" method="GET" className="w-full relative flex items-center" onSubmit={() => addToHistory(searchQuery)}>
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4 transition-colors group-focus-within:text-primary" />
            <input
              name="search"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setShowSuggestions(true);
              }}
              onFocus={() => setShowSuggestions(true)}
              className="w-full bg-muted/50 hover:bg-muted/80 focus:bg-background py-2.5 pl-11 pr-4 rounded-full border border-transparent focus:border-primary/30 focus:ring-4 focus:ring-primary/10 text-sm font-medium transition-all outline-none shadow-sm placeholder:text-muted-foreground/70"
              placeholder="Tìm kiếm sản phẩm cao cấp..."
              type="text"
              required
              autoComplete="off"
            />
          </form>

          {/* Suggestions & History Dropdown */}
          {showSuggestions && (searchQuery.trim().length > 0 || searchHistory.length > 0) && (
            <div className="absolute top-full mt-3 w-full bg-card/100 backdrop-blur-md border border-border/50 rounded-[24px] shadow-[0_10px_40px_rgba(0,0,0,0.08)] overflow-hidden z-50">
              {searchQuery.trim().length > 0 ? (
                // Search Results View
                isSearching ? (
                  <div className="p-6 text-center text-sm font-medium text-muted-foreground flex items-center justify-center gap-2">
                    <Image src="/icons/star.png" alt="Đang tìm kiếm" width={24} height={24} className="object-contain" /> Đang tìm kiếm...
                  </div>
                ) : searchResults.length > 0 ? (
                  <div className="py-2">
                    <div className="px-4 py-2 flex items-center justify-between text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      <span>Gợi ý sản phẩm</span>
                    </div>
                    {searchResults.map((product) => {
                      const price = product.price;
                      const salePrice = product.discount_percent ? Math.round(price * (1 - product.discount_percent / 100)) : price;
                      return (
                        <Link
                          key={product.id}
                          href={`/product/${product.id}`}
                          className="flex items-center gap-4 px-4 py-3 hover:bg-primary/5 transition-colors group"
                          onClick={() => { setShowSuggestions(false); addToHistory(searchQuery); }}
                        >
                          <div className="w-12 h-12 rounded-[14px] overflow-hidden border border-border/50 group-hover:border-primary/30 transition-colors bg-muted/30 p-1 flex items-center justify-center">
                            <Image width={48} height={48} unoptimized src={product.image_url || "https://placehold.co/48x48"} alt={product.name} className="max-w-full max-h-full object-contain mix-blend-multiply dark:mix-blend-normal" />
                          </div>
                          <div className="flex flex-col flex-1">
                            <span className="text-sm font-bold text-foreground group-hover:text-primary transition-colors line-clamp-1">{product.name}</span>
                            <span className="text-xs text-red-600 font-black mt-0.5">
                              {new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(salePrice)}
                            </span>
                          </div>
                        </Link>
                      )
                    })}
                    <div className="border-t border-border/50 p-3 mt-1 bg-background/50">
                      <Link href={`/products?search=${searchQuery}`} onClick={() => { setShowSuggestions(false); addToHistory(searchQuery); }} className="w-full py-2.5 rounded-[14px] bg-primary/10 hover:bg-primary hover:text-primary-foreground text-primary text-sm font-bold text-center block transition-all shadow-sm">
                        Xem tất cả kết quả ({searchResults.length}+)
                      </Link>
                    </div>
                  </div>
                ) : (
                  <div className="p-6 text-center text-sm font-medium text-muted-foreground">Không tìm thấy sản phẩm nào phù hợp</div>
                )
              ) : (
                // Search History View
                <div className="p-5">
                  <div className="flex justify-between items-center mb-4 px-1">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5"><Search className="w-3.5 h-3.5" /> Lịch sử tìm kiếm</h4>
                    <button
                      type="button"
                      onClick={() => { setSearchHistory([]); localStorage.removeItem("searchHistory"); }}
                      className="text-xs font-medium text-muted-foreground hover:text-red-500 transition-colors bg-secondary/50 hover:bg-red-500/10 px-2.5 py-1.5 rounded-md"
                    >
                      Xoá tất cả
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {searchHistory.map((term, i) => (
                      <Link
                        key={`${term}-${i}`}
                        href={`/products?search=${term}`}
                        onClick={() => { setShowSuggestions(false); addToHistory(term); }}
                        className="px-4 py-2 bg-background border border-border/60 hover:border-primary/50 hover:bg-primary/5 hover:text-primary hover:shadow-md rounded-full text-sm font-medium transition-all shadow-sm"
                      >
                        {term}
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Actions (Right) */}
        <div className="flex items-center justify-end gap-1 flex-shrink-0 order-2 md:order-3">
          {/* Navigation Links (Desktop) */}
          <nav className="hidden lg:flex items-center gap-1 mr-3 bg-muted/40 p-1 rounded-full border border-border/40">
            <Link className={cn("flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-bold transition-all duration-300 group hover:-translate-y-[1px] hover:shadow-sm active:scale-95 active:translate-y-0", pathname === "/" ? "bg-background shadow-[0_2px_10px_rgba(0,0,0,0.05)] text-primary ring-1 ring-border/30" : "text-muted-foreground hover:text-foreground hover:bg-background/60")} href="/">
              <Image src="/icons/home_black.png" alt="Home" width={18} height={18} className="dark:hidden opacity-90 transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-3" />
              <Image src="/icons/home_white.png" alt="Home" width={18} height={18} className="hidden dark:block opacity-90 transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-3" />
              Trang chủ
            </Link>
            <Link className={cn("flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-bold transition-all duration-300 group hover:-translate-y-[1px] hover:shadow-sm active:scale-95 active:translate-y-0", pathname === "/products" || pathname?.startsWith("/products/") ? "bg-background shadow-[0_2px_10px_rgba(0,0,0,0.05)] text-primary ring-1 ring-border/30" : "text-muted-foreground hover:text-foreground hover:bg-background/60")} href="/products">
              <Image src="/icons/product_black.png" alt="Products" width={18} height={18} className="dark:hidden opacity-90 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3" />
              <Image src="/icons/product_white.png" alt="Products" width={18} height={18} className="hidden dark:block opacity-90 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3" />
              Sản phẩm
            </Link>
          </nav>

          <div className="flex items-center gap-1 md:gap-1.5 lg:border-l-2 lg:border-border/100 lg:pl-4 h-4">
            <div className="mr-1 hidden md:block">
              <ThemeToggle />
            </div>

            {/* Yêu thích (Icon) */}
            <div className="hidden md:block">
              {user ? (
                <Link href="/account/wishlist" className="relative inline-block">
                  <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 transition-all duration-300 rounded-full h-9 w-9">
                    <Image src="/icons/love3.png" alt="Wishlist" width={20} height={20} />
                  </Button>
                </Link>
              ) : (
                <Button variant="ghost" size="icon" onClick={() => openModal('login')} className="text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 transition-all duration-300 rounded-full h-9 w-9">
                  <Image src="/icons/love3.png" alt="Wishlist" width={20} height={20} />
                </Button>
              )}
            </div>

            {/* 1. Thông báo (Tạm ẩn theo yêu cầu của User) */}
            {/* {user && <NotificationDropdown userId={user.id} />} */}

            {/* 2. Icon Giỏ hàng — ẩn với Admin và Staff */}
            {role !== "admin" && role !== "staff" && (
              <Link
                href="/cart"
                className="relative inline-block"
              >
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(
                    "text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-full h-9 w-9 relative transition-all duration-300",
                    isBumping ? "scale-125 text-primary" : "scale-100"
                  )}
                >
                  <ShoppingCart className="w-5 h-5" />
                  {cartCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-[18px] h-[18px] bg-red-600 text-primary-foreground dark:text-white text-[10px] font-bold flex items-center justify-center rounded-full shadow-sm ring-2 ring-background">
                      {cartCount}
                    </span>
                  )}
                </Button>
              </Link>
            )}
          </div>

          {/* 3. Phải ngoài cùng: Avatar (nếu đăng nhập) hoặc Nút Đăng nhập (nếu chưa) */}
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    "relative inline-flex items-center justify-center rounded-full transition-all duration-300 ml-1 p-0.5 shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-offset-2 cursor-pointer hover:scale-105 active:scale-95",
                    tierStyle.triggerRing,
                    tierStyle.triggerGlow
                  )}
                  aria-label="Menu tài khoản cá nhân"
                >
                  <Avatar className="h-9 w-9 md:h-10 md:w-10 ring-1 ring-white/20">
                    <AvatarImage src={profile?.avatar_url || user.user_metadata?.avatar_url || user.user_metadata?.picture} className="object-cover" />
                    <AvatarFallback className="bg-gradient-to-br from-primary to-primary/50 text-primary-foreground font-bold text-xs">
                      {user.email?.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  {/* Micro Tier Badge on bottom-right corner */}
                  <span
                    className={cn(
                      "absolute -bottom-1 -right-1 w-4 h-4 md:w-4.5 md:h-4.5 rounded-full flex items-center justify-center border transition-transform duration-300 shadow-sm overflow-hidden p-0.5",
                      tierStyle.triggerBadgeBg
                    )}
                    title={`${tierStyle.name} (${tierConfig.name})`}
                  >
                    {tierStyle.iconImg ? (
                      <Image
                        src={tierStyle.iconImg}
                        alt={tierStyle.name}
                        width={13}
                        height={13}
                        unoptimized
                        className="object-contain"
                      />
                    ) : (
                      <span className="text-[9px] md:text-[10px]">{tierStyle.icon}</span>
                    )}
                  </span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                sideOffset={8}
                className={cn(
                  "w-[340px] p-2 rounded-[24px] shadow-2xl border bg-card/95 backdrop-blur-2xl z-[100] transition-all",
                  tierStyle.dropdownBorder,
                  tierStyle.dropdownGlow
                )}
              >
                {/* 1. VIP Membership Card Header */}
                <div className={cn("p-3.5 rounded-[18px] relative overflow-hidden border mb-1.5 transition-all", tierStyle.cardBg, tierStyle.cardBorder, tierStyle.cardGlow)}>
                  {/* Ambient radial shine */}
                  <div className={cn("absolute inset-0 pointer-events-none", tierStyle.cardShine)} />
                  <div className="absolute -top-10 -right-10 w-28 h-28 rounded-full blur-2xl opacity-40 pointer-events-none bg-white/20" />

                  <div className="relative z-10 space-y-2.5">
                    {/* Top: Avatar, Name, Email & Tier Badge */}
                    <div className="flex items-center gap-3">
                      <div className="relative shrink-0">
                        <Avatar className="h-11 w-11 ring-2 ring-white/30 shadow-md">
                          <AvatarImage src={profile?.avatar_url || user.user_metadata?.avatar_url || user.user_metadata?.picture} className="object-cover" />
                          <AvatarFallback className="bg-gradient-to-br from-primary to-primary/50 text-primary-foreground font-bold text-sm">
                            {user.email?.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-black/70 border border-white/40 flex items-center justify-center shadow-sm overflow-hidden p-0.5">
                          {tierStyle.iconImg ? (
                            <Image
                              src={tierStyle.iconImg}
                              alt={tierStyle.name}
                              width={16}
                              height={16}
                              unoptimized
                              className="object-contain"
                            />
                          ) : (
                            <span className="text-[9px]">{tierStyle.icon}</span>
                          )}
                        </span>
                      </div>

                      <div className="flex flex-col min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-1.5">
                          <p className="text-[14.5px] font-extrabold truncate text-white leading-tight drop-shadow-xs">
                            {profile?.full_name || user.email?.split('@')[0]}
                          </p>
                          <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10.5px] font-black shrink-0 border uppercase tracking-wider", tierStyle.badgeBg)}>
                            {tierStyle.iconImg ? (
                              <Image
                                src={tierStyle.iconImg}
                                alt={tierStyle.name}
                                width={16}
                                height={16}
                                unoptimized
                                className="object-contain shrink-0"
                              />
                            ) : (
                              <span>{tierStyle.icon}</span>
                            )}
                            <span>{role === "admin" ? "Admin" : role === "staff" ? "Staff" : tierConfig.name}</span>
                          </span>
                        </div>
                        <p className="text-[11.5px] text-white/70 truncate font-mono font-medium mt-0.5">
                          {user.email}
                        </p>
                      </div>
                    </div>

                    {/* Middle: Privilege Ribbon */}
                    <div className={cn("px-2.5 py-1.5 rounded-xl border text-[11px]  font-medium flex items-center justify-between gap-2 shadow-inner", tierStyle.privilegePill)}>
                      <span className="truncate">{tierStyle.privilegeText}</span>
                      {/* <Sparkles className="w-3.5 h-3.5 shrink-0 opacity-80" /> */}
                    </div>

                    {/* Bottom: Progress to Next Tier (For Customer) */}
                    {!role && (
                      <div className="space-y-1 pt-0.5">
                        <div className="flex items-center justify-between text-[11px]">
                          {pointsToNext > 0 ? (
                            <span className="text-white/80 font-medium truncate flex items-center gap-1">
                              <span>Cần</span>
                              <strong className="text-white font-bold">{pointsToNext.toLocaleString("vi-VN")} Xu</strong>
                              <span>lên</span>
                              {nextTierIconImg ? (
                                <Image
                                  src={nextTierIconImg}
                                  alt={nextTierName}
                                  width={16}
                                  height={16}
                                  unoptimized
                                  className="object-contain inline-block shrink-0 -mt-0.5"
                                />
                              ) : (
                                <span>{nextTierIcon}</span>
                              )}
                              <span className="font-bold text-white">{nextTierName}</span>
                            </span>
                          ) : (
                            <span className="text-cyan-200 font-bold flex items-center gap-1">
                              <Sparkles className="w-3 h-3 text-cyan-300" /> Đặc quyền VIP cao nhất
                            </span>
                          )}
                          <span className="text-white/90 font-mono font-bold shrink-0 ml-1.5">
                            {progressPercent}%
                          </span>
                        </div>

                        <div className={cn("h-1.5 w-full rounded-full overflow-hidden p-0.5 shadow-inner", tierStyle.progressTrack)}>
                          <div
                            className={cn("h-full rounded-full transition-all duration-700", tierStyle.progressBg)}
                            style={{ width: `${progressPercent}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {/* Action link inside card */}
                    <Link 
                      href="/account/coins"
                      className="flex items-center justify-between text-[11px] font-bold text-white/90 hover:text-white pt-1 border-t border-white/10 transition-colors group/link"
                    >
                      <span className="flex items-center gap-1.5">
                        <span>Ví Xu:</span>
                        <span className="font-mono text-amber-300 font-extrabold text-[12px]">
                          {Number(profile?.coins_balance || 0).toLocaleString("vi-VN")} Xu
                        </span>
                      </span>
                      <span className="inline-flex items-center gap-0.5 group-hover/link:translate-x-0.5 transition-transform text-white/80">
                        <span>Xem đặc quyền VIP</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </span>
                    </Link>
                  </div>
                </div>

                <div className="space-y-0.5 pt-0.5">
                  {/* 1. Ví Xu */}
                  <DropdownMenuItem asChild className={cn("px-3.5 py-2.5 rounded-[14px] cursor-pointer transition-all duration-200 outline-none group", tierStyle.coinHover)}>
                    <Link href="/account/coins" className="flex items-center w-full">
                      <div className="flex items-center justify-center w-6 h-6 mr-3 shrink-0 group-hover:scale-110 group-hover:rotate-6 transition-transform">
                        <Image src="/icons/coin.png" alt="Coin" width={22} height={22} className="object-contain" />
                      </div>
                      <div className="flex flex-col min-w-0 flex-1">
                        <span className="font-bold text-[13.5px] text-foreground transition-colors">
                          Ví Xu & Điểm danh
                        </span>
                        <span className="text-[11px] text-muted-foreground font-medium truncate">
                          Điểm danh hàng ngày & đổi quà
                        </span>
                      </div>
                      <span className={cn("text-[11px] font-bold px-2 py-0.5 rounded-lg shrink-0 font-mono shadow-2xs ml-2 border", tierStyle.coinBadgeBg, tierStyle.coinBadgeText, tierStyle.coinBadgeBorder)}>
                        {Number(profile?.coins_balance || 0).toLocaleString("vi-VN")} Xu
                      </span>
                    </Link>
                  </DropdownMenuItem>

                  {/* 2. Giới thiệu bạn bè (Referral Viral) */}
                  <DropdownMenuItem asChild className="px-3.5 py-2.5 rounded-[14px] cursor-pointer transition-all duration-200 hover:bg-emerald-500/10 focus:bg-emerald-500/10 outline-none group">
                    <Link href="/account/referrals" className="flex items-center w-full">
                      <div className="flex items-center justify-center w-6 h-6 mr-3 shrink-0 group-hover:scale-110 group-hover:rotate-6 transition-transform">
                        <Image src="/icons/people.png" alt="Referral" width={22} height={22} className="object-contain" />
                      </div>
                      <div className="flex flex-col min-w-0 flex-1">
                        <span className="font-bold text-[13.5px] text-foreground group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                          Giới thiệu bạn bè
                        </span>
                        <span className="text-[11px] text-muted-foreground font-medium truncate">
                          Mời bạn nhận ngay quà tặng
                        </span>
                      </div>
                      <span className="text-[10.5px] font-bold px-2 py-0.5 rounded-lg bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/25 shrink-0 shadow-2xs ml-2 font-mono">
                        🎁 +10.000 Xu
                      </span>
                    </Link>
                  </DropdownMenuItem>

                  {/* 3. Tài khoản của tôi */}
                  <DropdownMenuItem asChild className="px-3.5 py-2.5 rounded-[14px] cursor-pointer transition-all duration-200 hover:bg-primary/10 hover:shadow-sm focus:bg-primary/10 outline-none group">
                    <Link href="/account" className="flex items-center w-full">
                      <div className="flex items-center justify-center w-6 h-6 mr-3 shrink-0 group-hover:scale-110 group-hover:rotate-3 transition-transform">
                        <Image src="/icons/user.png" alt="Tài khoản" width={22} height={22} className="object-contain" />
                      </div>
                      <div className="flex flex-col min-w-0 flex-1">
                        <span className="font-bold text-[13.5px] group-hover:text-primary transition-colors">Tài khoản của tôi</span>
                        <span className="text-[11px] text-muted-foreground font-medium truncate">Thông tin cá nhân & địa chỉ</span>
                      </div>
                    </Link>
                  </DropdownMenuItem>

                  {/* 4. Lịch sử mua hàng */}
                  <DropdownMenuItem asChild className="px-3.5 py-2.5 rounded-[14px] cursor-pointer transition-all duration-200 hover:bg-primary/10 hover:shadow-sm focus:bg-primary/10 outline-none group">
                    <Link href="/account/orders" className="flex items-center w-full">
                      <div className="flex items-center justify-center w-6 h-6 mr-3 shrink-0 group-hover:scale-110 group-hover:-rotate-3 transition-transform">
                        <Image src="/icons/cart-history.png" alt="Đơn hàng" width={22} height={22} className="object-contain" />
                      </div>
                      <div className="flex flex-col min-w-0 flex-1">
                        <span className="font-bold text-[13.5px] group-hover:text-primary transition-colors">Lịch sử mua hàng</span>
                        <span className="text-[11px] text-muted-foreground font-medium truncate">Theo dõi đơn & tra cứu</span>
                      </div>
                    </Link>
                  </DropdownMenuItem>

                  {/* 5. Admin portal */}
                  {role === "admin" && (
                    <>
                      <DropdownMenuSeparator className="bg-border/40 my-1" />
                      <DropdownMenuItem asChild className="px-3.5 py-2.5 rounded-[14px] cursor-pointer transition-all duration-200 hover:bg-rose-500/10 focus:bg-rose-500/10 outline-none group">
                        <Link href="/dashboard" className="flex items-center w-full">
                          <div className="flex items-center justify-center w-6 h-6 mr-3 shrink-0 group-hover:scale-110 transition-transform">
                            <Image src="/icons/dashboard2.png" alt="Admin" width={22} height={22} className="object-contain" />
                          </div>
                          <div className="flex flex-col min-w-0 flex-1">
                            <span className="font-bold text-[13.5px] text-rose-600 dark:text-rose-400">Trang Quản trị Hệ thống</span>
                            <span className="text-[11px] text-rose-600/70 dark:text-rose-400/70 font-medium truncate">Dành riêng cho Quản trị viên</span>
                          </div>
                        </Link>
                      </DropdownMenuItem>
                    </>
                  )}

                  {/* 6. Staff portal */}
                  {role === "staff" && (
                    <>
                      <DropdownMenuSeparator className="bg-border/40 my-1" />
                      <DropdownMenuItem asChild className="px-3.5 py-2.5 rounded-[14px] cursor-pointer transition-all duration-200 hover:bg-blue-500/10 focus:bg-blue-500/10 outline-none group">
                        <Link href="/dashboard" className="flex items-center w-full">
                          <div className="flex items-center justify-center w-6 h-6 mr-3 shrink-0 group-hover:scale-110 transition-transform">
                            <Image src="/icons/dashboard2.png" alt="Staff" width={22} height={22} className="object-contain" />
                          </div>
                          <div className="flex flex-col min-w-0 flex-1">
                            <span className="font-bold text-[13.5px] text-blue-600 dark:text-blue-400">Bảng điều hành Đơn hàng</span>
                            <span className="text-[11px] text-blue-600/70 dark:text-blue-400/70 font-medium truncate">Khu vực Nhân viên vận hành</span>
                          </div>
                        </Link>
                      </DropdownMenuItem>
                    </>
                  )}

                  <DropdownMenuSeparator className="bg-border/40 my-1" />

                  {/* 7. Đăng xuất */}
                  <DropdownMenuItem onClick={() => logout()} className="px-3.5 py-2.5 rounded-[14px] cursor-pointer transition-all duration-200 text-red-600 focus:text-red-700 hover:bg-red-500/10 focus:bg-red-500/10 dark:hover:bg-red-950/30 outline-none w-full group">
                    <div className="flex items-center justify-center w-6 h-6 mr-3 shrink-0 group-hover:scale-110 transition-transform">
                      <Image src="/icons/logout.png" alt="Đăng xuất" width={22} height={22} className="object-contain" />
                    </div>
                    <span className="font-bold text-[13.5px]">Đăng xuất</span>
                  </DropdownMenuItem>
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="inline-flex md:hidden rounded-full hover:bg-primary/10 transition-all ml-1.5 h-9 w-9 p-0 shrink-0"
                onClick={() => openModal('login')}
                title="Đăng nhập"
              >
                <Image src="/icons/login.png" alt="Đăng nhập" width={40} height={40} className="object-contain" />
              </Button>
              <Button
                className="hidden md:inline-flex rounded-full ml-2 font-bold px-4 py-1.5 h-9 text-sm shadow-md shadow-primary/20 transition-all active:scale-95 shrink-0"
                onClick={() => openModal('login')}
              >
                Đăng nhập
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
