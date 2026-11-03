"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/providers/auth-provider";
import { supabase } from "@/lib/supabase/client";
import {
  getReferralDashboardData,
  customizeReferralCode,
  ReferralDashboardData,
} from "@/lib/services/referral.service";
import { TIER_CONFIGS, MembershipTier } from "@/lib/services/loyalty.service";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Copy,
  Check,
  Share2,
  Users,
  QrCode,
  Sparkles,
  Clock,
  CheckCircle2,
  Edit3,
  Gift,
  ArrowRight,
  ShieldCheck,
  HelpCircle,
  Download,
} from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";
import Image from "next/image";

export default function ReferralsPage() {
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ReferralDashboardData | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);

  // Trạng thái đổi mã Vanity
  const [isEditingCode, setIsEditingCode] = useState(false);
  const [customCodeInput, setCustomCodeInput] = useState("");
  const [submittingCode, setSubmittingCode] = useState(false);

  const fetchDashboard = async () => {
    try {
      const res = await getReferralDashboardData();
      if (res.data) {
        setData(res.data);
      }
    } catch (err) {
      console.error("Lỗi khi tải dữ liệu referral:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();

    const currentUserId = user?.id || profile?.id;
    if (!currentUserId) return;

    // 1. Supabase Realtime: Tự động cập nhật tức thì khi có biến động giới thiệu
    const channel = supabase
      .channel(`referrals-realtime-${currentUserId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "referral_records",
          filter: `referrer_id=eq.${currentUserId}`,
        },
        () => {
          fetchDashboard();
        }
      )
      .subscribe();

    // 2. BroadcastChannel: Bắt sự kiện đơn hàng hoàn tất giữa các tab/cửa sổ
    let bc: BroadcastChannel | null = null;
    if (typeof window !== "undefined" && window.BroadcastChannel) {
      bc = new BroadcastChannel("admin_orders_channel");
      bc.onmessage = (event) => {
        if (event.data?.type === "ORDER_UPDATED") {
          fetchDashboard();
        }
      };
    }

    return () => {
      supabase.removeChannel(channel);
      if (bc) bc.close();
    };
  }, [user?.id, profile?.id]);

  const userUniqueSuffix = (user?.id || profile?.id || "").slice(0, 8).toUpperCase();
  const defaultCode = userUniqueSuffix ? `LUXE-${userUniqueSuffix}` : "LUXE-VIP";
  const referralCode = data?.referralCode || profile?.referral_code || defaultCode;
  const origin = typeof window !== "undefined" ? window.location.origin : "https://luxestore.com";
  const shareUrl = `${origin}/?ref=${referralCode}`;

  const currentTier: MembershipTier = data?.membershipTier || profile?.membership_tier || "bronze";
  const tierConfig = TIER_CONFIGS[currentTier] || TIER_CONFIGS.bronze;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopiedLink(true);
      toast.success("Đã sao chép liên kết giới thiệu!");
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      toast.error("Không thể sao chép liên kết");
    }
  };

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(referralCode);
      setCopiedCode(true);
      toast.success("Đã sao chép mã giới thiệu!");
      setTimeout(() => setCopiedCode(false), 2000);
    } catch {
      toast.error("Không thể sao chép mã");
    }
  };

  const handleDownloadQr = async () => {
    try {
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=500x500&format=png&data=${encodeURIComponent(
        shareUrl
      )}`;
      const res = await fetch(qrUrl);
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `QR-Gioi-Thieu-${referralCode}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      toast.success("Đã tải ảnh mã QR về máy!");
    } catch {
      toast.error("Không thể tải mã QR");
    }
  };

  const handleCustomizeCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customCodeInput.trim()) {
      toast.error("Vui lòng nhập mã giới thiệu mong muốn.");
      return;
    }
    setSubmittingCode(true);
    try {
      const res = await customizeReferralCode(customCodeInput.trim());
      if (res.success) {
        toast.success(res.message);
        setIsEditingCode(false);
        setCustomCodeInput("");
        fetchDashboard();
      } else {
        toast.error(res.message);
      }
    } catch (err: any) {
      toast.error(err.message || "Lỗi khi tùy chỉnh mã giới thiệu.");
    } finally {
      setSubmittingCode(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-44 rounded-2xl bg-muted/40" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="h-24 rounded-2xl bg-muted/40" />
          <div className="h-24 rounded-2xl bg-muted/40" />
          <div className="h-24 rounded-2xl bg-muted/40" />
        </div>
        <div className="h-64 rounded-2xl bg-muted/40" />
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* 1. HERO SECTION: Thẻ chia sẻ mã & link VIP (Tối ưu responsive 3 thiết bị) */}
      <div className="relative overflow-hidden rounded-[20px] sm:rounded-[24px] border border-border/50 bg-gradient-to-br from-card/90 via-card/60 to-primary/5 backdrop-blur-xl p-4 sm:p-6 lg:p-7 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 sm:gap-6">
          <div className="space-y-2 max-w-xl">
            <div className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-[11px] sm:text-xs font-semibold">
              <Image src={"/icons/money.png"} alt="VIP" width={18} height={18} className="object-contain" />
              <span>Chương trình Đại sứ Luxe VIP</span>
            </div>
            <h1 className="text-lg sm:text-xl md:text-2xl font-extrabold tracking-tight text-foreground leading-snug">
              Mời Bạn Bè — Cùng Nhận Quà Đặc Quyền
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
              Chia sẻ liên kết của bạn tới bạn bè. Khi bạn bè hoàn tất đơn hàng đầu tiên (từ 100.000đ), bạn nhận ngay{" "}
              <strong className="text-primary font-bold">
                +{Number(data?.rewardPerReferral || 10000).toLocaleString("vi-VN")} Xu
              </strong>{" "}
              (theo hạng <span className="uppercase font-bold">{tierConfig.name}</span>), bạn mới nhận voucher chào mừng 10%.
            </p>
          </div>

          {/* Hộp mã giới thiệu & nút thao tác */}
          <div className="bg-background/85 backdrop-blur-md border border-border/60 rounded-xl sm:rounded-2xl p-3.5 sm:p-5 w-full lg:w-96 shrink-0 space-y-3 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-[10.5px] sm:text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Mã giới thiệu của bạn
              </span>
              {!data?.hasCustomizedCode && !isEditingCode && (
                <button
                  type="button"
                  onClick={() => {
                    setIsEditingCode(true);
                    setCustomCodeInput(referralCode.replace("LUXE-", ""));
                  }}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline transition-colors"
                >
                  <Edit3 className="size-3" />
                  <span>Đổi mã (1 lần)</span>
                </button>
              )}
            </div>

            {/* Form chỉnh sửa Vanity Code */}
            {isEditingCode ? (
              <form onSubmit={handleCustomizeCode} className="space-y-2">
                <div className="flex gap-2">
                  <Input
                    value={customCodeInput}
                    onChange={(e) => setCustomCodeInput(e.target.value.toUpperCase())}
                    placeholder="VD: DUNGTRAN"
                    maxLength={20}
                    className="h-10 text-xs font-mono font-bold uppercase tracking-wider bg-card"
                    autoFocus
                  />
                  <Button
                    type="submit"
                    size="sm"
                    disabled={submittingCode}
                    className="h-10 px-4 text-xs font-bold shrink-0"
                  >
                    {submittingCode ? "Lưu..." : "Lưu"}
                  </Button>
                </div>
                <div className="flex items-center justify-between text-[11px] text-muted-foreground px-0.5">
                  <span>Chữ cái & số (4 - 20 ký tự)</span>
                  <button
                    type="button"
                    onClick={() => setIsEditingCode(false)}
                    className="text-red-500 hover:text-red-600 dark:hover:text-red-400 font-medium transition-colors"
                  >
                    Hủy
                  </button>
                </div>
              </form>
            ) : (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-muted/40 border border-border/50 rounded-xl p-2.5 sm:px-3.5 sm:py-2.5">
                <div className="flex items-baseline sm:flex-col gap-1.5 sm:gap-0">
                  <span className="font-mono text-base sm:text-lg font-black tracking-wider text-foreground break-all">
                    {referralCode}
                  </span>
                  {data?.hasCustomizedCode && (
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold whitespace-nowrap">
                      ✓ Đã cá nhân hóa
                    </span>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopyCode}
                  className="h-8 px-2.5 text-xs font-semibold gap-1.5 shrink-0 w-full sm:w-auto justify-center"
                >
                  {copiedCode ? (
                    <>
                      <Check className="size-3.5 text-emerald-500" />
                      <span>Đã chép</span>
                    </>
                  ) : (
                    <>
                      <Copy className="size-3.5" />
                      <span>Chép mã</span>
                    </>
                  )}
                </Button>
              </div>
            )}

            {/* Hàng nút Chia sẻ & Mã QR (Co giãn linh hoạt trên mobile/tablet) */}
            <div className="grid grid-cols-2 gap-2 pt-0.5">
              <Button
                variant="default"
                size="sm"
                onClick={handleCopyLink}
                className="h-9 sm:h-9 text-xs font-bold gap-1.5 shadow-2xs truncate justify-center"
              >
                {copiedLink ? (
                  <>
                    <Check className="size-3.5 text-primary-foreground shrink-0" />
                    <span className="truncate">Đã chép link</span>
                  </>
                ) : (
                  <>
                    <Share2 className="size-3.5 shrink-0" />
                    <span className="truncate">Sao chép Link</span>
                  </>
                )}
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowQrModal(true)}
                className="h-9 sm:h-9 text-xs font-semibold gap-1.5 truncate justify-center"
              >
                <QrCode className="size-3.5 shrink-0" />
                <span className="truncate">Quét mã QR</span>
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* 2. THỐNG KÊ 3 CHỈ SỐ (Thích ứng Mobile, Tablet có sidebar, Desktop) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        <div className="bg-card/60 backdrop-blur-md border border-border/50 rounded-xl sm:rounded-2xl p-3.5 sm:p-4 lg:p-5 flex items-center gap-3.5 sm:gap-4 shadow-2xs">
          <div className="size-11 sm:size-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <Users className="size-5 sm:size-6 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground font-medium truncate">Bạn bè đã mời</p>
            <p className="text-xl sm:text-2xl font-black text-foreground">
              {data?.totalReferrals || 0}{" "}
              <span className="text-xs font-normal text-muted-foreground">người</span>
            </p>
          </div>
        </div>

        <div className="bg-card/60 backdrop-blur-md border border-border/50 rounded-xl sm:rounded-2xl p-3.5 sm:p-4 lg:p-5 flex items-center gap-3.5 sm:gap-4 shadow-2xs">
          <div className="size-11 sm:size-12 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0">
            <CheckCircle2 className="size-5 sm:size-6 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground font-medium truncate">Đã hoàn tất đơn hàng</p>
            <p className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400">
              {data?.successfulReferrals || 0}{" "}
              <span className="text-xs font-normal text-muted-foreground">người</span>
            </p>
          </div>
        </div>

        <div className="bg-card/60 backdrop-blur-md border border-border/50 rounded-xl sm:rounded-2xl p-3.5 sm:p-4 lg:p-5 flex items-center gap-3.5 sm:gap-4 shadow-2xs sm:col-span-2 lg:col-span-1">
          <div className="size-11 sm:size-12 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0">
            <Gift className="size-5 sm:size-6 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground font-medium truncate">Tổng Xu đã tích lũy</p>
            <p className="text-xl sm:text-2xl font-black text-amber-600 dark:text-amber-400 font-mono">
              +{Number(data?.totalCoinsEarned || 0).toLocaleString("vi-VN")}{" "}
              <span className="text-xs font-normal text-muted-foreground">Xu</span>
            </p>
          </div>
        </div>
      </div>

      {/* 3. BẢNG TIẾN TRÌNH & DANH SÁCH BẠN BÈ ĐÃ MỜI (Scroll an toàn, không vỡ layout) */}
      <div className="bg-card/60 backdrop-blur-md border border-border/50 rounded-xl sm:rounded-2xl p-4 sm:p-5 space-y-3.5 sm:space-y-4 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/40 pb-3">
          <div className="flex items-center gap-2">
            <Users className="size-4 text-primary shrink-0" />
            <h2 className="font-bold text-sm sm:text-base text-foreground truncate">
              Danh sách bạn bè đã tham gia
            </h2>
            <span className="text-xs text-muted-foreground">
              ({data?.referralHistory.length || 0})
            </span>
          </div>
          <Link
            href="/account/coins"
            className="text-xs text-primary hover:underline font-semibold inline-flex items-center gap-1 self-start sm:self-auto"
          >
            <span>Xem lịch sử</span>
            <ArrowRight className="size-3.5" />
          </Link>
        </div>

        {/* Nội dung bảng */}
        {!data?.referralHistory || data.referralHistory.length === 0 ? (
          <div className="text-center py-8 sm:py-10 space-y-3 px-2">
            <div className="size-12 sm:size-14 rounded-full bg-muted/50 flex items-center justify-center mx-auto text-muted-foreground">
              <Users className="size-6 sm:size-7" />
            </div>
            <div>
              <p className="text-sm font-bold text-foreground">Chưa có ai tham gia qua mã của bạn</p>
              <p className="text-xs text-muted-foreground mt-0.5 max-w-sm mx-auto">
                Gửi liên kết hoặc mã giới thiệu cho bạn bè ngay hôm nay để nhận tới 20.000 Xu cho mỗi đơn hàng đầu tiên!
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={handleCopyLink}
              className="text-xs font-semibold gap-1.5"
            >
              <Share2 className="size-3.5" />
              <span>Sao chép liên kết chia sẻ</span>
            </Button>
          </div>
        ) : (
          <div className="space-y-1.5">
            <div className="flex sm:hidden justify-end">
              <span className="text-[10.5px] text-muted-foreground">← Vuốt ngang để xem đủ cột →</span>
            </div>
            <div className="overflow-x-auto -mx-4 sm:-mx-5 px-4 sm:px-5">
              <table className="w-full text-xs text-left min-w-[500px]">
                <thead>
                  <tr className="border-b border-border/40 text-muted-foreground font-semibold uppercase text-[10.5px]">
                    <th className="py-2.5 px-3">Bạn bè</th>
                    <th className="py-2.5 px-3">Ngày tham gia</th>
                    <th className="py-2.5 px-3 text-center">Trạng thái</th>
                    <th className="py-2.5 px-3 text-right">Xu bạn nhận</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {data.referralHistory.map((item) => (
                    <tr key={item.id} className="hover:bg-muted/20 transition-colors">
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2.5">
                          <div className="size-7 rounded-full bg-primary/10 flex items-center justify-center text-[11px] font-bold text-primary shrink-0 overflow-hidden">
                            {item.referee_avatar ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={item.referee_avatar}
                                alt={item.referee_name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              item.referee_name.charAt(0).toUpperCase()
                            )}
                          </div>
                          <span className="font-semibold text-foreground text-xs whitespace-nowrap">
                            {item.referee_name}
                          </span>
                        </div>
                      </td>

                      <td className="py-3 px-3 text-muted-foreground whitespace-nowrap">
                        {new Date(item.created_at).toLocaleDateString("vi-VN", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                        })}
                      </td>

                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        {item.status === "rewarded" ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                            <CheckCircle2 className="size-3" />
                            <span>Đã nhận thưởng</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
                            <Clock className="size-3" />
                            <span>Chờ đơn đầu tiên</span>
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-3 text-right font-mono font-bold whitespace-nowrap">
                        {item.status === "rewarded" ? (
                          <span className="text-emerald-600 dark:text-emerald-400">
                            +{Number(item.reward_coins).toLocaleString("vi-VN")} Xu
                          </span>
                        ) : (
                          <span className="text-muted-foreground">
                            +{Number(item.reward_coins).toLocaleString("vi-VN")} Xu
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* 4. QUY TẮC CHƯƠNG TRÌNH (Tối ưu dạng thẻ đều đặn trên mobile, tablet, laptop) */}
      <div className="bg-card/40 border border-border/40 rounded-xl sm:rounded-2xl p-4 sm:p-5 space-y-3">
        <div className="flex items-center gap-2 text-foreground font-bold text-xs sm:text-sm">
          <HelpCircle className="size-4 text-primary shrink-0" />
          <span>Quy tắc chương trình Giới thiệu bạn bè</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-3 text-xs text-muted-foreground">
          <div className="bg-background/40 p-3 sm:p-3.5 rounded-xl border border-border/30">
            <span className="font-bold text-foreground block mb-1">1. Chia sẻ link hoặc mã</span>
            Bạn bè mở liên kết hoặc nhập mã giới thiệu của bạn khi tạo tài khoản mới trên LuxeCommerce.
          </div>
          <div className="bg-background/40 p-3 sm:p-3.5 rounded-xl border border-border/30">
            <span className="font-bold text-foreground block mb-1">2. Bạn mới đặt đơn hàng</span>
            Bạn bè đặt đơn hàng đầu tiên có giá trị từ 100.000đ trở lên và nhận hàng thành công.
          </div>
          <div className="bg-background/40 p-3 sm:p-3.5 rounded-xl border border-border/30 sm:col-span-2 lg:col-span-1">
            <span className="font-bold text-foreground block mb-1">3. Tự động nhận Xu</span>
            Hệ thống tự động cộng từ 10.000 đến 20.000 Xu vào tài khoản của bạn tùy theo hạng VIP hiện tại.
          </div>
        </div>
      </div>

      {/* 5. POP-UP MODAL: QUÉT MÃ QR GIỚI THIỆU (Modal riêng biệt, responsive 3 thiết bị) */}
      <Dialog open={showQrModal} onOpenChange={setShowQrModal}>
        <DialogContent className="sm:max-w-md w-full p-5 sm:p-6 rounded-2xl sm:rounded-3xl border border-border/70 bg-background/95 backdrop-blur-xl shadow-xl">
          <DialogHeader className="flex-row items-center justify-start text-center sm:text-center space-y-1.5">
            <div className="p-3 rounded-md bg-primary/5 flex items-center justify-center text-primary mb-1">
              <QrCode className="size-8" />
            </div>
            <div className="text-left">
              <DialogTitle className="text-lg sm:text-xl font-extrabold tracking-tight">
                Mã QR Giới Thiệu
              </DialogTitle>
              <DialogDescription className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                Quét QR để truy cập link giới thiệu và nhận ưu đãi.
              </DialogDescription>
            </div>
          </DialogHeader>

          <div className="flex flex-col items-center justify-center space-y-4 pt-1 pb-1">
            {/* Khung QR trắng tinh tương phản cao giúp camera nhận diện tức thì */}
            <div className="p-4 bg-white rounded-2xl border border-slate-200/90 shadow-sm flex flex-col items-center">
              <div className="relative size-44 sm:size-48">
                <Image
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&format=svg&data=${encodeURIComponent(
                    shareUrl
                  )}`}
                  alt="Mã QR Giới thiệu"
                  width={192}
                  height={192}
                  unoptimized
                  className="object-contain"
                />
              </div>
              <div className="mt-4  px-3.5 py-1 bg-slate-100 rounded-sm border border-slate-200 text-slate-800 text-xs font-mono font-bold tracking-wider">
                {referralCode}
              </div>
            </div>

            {/* Hộp liên kết & các nút thao tác nhanh trong modal */}
            <div className="w-full space-y-2.5">
              <div className="flex items-center justify-between gap-2 p-2 sm:p-2.5 rounded-xl bg-muted/40 border border-border/60 text-xs">
                <span className="text-muted-foreground truncate pl-1 font-mono text-[11px] sm:text-xs">
                  {shareUrl}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCopyLink}
                  className="h-7 px-2.5 text-xs font-semibold shrink-0 gap-1"
                >
                  {copiedLink ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
                  <span>{copiedLink ? "Đã chép" : "Sao chép"}</span>
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  onClick={handleDownloadQr}
                  className="h-9 text-xs font-semibold gap-1.5 justify-center rounded-xl"
                >
                  <Download className="size-3.5" />
                  <span>Tải ảnh QR</span>
                </Button>

                <Button
                  onClick={handleCopyCode}
                  className="h-9 text-xs font-semibold gap-1.5 justify-center rounded-xl"
                >
                  {copiedCode ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                  <span>Sao chép mã</span>
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

