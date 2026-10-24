"use client";

import { useEffect, useState } from "react";
import { 
  Ticket, 
  Check, 
  Sparkles, 
  Clock, 
  AlertCircle, 
  ChevronRight,
  ArrowRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Coupon, getActiveCoupons } from "@/lib/services/coupon.service";
import Image from "next/image";

interface CouponSelectorProps {
  subtotal: number;
  appliedCoupon: Coupon | null;
  couponCodeInput: string;
  setCouponCodeInput: (code: string) => void;
  onApplyCoupon: (codeOverride?: string) => void;
  onRemoveCoupon: () => void;
  couponError: string;
}

export function CouponSelector({
  subtotal,
  appliedCoupon,
  couponCodeInput,
  setCouponCodeInput,
  onApplyCoupon,
  onRemoveCoupon,
  couponError,
}: CouponSelectorProps) {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Tải danh sách mã giảm giá khả dụng
  useEffect(() => {
    async function loadCoupons() {
      setIsLoading(true);
      const { data } = await getActiveCoupons();
      if (data) {
        setCoupons(data);
      }
      setIsLoading(false);
    }
    loadCoupons();
  }, []);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
    }).format(val);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  // Áp dụng nhanh 1 mã từ pill hoặc modal
  const handleSelectQuickCoupon = (code: string) => {
    setCouponCodeInput(code);
    onApplyCoupon(code);
    setIsModalOpen(false);
  };

  // Top 3 mã tốt nhất hiển thị ở Quick Pills
  const quickPills = coupons.slice(0, 3);

  return (
    <div className="mb-8 border-t border-border/50 pt-6">
      {/* Tiêu đề & Nút mở Kho Voucher */}
      <div className="flex items-center justify-between mb-2.5">
        <Label
          htmlFor="coupon"
          className="block font-semibold text-[13px] uppercase tracking-wider text-muted-foreground/80"
        >
          Mã giảm giá
        </Label>
        {coupons.length > 0 && (
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-pink-600 dark:text-pink-400 hover:text-pink-700 dark:hover:text-pink-300 transition-colors group cursor-pointer"
          >
            <Ticket className="w-3.5 h-3.5 group-hover:rotate-12 transition-transform" />
            <span>Kho voucher ({coupons.length})</span>
            <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
          </button>
        )}
      </div>

      {/* Ô nhập mã thủ công */}
      <div className="flex gap-2">
        <Input
          id="coupon"
          placeholder="Nhập mã giảm giá..."
          value={couponCodeInput}
          onChange={(e) => setCouponCodeInput(e.target.value.toUpperCase())}
          disabled={!!appliedCoupon}
          className="h-11 rounded-[14px] bg-background/50 focus:bg-background uppercase font-mono font-medium"
        />
        {!appliedCoupon ? (
          <Button
            type="button"
            variant="secondary"
            onClick={() => onApplyCoupon()}
            className="h-11 rounded-[14px] font-bold px-6 border border-border/50 hover:bg-muted cursor-pointer"
          >
            Áp dụng
          </Button>
        ) : (
          <Button
            type="button"
            variant="destructive"
            onClick={onRemoveCoupon}
            className="h-11 rounded-[14px] font-bold px-6 cursor-pointer"
          >
            Hủy
          </Button>
        )}
      </div>

      {/* Thông báo lỗi nếu có */}
      {couponError && (
        <div className="flex items-center gap-1.5 text-red-500 text-xs mt-2 font-medium pl-1 animate-in fade-in">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>{couponError}</span>
        </div>
      )}

      {/* Banner mã đang được áp dụng thành công */}
      {appliedCoupon && (
        <div className="mt-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 flex items-center justify-between gap-3 animate-in fade-in">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <Check className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-emerald-600 dark:text-emerald-400 text-sm font-bold">
                  Đã áp dụng mã {appliedCoupon.code} (-{appliedCoupon.discount_percent}%)
                </span>
              </div>
              <p className="text-emerald-600/80 dark:text-emerald-400/80 text-xs font-medium mt-0.5">
                Tiết kiệm được {formatCurrency((subtotal * appliedCoupon.discount_percent) / 100)}
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onRemoveCoupon}
            className="text-xs text-muted-foreground hover:text-red-500 h-7 px-2 cursor-pointer"
          >
            Đổi mã
          </Button>
        </div>
      )}

      {/* Quick Pills: Gợi ý 2-3 mã hot bên dưới */}
      {!appliedCoupon && !isLoading && quickPills.length > 0 && (
        <div className="mt-3.5 pt-3 border-t border-border/30">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
              <Sparkles className="w-3 h-3 text-amber-500" />
              Gợi ý ưu đãi hôm nay:
            </span>
          </div>

          <div className="flex flex-wrap gap-2">
            {quickPills.map((coupon) => {
              const minRequired = coupon.min_order_amount || 0;
              const isEligible = subtotal >= minRequired;
              const missingAmount = minRequired - subtotal;

              return (
                <button
                  key={coupon.id}
                  type="button"
                  onClick={() => handleSelectQuickCoupon(coupon.code)}
                  className={`group relative text-left p-2 px-3 rounded-[12px] border transition-all duration-200 cursor-pointer flex items-center gap-2 ${
                    isEligible
                      ? "bg-secondary/40 hover:bg-pink-500/10 border-border hover:border-pink-500/40 shadow-2xs hover:shadow-xs"
                      : "bg-muted/30 border-border/50 opacity-75 hover:opacity-100 hover:border-amber-500/40"
                  }`}
                >
                  <div className="flex flex-col">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono font-bold text-xs text-foreground group-hover:text-pink-600 dark:group-hover:text-pink-400 transition-colors">
                        {coupon.code}
                      </span>
                      <Badge
                        variant="secondary"
                        className="text-[10px] px-1.5 py-0 h-4 bg-pink-500/10 text-pink-600 dark:text-pink-400 border-0 font-bold"
                      >
                        -{coupon.discount_percent}%
                      </Badge>
                    </div>

                    <span className="text-[10px] text-muted-foreground mt-0.5">
                      {isEligible ? (
                        minRequired > 0 ? (
                          `Đơn từ ${formatCurrency(minRequired)}`
                        ) : (
                          "Mọi giá trị đơn"
                        )
                      ) : (
                        <span className="text-amber-600 dark:text-amber-400 font-medium">
                          Mua thêm {formatCurrency(missingAmount)}
                        </span>
                      )}
                    </span>
                  </div>

                  <ArrowRight className="w-3 h-3 text-muted-foreground group-hover:text-pink-600 group-hover:translate-x-0.5 transition-all ml-1 shrink-0" />
                </button>
              );
            })}

            {coupons.length > 3 && (
              <button
                type="button"
                onClick={() => setIsModalOpen(true)}
                className="text-xs font-semibold text-muted-foreground hover:text-foreground px-2.5 py-2 rounded-[12px] border border-dashed border-border hover:border-foreground/40 transition-colors flex items-center gap-1 cursor-pointer"
              >
                + {coupons.length - 3} mã khác
              </button>
            )}
          </div>
        </div>
      )}

      {/* Dialog Kho Voucher Luxe VIP */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-lg p-0 gap-0 overflow-hidden rounded-[24px] border-border/60 bg-card/95 backdrop-blur-2xl shadow-2xl">
          <DialogHeader className="p-5 pb-3 border-b border-border/40">
            <div className="flex items-center gap-2">
              <div className="h-12 w-12 rounded-full bg-gradient-to-tr from-emerald-500/15 via-teal-500/10 to-amber-500/20 border border-emerald-500/25 dark:border-emerald-400/30 flex items-center justify-center shadow-xs">
                <Image unoptimized src="/icons/coupon.png" alt="Voucher" width={30} height={30} className="drop-shadow-xs" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold">
                  Kho Voucher & Ưu Đãi
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Chọn mã giảm giá tốt nhất để áp dụng cho đơn hàng của bạn
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {/* Danh sách thẻ Voucher */}
          <div className="p-5 space-y-3 max-h-[60vh] overflow-y-auto">
            {coupons.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                Hiện tại chưa có mã giảm giá nào đang diễn ra.
              </div>
            ) : (
              coupons.map((coupon) => {
                const minRequired = coupon.min_order_amount || 0;
                const isEligible = subtotal >= minRequired;
                const isSelected = appliedCoupon?.id === coupon.id;
                const missingAmount = minRequired - subtotal;

                return (
                  <div
                    key={coupon.id}
                    className={`relative flex items-stretch rounded-[18px] border overflow-hidden transition-all duration-200 ${
                      isSelected
                        ? "border-emerald-500 bg-emerald-500/5 shadow-md"
                        : isEligible
                        ? "border-border/80 bg-background/80 hover:border-pink-500/40 hover:shadow-md"
                        : "border-border/40 bg-muted/20 opacity-70"
                    }`}
                  >
                    {/* Phần cuống vé bên trái: Gradient & % Giảm */}
                    <div className="w-24 shrink-0 bg-gradient-to-br from-pink-600 via-rose-500 to-amber-500 text-white flex flex-col items-center justify-center p-3 text-center relative">
                      <Ticket className="w-5 h-5 opacity-80 mb-1" />
                      <span className="font-extrabold text-xl leading-none">
                        {coupon.discount_percent}%
                      </span>
                      <span className="text-[10px] uppercase font-bold tracking-wider opacity-90 mt-1">
                        GIẢM
                      </span>

                      {/* Khuyết tròn bán nguyệt cạnh trên & dưới cuống vé */}
                      <div className="absolute -top-2.5 -right-2.5 w-5 h-5 rounded-full bg-card" />
                      <div className="absolute -bottom-2.5 -right-2.5 w-5 h-5 rounded-full bg-card" />
                    </div>

                    {/* Phần thân vé bên phải: Chi tiết ưu đãi & Nút áp dụng */}
                    <div className="flex-1 p-3.5 pl-4 flex flex-col justify-between border-l border-dashed border-border/60">
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono font-bold text-sm tracking-wider text-foreground">
                            {coupon.code}
                          </span>
                          {isSelected && (
                            <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-0 text-[10px] font-bold">
                              Đang dùng
                            </Badge>
                          )}
                        </div>

                        <p className="text-xs text-foreground/85 font-medium mt-1 line-clamp-1">
                          {coupon.title || `Giảm ${coupon.discount_percent}% giá trị đơn hàng`}
                        </p>

                        <div className="flex items-center gap-3 mt-2 text-[11px] text-muted-foreground">
                          <span>
                            {minRequired > 0
                              ? `Đơn tối thiểu: ${formatCurrency(minRequired)}`
                              : "Không giới hạn đơn"}
                          </span>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            HSD: {formatDate(coupon.valid_until)}
                          </span>
                        </div>
                      </div>

                      {/* Nút hành động */}
                      <div className="mt-3 pt-2.5 border-t border-border/30 flex items-center justify-between">
                        {isEligible ? (
                          <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                            Tiết kiệm: {formatCurrency((subtotal * coupon.discount_percent) / 100)}
                          </span>
                        ) : (
                          <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">
                            Cần mua thêm {formatCurrency(missingAmount)}
                          </span>
                        )}

                        {isSelected ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              onRemoveCoupon();
                              setIsModalOpen(false);
                            }}
                            className="h-8 rounded-full text-xs font-bold text-red-500 border-red-200 hover:bg-red-50 dark:hover:bg-red-950/30 cursor-pointer"
                          >
                            Hủy dùng
                          </Button>
                        ) : isEligible ? (
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => handleSelectQuickCoupon(coupon.code)}
                            className="h-8 rounded-full text-xs font-bold bg-pink-600 hover:bg-pink-700 text-white cursor-pointer shadow-xs"
                          >
                            Áp dụng ngay
                          </Button>
                        ) : (
                          <Button
                            type="button"
                            size="sm"
                            disabled
                            variant="secondary"
                            className="h-8 rounded-full text-xs font-medium opacity-60"
                          >
                            Chưa đủ điều kiện
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
