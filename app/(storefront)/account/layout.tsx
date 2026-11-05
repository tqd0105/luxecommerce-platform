"use client";

import { useAuth } from "@/components/providers/auth-provider";
import { useRouter, usePathname } from "next/navigation";
import { useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { TIER_CONFIGS, MembershipTier } from "@/lib/services/loyalty.service";

const TIER_ICON_MAP: Record<MembershipTier, string> = {
  bronze: "/icons/bronze.png",
  silver: "/icons/silver.png",
  gold: "/icons/gold.png",
  diamond: "/icons/diamond.png",
};

const TIER_BADGE_STYLES: Record<MembershipTier, string> = {
  diamond: "bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border-cyan-500/30",
  gold: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
  silver: "bg-slate-200/80 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-700",
  bronze: "bg-amber-700/15 text-amber-800 dark:text-amber-300 border-amber-700/30",
};
import { 
  User, 
  Package, 
  MapPin, 
  Heart, 
  Settings, 
  LogOut,
  Sparkles,
  CircleDollarSign,
  ShoppingCart,
  Users,
} from "lucide-react";

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  const { user, profile, loading, logout } = useAuth();
  const userTier = (profile?.membership_tier as MembershipTier) || "bronze";
  const tierConfig = TIER_CONFIGS[userTier] || TIER_CONFIGS.bronze;
  
  const avatarUrl = profile?.avatar_url || user?.user_metadata?.avatar_url || user?.user_metadata?.picture;
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !user) {
      router.push("/");
    }
  }, [user, loading, router]);

  if (!user) {
    return null;
  }

  const menuItems = [
    { name: "Tổng quan", href: "/account", icon: User },
    { name: "Ví Xu", href: "/account/coins", icon: CircleDollarSign },
    { name: "Mời bạn bè", href: "/account/referrals", icon: Users },
    { name: "Đơn hàng", href: "/account/orders", icon: ShoppingCart },
    { name: "Sổ địa chỉ", href: "/account/addresses", icon: MapPin },
    { name: "Yêu thích", href: "/account/wishlist", icon: Heart },
    { name: "Tuỳ chỉnh", href: "/account/settings", icon: Settings },
  ];

  return (
    <div className="container mx-auto px-4 py-10 max-w-7xl min-h-[calc(100vh-200px)] animate-fade-in">
      <div className="flex flex-col md:flex-row gap-8">
        {/* Sidebar */}
        <aside className="w-full md:w-72 shrink-0">
          <div className="bg-card/60 backdrop-blur-xl rounded-[24px] shadow-sm border border-border/50 p-5 sticky top-24">
            <div className="mb-6 flex items-center gap-3 px-1">
              <div className="size-15 rounded-full bg-gradient-to-br from-primary to-primary/50 flex items-center justify-center text-primary-foreground text-lg font-bold shadow-md ring-2 ring-primary/10 shrink-0 overflow-hidden">
                {avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  user.email?.charAt(0).toUpperCase() || "U"
                )}
              </div>
              <div className="flex-1 min-w-0 overflow-hidden">
                <h2 className="text-[15px] font-bold truncate text-foreground leading-tight">
                  {profile?.full_name || "Tài khoản"}
                </h2>
                <Link
                  href="/account/coins"
                  className="mt-1 flex items-center flex-wrap gap-1.5 text-xs group"
                >
                  <span className={cn(
                    "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 border whitespace-nowrap shadow-2xs transition-transform group-hover:scale-105",
                    TIER_BADGE_STYLES[userTier]
                  )}>
                    <Image
                      src={TIER_ICON_MAP[userTier] || "/icons/bronze.png"}
                      alt={tierConfig.name}
                      width={11}
                      height={11}
                      unoptimized
                      className="object-contain shrink-0"
                    />
                    <span>{tierConfig.name}</span>
                  </span>

                  <span className="inline-flex items-center gap-1 font-mono font-bold text-[11.5px] text-amber-600 dark:text-amber-400 whitespace-nowrap">
                    <Image src="/icons/coin.png" alt="Coin" width={12} height={12} unoptimized className="object-contain shrink-0" />
                    <span>{Number(profile?.coins_balance || 0).toLocaleString("vi-VN")} Xu</span>
                  </span>
                </Link>
              </div>
            </div>
            
            <nav className="flex flex-col space-y-1.5">
              {menuItems.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center px-4 py-3 text-[14.5px] font-medium rounded-xl transition-all duration-200",
                      isActive
                        ? "bg-primary/10 text-primary font-bold shadow-sm ring-1 ring-primary/20"
                        : "text-foreground/70 hover:bg-muted/50 hover:text-foreground"
                    )}
                  >
                    <item.icon className={cn("mr-3 size-5 transition-colors", isActive ? "text-primary" : "text-muted-foreground")} />
                    {item.name}
                  </Link>
                );
              })}
              
              <div className="py-2">
                <div className="h-px w-full bg-border/50" />
              </div>
              
              <button
                onClick={() => logout()}
                className="flex items-center px-4 py-3 text-[14.5px] font-medium rounded-xl text-red-600/80 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30 dark:hover:text-red-500 transition-colors w-full text-left"
              >
                <LogOut className="mr-3 size-5 text-red-500/70" />
                Đăng xuất
              </button>
            </nav>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 min-w-0">
          <div className="min-h-[400px]">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
