"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/components/providers/auth-provider";
import { MembershipCard, TierProgressWidget } from "@/components/storefront/membership-card";
import {
  TIER_CONFIGS,
  MembershipTier,
  getCoinTransactions,
  CoinTransaction,
} from "@/lib/services/loyalty.service";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";
import { vi } from "date-fns/locale";
import {
  Sparkles,
  Award,
  History,
  RotateCcw,
  Check,
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/utils";

const TIERS_LIST: MembershipTier[] = ["bronze", "silver", "gold", "diamond"];

export default function AccountCoinsPage() {
  const { user, profile } = useAuth();
  const currentTier: MembershipTier = (profile?.membership_tier as MembershipTier) || "bronze";

  const [transactions, setTransactions] = useState<CoinTransaction[]>([]);
  const [loadingTransactions, setLoadingTransactions] = useState(true);
  const [filterType, setFilterType] = useState<"all" | "in" | "out">("all");

  const loadTransactions = useCallback(async () => {
    if (!user) return;
    setLoadingTransactions(true);
    try {
      const { data } = await getCoinTransactions(user.id, 50);
      if (data) {
        setTransactions(data);
      }
    } catch (e) {
      console.error("Lỗi tải lịch sử xu:", e);
    } finally {
      setLoadingTransactions(false);
    }
  }, [user]);

  useEffect(() => {
    loadTransactions();
  }, [loadTransactions]);

  const filteredTransactions = transactions.filter((tx) => {
    if (filterType === "all") return true;
    if (filterType === "in") return tx.amount > 0;
    if (filterType === "out") return tx.amount < 0;
    return true;
  });

  return (
    <div className="space-y-6 pb-12 max-w-5xl mx-auto">
      {/* Tiêu đề trang - Tinh gọn, rõ ràng */}
      <div>
        <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
          <Link href="/account" className="hover:text-foreground transition-colors">Tài khoản</Link>
          <span>/</span>
          <span className="text-primary font-bold">Ví Xu & Thẻ VIP</span>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground flex items-center gap-2">
            <span>Ví Xu & Hạng Thành Viên</span>
          </h1>
          <div className="inline-flex items-center gap-2 text-xs text-muted-foreground">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Quy đổi chuẩn: <strong className="text-foreground">1 Xu = 1 VNĐ</strong></span>
          </div>
        </div>
      </div>

      {/* Hàng 1: Thẻ VIP Digital & Điểm Danh (Trái) | Tiến Trình & Quy Tắc (Phải) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Cột Trái: Thẻ VIP & Điểm danh nhận xu */}
        <div className="lg:col-span-7">
          <MembershipCard
            showProgress={false}
            showCheckinButton={true}
            onCheckinSuccess={loadTransactions}
          />
        </div>

        {/* Cột Phải: Tiến trình thăng hạng & Quy tắc ví xu */}
        <div className="lg:col-span-5 space-y-4">
          <TierProgressWidget />

          {/* Bảng tóm tắt quy tắc - Gọn gàng, lấp đầy hoàn hảo khoảng trống */}
          <div className="bg-card/60 backdrop-blur-md border border-border/50 rounded-2xl p-4 sm:p-5 space-y-3 shadow-2xs">
            <div className="flex items-center gap-2 border-b border-border/40 pb-2.5">
              <div className="w-6 h-6 rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                <Sparkles className="w-3.5 h-3.5" />
              </div>
              <div>
                <h3 className="font-bold text-xs sm:text-[13px] text-foreground uppercase tracking-wide">Quy tắc Ví Xu & Quyền Lợi</h3>
                <p className="text-[10.5px] text-muted-foreground">Minh bạch & tích lũy vĩnh viễn</p>
              </div>
            </div>

            <div className="space-y-2.5 text-xs leading-relaxed">
              <div className="flex items-start gap-2.5">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                <div>
                  <strong className="text-foreground">Dùng xu mua hàng:</strong> Khấu trừ trực tiếp tới <strong className="text-foreground font-bold">50%</strong> tiền hàng trong giỏ.
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                <div>
                  <strong className="text-foreground">Hoàn xu tự động:</strong> Nhận từ <strong className="text-foreground font-bold">1% - 3%</strong> giá trị đơn ngay khi nhận hàng thành công.
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-1.5 shrink-0" />
                <div>
                  <strong className="text-foreground">Điểm danh mỗi ngày:</strong> Mở web bấm nhận xu từ <strong className="text-foreground font-bold">200 - 500 Xu/ngày</strong> tùy theo hạng.
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 mt-1.5 shrink-0" />
                <div>
                  <strong className="text-foreground">Không bao giờ tụt hạng:</strong> Điểm thăng hạng là điểm trọn đời (<code className="font-mono text-[11px] text-primary">lifetime</code>), tiêu xu không làm giảm cấp VIP.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Hàng 2: Bảng Ma Trận So Sánh Quyền Lợi 4 Hạng (Thay thế 4 card cồng kềnh) */}
      <div className="bg-card/60 backdrop-blur-md border border-border/50 rounded-2xl p-5 space-y-3.5 shadow-2xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Award className="w-4 h-4 text-primary" />
            <h2 className="font-bold text-sm sm:text-base text-foreground">
              Bảng so sánh quyền lợi các hạng VIP
            </h2>
          </div>
          <span className="text-xs text-muted-foreground font-medium hidden sm:inline-block">
            Càng mua sắm nhiều, đặc quyền càng cao
          </span>
        </div>

        {/* Bảng so sánh ma trận trực quan & gọn nhẹ */}
        <div className="overflow-x-auto rounded-xl border border-border/40">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="bg-muted/40 border-b border-border/40">
                <th className="py-2.5 px-3.5 font-bold text-muted-foreground w-1/4">Quyền lợi</th>
                {TIERS_LIST.map((t) => {
                  const isCurrent = currentTier === t;
                  const cfg = TIER_CONFIGS[t];
                  return (
                    <th
                      key={t}
                      className={cn(
                        "py-2.5 px-3 font-bold text-center transition-colors",
                        isCurrent ? "bg-primary/10 text-primary" : "text-foreground"
                      )}
                    >
                      <div className="inline-flex items-center gap-1">
                        <span>{cfg.iconName}</span>
                        <span>{cfg.name}</span>
                      </div>
                      {isCurrent && (
                        <div className="text-[9.5px] font-extrabold uppercase text-primary mt-0.5 tracking-wider">
                          (Hạng của bạn)
                        </div>
                      )}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {/* Hàng 1: Yêu cầu điểm */}
              <tr className="hover:bg-muted/20 transition-colors">
                <td className="py-2.5 px-3.5 font-medium text-muted-foreground">Điểm trọn đời</td>
                <td className={cn("py-2.5 px-3 text-center font-mono font-semibold", currentTier === "bronze" && "bg-primary/5 font-bold text-primary")}>
                  0 - 4.999
                </td>
                <td className={cn("py-2.5 px-3 text-center font-mono font-semibold", currentTier === "silver" && "bg-primary/5 font-bold text-primary")}>
                  5.000 - 19.999
                </td>
                <td className={cn("py-2.5 px-3 text-center font-mono font-semibold", currentTier === "gold" && "bg-primary/5 font-bold text-primary")}>
                  20.000 - 49.999
                </td>
                <td className={cn("py-2.5 px-3 text-center font-mono font-semibold", currentTier === "diamond" && "bg-primary/5 font-bold text-primary")}>
                  Từ 50.000+
                </td>
              </tr>

              {/* Hàng 2: Hoàn xu đơn hàng */}
              <tr className="hover:bg-muted/20 transition-colors">
                <td className="py-2.5 px-3.5 font-medium text-muted-foreground">Hoàn xu mỗi đơn</td>
                <td className={cn("py-2.5 px-3 text-center font-bold", currentTier === "bronze" && "bg-primary/5 text-primary")}>
                  1.0%
                </td>
                <td className={cn("py-2.5 px-3 text-center font-bold", currentTier === "silver" && "bg-primary/5 text-primary")}>
                  1.5%
                </td>
                <td className={cn("py-2.5 px-3 text-center font-bold text-amber-600 dark:text-amber-400", currentTier === "gold" && "bg-primary/5")}>
                  2.5%
                </td>
                <td className={cn("py-2.5 px-3 text-center font-bold text-cyan-600 dark:text-cyan-400", currentTier === "diamond" && "bg-primary/5")}>
                  3.0%
                </td>
              </tr>

              {/* Hàng 3: Điểm danh ngày */}
              <tr className="hover:bg-muted/20 transition-colors">
                <td className="py-2.5 px-3.5 font-medium text-muted-foreground">Điểm danh hằng ngày</td>
                <td className={cn("py-2.5 px-3 text-center font-semibold", currentTier === "bronze" && "bg-primary/5 text-primary font-bold")}>
                  +200 Xu
                </td>
                <td className={cn("py-2.5 px-3 text-center font-semibold", currentTier === "silver" && "bg-primary/5 text-primary font-bold")}>
                  +250 Xu
                </td>
                <td className={cn("py-2.5 px-3 text-center font-semibold", currentTier === "gold" && "bg-primary/5 text-primary font-bold")}>
                  +350 Xu
                </td>
                <td className={cn("py-2.5 px-3 text-center font-semibold text-cyan-600 dark:text-cyan-400", currentTier === "diamond" && "bg-primary/5 font-bold")}>
                  +500 Xu
                </td>
              </tr>

              {/* Hàng 4: Vận chuyển */}
              <tr className="hover:bg-muted/20 transition-colors">
                <td className="py-2.5 px-3.5 font-medium text-muted-foreground">Ưu đãi phí ship</td>
                <td className={cn("py-2.5 px-3 text-center text-muted-foreground", currentTier === "bronze" && "bg-primary/5 text-primary font-semibold")}>
                  Tiêu chuẩn
                </td>
                <td className={cn("py-2.5 px-3 text-center text-muted-foreground", currentTier === "silver" && "bg-primary/5 text-primary font-semibold")}>
                  Tiêu chuẩn
                </td>
                <td className={cn("py-2.5 px-3 text-center font-bold text-primary", currentTier === "gold" && "bg-primary/5")}>
                  Giảm 50% Ship
                </td>
                <td className={cn("py-2.5 px-3 text-center font-bold text-emerald-600 dark:text-emerald-400", currentTier === "diamond" && "bg-primary/5")}>
                  Freeship 100%
                </td>
              </tr>

              {/* Hàng 5: Quyền lợi khác */}
              <tr className="hover:bg-muted/20 transition-colors">
                <td className="py-2.5 px-3.5 font-medium text-muted-foreground">Đặc quyền thêm</td>
                <td className={cn("py-2.5 px-3 text-center text-muted-foreground", currentTier === "bronze" && "bg-primary/5 text-primary font-semibold")}>
                  Cơ bản
                </td>
                <td className={cn("py-2.5 px-3 text-center", currentTier === "silver" && "bg-primary/5 font-semibold text-primary")}>
                  Voucher sinh nhật 5%
                </td>
                <td className={cn("py-2.5 px-3 text-center", currentTier === "gold" && "bg-primary/5 font-semibold text-primary")}>
                  Quà tri ân sinh nhật
                </td>
                <td className={cn("py-2.5 px-3 text-center font-bold text-foreground", currentTier === "diamond" && "bg-primary/5 text-primary")}>
                  CSKH 1-1 & Ưu tiên đơn
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Hàng 3: Lịch sử biến động Xu (Sao kê) */}
      <div className="bg-card/60 backdrop-blur-md border border-border/50 rounded-2xl p-5 space-y-4 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/40 pb-3.5">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-primary" />
            <h2 className="font-bold text-sm sm:text-base text-foreground">
              Lịch sử biến động Xu
            </h2>
            <span className="text-xs text-muted-foreground">
              ({filteredTransactions.length} giao dịch)
            </span>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            {/* Bộ lọc loại giao dịch */}
            <Tabs value={filterType} onValueChange={(v) => setFilterType(v as any)}>
              <TabsList className="rounded-xl bg-muted/60 p-0.5 border border-border/40 h-8">
                <TabsTrigger value="all" className="rounded-lg text-xs font-semibold px-2.5 h-7">
                  Tất cả
                </TabsTrigger>
                <TabsTrigger value="in" className="rounded-lg text-xs font-semibold px-2.5 h-7">
                  Nhận (+)
                </TabsTrigger>
                <TabsTrigger value="out" className="rounded-lg text-xs font-semibold px-2.5 h-7">
                  Tiêu (-)
                </TabsTrigger>
              </TabsList>
            </Tabs>

            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={loadTransactions}
              disabled={loadingTransactions}
              className="rounded-xl h-8 w-8 text-xs cursor-pointer border-border/50"
              title="Làm mới lịch sử"
            >
              <RotateCcw className={cn("w-3.5 h-3.5", loadingTransactions && "animate-spin")} />
            </Button>
          </div>
        </div>

        {/* Danh sách sao kê chi tiết */}
        <div>
          {loadingTransactions ? (
            <div className="py-10 flex flex-col items-center justify-center text-center">
              <div className="w-6 h-6 border-2 border-primary/20 border-t-primary rounded-full animate-spin mb-2" />
              <p className="text-xs text-muted-foreground">Đang tải lịch sử giao dịch...</p>
            </div>
          ) : filteredTransactions.length === 0 ? (
            <div className="py-10 px-4 flex flex-col items-center justify-center text-center">
              <div className="w-12 h-12 rounded-full bg-muted/60 flex items-center justify-center mb-2.5">
                <History className="w-6 h-6 text-muted-foreground/40" />
              </div>
              <h4 className="font-bold text-xs sm:text-sm text-foreground">Chưa có giao dịch xu nào</h4>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                Bấm điểm danh mỗi ngày hoặc đặt đơn hàng để bắt đầu tích lũy xu nhé!
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border/30 -mx-1">
              {filteredTransactions.map((tx) => {
                const isPositive = tx.amount > 0;

                const getTypeBadge = () => {
                  switch (tx.type) {
                    case "order_reward":
                      return { label: "Tích xu đơn", color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20" };
                    case "daily_checkin":
                      return { label: "Điểm danh", color: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20" };
                    case "order_spent":
                      return { label: "Dùng mua hàng", color: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20" };
                    case "order_refund":
                      return { label: "Hoàn lại xu", color: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20" };
                    default:
                      return { label: "Điều chỉnh", color: "bg-muted text-muted-foreground border-border/40" };
                  }
                };

                const badge = getTypeBadge();

                return (
                  <div
                    key={tx.id}
                    className="py-3 px-2 sm:px-3 flex items-center justify-between gap-3 hover:bg-muted/20 rounded-xl transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {/* Icon Cộng (+) hoặc Trừ (-) Xu */}
                      <div
                        className={cn(
                          "w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center shrink-0 shadow-2xs p-1.5",
                          isPositive
                            ? "bg-emerald-500/10 dark:bg-emerald-950/30 border border-emerald-500/20"
                            : "bg-rose-500/10 dark:bg-rose-950/30 border border-rose-500/20"
                        )}
                      >
                        <Image
                          src={isPositive ? "/icons/plus.png" : "/icons/minus.png"}
                          alt={isPositive ? "Cộng xu" : "Trừ xu"}
                          width={26}
                          height={26}
                          className="object-contain"
                        />
                      </div>

                      {/* Thông tin mô tả & ngày giờ */}
                      <div className="min-w-0 space-y-0.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-semibold text-xs sm:text-[13px] text-foreground truncate">
                            {tx.description || "Giao dịch xu"}
                          </span>
                          <span
                            className={cn(
                              "text-[9.5px] font-bold px-1.5 py-0.2 rounded-md border",
                              badge.color
                            )}
                          >
                            {badge.label}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                          <span>
                            {tx.created_at
                              ? format(new Date(tx.created_at), "dd/MM/yyyy HH:mm", { locale: vi })
                              : "-"}
                          </span>
                          {tx.balance_after !== undefined && (
                            <>
                              <span>•</span>
                              <span>
                                Số dư sau GD: <strong className="font-medium text-foreground">{tx.balance_after.toLocaleString("vi-VN")}</strong>
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Số lượng xu */}
                    <div className="text-right shrink-0">
                      <span
                        className={cn(
                          "text-sm sm:text-base font-extrabold font-mono",
                          isPositive
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-rose-600 dark:text-rose-400"
                        )}
                      >
                        {isPositive ? `+${tx.amount.toLocaleString("vi-VN")}` : tx.amount.toLocaleString("vi-VN")}
                      </span>
                      <span className="text-[11px] font-bold text-muted-foreground ml-1">Xu</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
