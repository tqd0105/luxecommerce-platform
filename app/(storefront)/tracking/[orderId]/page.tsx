"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import Link from "next/link";
import { format } from "date-fns";
import { vi } from "date-fns/locale";
import {
  OrderTrackingEvent,
  initOrderTrackingEvents,
  subscribeOrderTracking,
  getPublicOrderTracking,
} from "@/lib/services/order-tracking.service";
import { OrderTrackingTimeline } from "@/components/storefront/order-tracking-timeline";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Truck,
  Package,
  Navigation,
  ArrowLeft,
  Share2,
  Check,
  Search,
  MapPin,
  Calendar,
  AlertCircle,
  Receipt,
  User,
  Phone,
} from "lucide-react";
import { IconLoader2 } from "@tabler/icons-react";
import { toast } from "sonner";
import Image from "next/image";

// Load Leaflet Map động để an toàn tuyệt đối với Next.js SSR
const OrderTrackingMap = dynamic(
  () => import("@/components/storefront/order-tracking-map"),
  {
    ssr: false,
    loading: () => (
      <div className="h-[380px] sm:h-[460px] w-full rounded-2xl bg-muted/30 border border-border/50 flex flex-col items-center justify-center gap-3">
        <IconLoader2 className="size-8 animate-spin text-primary/60" />
        <span className="text-xs text-muted-foreground font-medium">Đang khởi tạo bản đồ hành trình...</span>
      </div>
    ),
  }
);

export default function PublicOrderTrackingPage() {
  const params = useParams();
  const router = useRouter();
  const rawOrderId = params.orderId as string;

  const [order, setOrder] = useState<any>(null);
  const [events, setEvents] = useState<OrderTrackingEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [searchCode, setSearchCode] = useState("");
  const [copied, setCopied] = useState(false);

  // Tải thông tin đơn hàng và mốc hành trình
  const fetchOrderData = useCallback(async (orderIdToFetch: string) => {
    setLoading(true);
    setNotFound(false);

    try {
      // 1. Tra cứu thông tin đơn hàng và hành trình qua RPC công khai (hỗ trợ cả mã ngắn, UUID đầy đủ, hoặc mã thanh toán)
      const { data: publicData, error: publicError } = await getPublicOrderTracking(orderIdToFetch);

      if (publicError || !publicData) {
        setNotFound(true);
        setOrder(null);
        setEvents([]);
        return;
      }

      setOrder(publicData);

      // 2. Gán mốc hành trình hoặc tự động khởi tạo nếu chưa có
      if (publicData.tracking_events && publicData.tracking_events.length > 0) {
        setEvents(publicData.tracking_events);
      } else {
        const addressObj = publicData.addresses;
        const { data: trackingData, error: trackingError } = await initOrderTrackingEvents({
          orderId: publicData.id,
          distanceKm: publicData.distance_km || 5,
          customerCity: addressObj?.city || "Điểm nhận",
          customerAddress: addressObj?.street || "",
          customerCoords:
            addressObj?.latitude && addressObj?.longitude
              ? { lat: addressObj.latitude, lng: addressObj.longitude }
              : null,
        });

        if (!trackingError && trackingData) {
          setEvents(trackingData);
        }
      }
    } catch (err) {
      console.error("Lỗi khi tải dữ liệu tra cứu đơn hàng:", err);
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (rawOrderId) {
      fetchOrderData(rawOrderId);
    }
  }, [rawOrderId, fetchOrderData]);

  // Lắng nghe Supabase Realtime
  useEffect(() => {
    if (!order?.id) return;

    const unsubscribe = subscribeOrderTracking(order.id, () => {
      fetchOrderData(order.id);
      toast.info("Hành trình đơn hàng vừa được cập nhật theo thời gian thực!");
    });

    return () => {
      unsubscribe();
    };
  }, [order?.id, fetchOrderData]);

  // Xử lý tìm kiếm mã đơn khác
  const handleSearchOtherOrder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchCode.trim()) return;
    const clean = searchCode.trim().replace(/^#/, "");
    router.push(`/tracking/${clean}`);
  };

  // Chia sẻ link tra cứu ngắn gọn
  const handleCopyLink = () => {
    if (typeof window === "undefined") return;
    const shortCode = order?.id ? order.id.split("-")[0].toUpperCase() : rawOrderId.replace(/^#/, "").toUpperCase();
    const url = `${window.location.origin}/tracking/${shortCode}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    toast.success("Đã sao chép link tra cứu đơn hàng!");
    setTimeout(() => setCopied(false), 2000);
  };

  const address = order?.addresses ? (Array.isArray(order.addresses) ? order.addresses[0] : order.addresses) : null;

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-muted/10 to-background py-8 sm:py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto space-y-6 sm:space-y-8">
        {/* Navigation & Search Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-xs sm:text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="size-4" />
            <span>Quay lại trang chủ</span>
          </Link>

          <form onSubmit={handleSearchOtherOrder} className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-72">
              <Search className="size-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                value={searchCode}
                onChange={(e) => setSearchCode(e.target.value)}
                placeholder="Nhập mã đơn hàng khác..."
                className="pl-9 h-10 rounded-full text-xs bg-card/80 border-border/60 shadow-2xs"
              />
            </div>
            <Button type="submit" size="sm" className="h-10 px-4 rounded-full text-xs font-bold shrink-0">
              Tra cứu
            </Button>
          </form>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <IconLoader2 className="size-12 animate-spin text-primary" />
            <p className="text-sm font-semibold text-foreground">Đang tải hành trình trực tiếp của đơn hàng...</p>
            <p className="text-xs text-muted-foreground">Vui lòng đợi trong giây lát</p>
          </div>
        )}

        {/* Not Found State */}
        {!loading && notFound && (
          <Card className="rounded-3xl border-border/60 bg-card/60 backdrop-blur-xl shadow-lg p-8 sm:p-12 text-center max-w-lg mx-auto">
            <div className="size-16 rounded-3xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="size-8" />
            </div>
            <h2 className="text-lg sm:text-xl font-bold text-foreground mb-2">Không tìm thấy thông tin đơn hàng</h2>
            <p className="text-xs sm:text-sm text-muted-foreground mb-6">
              Mã đơn hàng <span className="font-mono font-bold text-foreground">#{rawOrderId}</span> không tồn tại hoặc đã bị xóa. Vui lòng kiểm tra lại mã đơn chính xác.
            </p>
            <Button asChild className="rounded-full px-6 font-bold text-xs h-10">
              <Link href="/">Về trang mua sắm</Link>
            </Button>
          </Card>
        )}

        {/* Success / Live Order Tracking View */}
        {!loading && !notFound && order && (
          <div className="space-y-6 sm:space-y-8 animate-in fade-in duration-300">
            {/* Header Thẻ Đơn Hàng & Thông Tin Nhận Hàng Trực Quan */}
            <div className="p-5 sm:p-7 md:p-8 rounded-3xl bg-card/85 backdrop-blur-xl border border-border/60 shadow-sm space-y-5 sm:space-y-6">
              {/* Hàng 1: Tiêu đề + Mã đơn + Nút hành động */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-border/50">
                <div className="flex items-center gap-3">
                  <div className="size-11 sm:size-12 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 shadow-inner">
                    <Image unoptimized src="/icons/tracking.png" alt="Tracking" width={34} height={34} className="object-contain" />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h1 className="text-lg sm:text-2xl font-extrabold text-foreground tracking-tight">
                        Hành trình Đơn hàng
                      </h1>
                      <span className="font-mono font-extrabold text-sm sm:text-base text-primary bg-primary/10 px-2.5 py-0.5 rounded-lg border border-primary/20">
                        #{order.id.split("-")[0].toUpperCase()}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5">
                      <Calendar className="size-3.5 text-muted-foreground/70" />
                      Ngày đặt: {format(new Date(order.created_at), "dd/MM/yyyy HH:mm", { locale: vi })}
                    </p>
                  </div>
                </div>

                {/* Các nút hành động nhanh */}
                <div className="flex items-center gap-2.5 self-start md:self-auto w-full md:w-auto">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleCopyLink}
                    className="flex-1 md:flex-none rounded-full h-9 sm:h-10 px-3.5 sm:px-4 text-xs font-bold gap-1.5 sm:gap-2 border-border/60 hover:bg-accent cursor-pointer shadow-xs"
                  >
                    {copied ? <Check className="size-3.5 sm:size-4 text-emerald-500" /> : <Share2 className="size-3.5 sm:size-4" />}
                    <span>{copied ? "Đã chép link" : "Chia sẻ link"}</span>
                  </Button>

                  <Button
                    asChild
                    size="sm"
                    className="flex-1 md:flex-none rounded-full h-9 sm:h-10 px-4 sm:px-5 text-xs font-bold gap-1.5 sm:gap-2 shadow-md shadow-primary/20"
                  >
                    <Link href="/account/orders">
                      <Receipt className="size-3.5 sm:size-4" />
                      <span>Đơn hàng của tôi</span>
                    </Link>
                  </Button>
                </div>
              </div>

              {/* Hàng 2: Khối thông tin Người nhận & Địa chỉ giao hàng (Tối ưu Mobile / Tablet / Desktop) */}
              {address && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-0.5">
                  {/* Card Người nhận */}
                  <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-muted/30 border border-border/40 hover:bg-muted/40 transition-colors">
                    <div className="size-9 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 mt-0.5">
                      <Image src="/icons/people.png" alt="User" width={24} height={24} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">Người nhận hàng</span>
                      <p className="text-[13px] font-bold text-foreground truncate mt-0.5">
                        {address.full_name || "Khách hàng"}
                      </p>
                      {address.phone && (
                        <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5 mt-0.5">
                          <Phone className="size-3 text-muted-foreground/80" />
                          <span>{address.phone}</span>
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Card Địa chỉ giao hàng */}
                  <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-muted/30 border border-border/40 hover:bg-muted/40 transition-colors sm:col-span-1 lg:col-span-2">
                    <div className="size-9 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0 mt-0.5">
                      <Image src="/icons/location.png" alt="User" width={24} height={24} />

                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">Địa chỉ nhận hàng</span>
                        {order.distance_km ? (
                          <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-md border border-primary/20 shrink-0">
                            Cự ly: ~{order.distance_km} km
                          </span>
                        ) : null}
                      </div>
                      <p className="text-[13px] font-semibold text-foreground mt-0.5 line-clamp-2">
                        {address.street ? `${address.street}, ` : ""}{address.city}
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Điểm đến: <strong className="text-foreground font-medium">{address.city}</strong>
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Layout 2 Cột: Bản đồ lộ trình & Dòng thời gian */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 items-start">
              {/* Cột Trái: Bản đồ trực quan (7 cột) */}
              <div className="lg:col-span-7 space-y-3">
                <div className="flex items-center justify-between px-1">
                  <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                    <Navigation className="size-4 text-blue-600" />
                    <span>Bản đồ lộ trình di chuyển</span>
                  </h3>
                  {order.distance_km && (
                    <span className="text-xs font-medium text-muted-foreground bg-muted/40 px-2.5 py-1 rounded-full border border-border/40">
                      Khoảng cách vận chuyển: ~{order.distance_km} km
                    </span>
                  )}
                </div>

                <OrderTrackingMap
                  events={events}
                  destinationCoords={
                    address?.latitude && address?.longitude
                      ? { lat: address.latitude, lng: address.longitude }
                      : null
                  }
                  destinationAddress={`${address?.street || ""}, ${address?.city || ""}`}
                  className="h-[380px] sm:h-[460px] lg:h-[520px] w-full rounded-3xl"
                />
              </div>

              {/* Cột Phải: Dòng thời gian Timeline các mốc (5 cột) */}
              <div className="lg:col-span-5 space-y-5">
                <div className="p-5 sm:p-6 rounded-3xl bg-card/80 backdrop-blur-xl border border-border/60 shadow-sm space-y-4">
                  <h3 className="text-sm font-bold text-foreground flex items-center gap-2 border-b border-border/40 pb-3">
                    <Package className="size-4 text-emerald-600" />
                    <span>Tiến độ từng chặng</span>
                  </h3>

                  <OrderTrackingTimeline
                    events={events}
                    orderStatus={order.status}
                    isLoading={loading}
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
