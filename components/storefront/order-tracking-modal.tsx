"use client";

import { useEffect, useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  OrderTrackingEvent,
  getOrderTrackingEvents,
  initOrderTrackingEvents,
  subscribeOrderTracking,
} from "@/lib/services/order-tracking.service";
import { OrderTrackingTimeline } from "@/components/storefront/order-tracking-timeline";
import { IconLoader2 } from "@tabler/icons-react";
import { ExternalLink, Navigation, Package, Truck, Share2, Check } from "lucide-react";
import { toast } from "sonner";
import Image from "next/image";

// Load Leaflet Map động để an toàn tuyệt đối với Next.js SSR
const OrderTrackingMap = dynamic(
  () => import("@/components/storefront/order-tracking-map"),
  {
    ssr: false,
    loading: () => (
      <div className="h-[320px] sm:h-[400px] w-full rounded-2xl bg-muted/30 border border-border/50 flex flex-col items-center justify-center gap-3">
        <IconLoader2 className="size-8 animate-spin text-primary/60" />
        <span className="text-xs text-muted-foreground font-medium">Đang khởi tạo bản đồ hành trình...</span>
      </div>
    ),
  }
);

interface OrderTrackingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: {
    id: string;
    distance_km?: number | null;
    status: string;
    total_amount?: number;
    created_at?: string;
    addresses?: {
      city?: string;
      street?: string;
      latitude?: number | null;
      longitude?: number | null;
    } | null;
  } | null;
}

export function OrderTrackingModal({
  open,
  onOpenChange,
  order,
}: OrderTrackingModalProps) {
  const [events, setEvents] = useState<OrderTrackingEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const loadEvents = useCallback(async (isInitial = false) => {
    if (!order?.id) return;
    if (isInitial) setLoading(true);

    try {
      const { data, error } = await initOrderTrackingEvents({
        orderId: order.id,
        distanceKm: order.distance_km || 5,
        customerCity: order.addresses?.city || "Điểm nhận",
        customerAddress: order.addresses?.street || "",
        customerCoords:
          order.addresses?.latitude && order.addresses?.longitude
            ? { lat: order.addresses.latitude, lng: order.addresses.longitude }
            : null,
      });

      if (!error && data) {
        setEvents(data);
      }
    } finally {
      if (isInitial) setLoading(false);
    }
  }, [order]);

  // Khi đóng modal hoặc đổi đơn hàng, reset lại state
  useEffect(() => {
    if (!open) {
      setEvents([]);
      setLoading(true);
    }
  }, [open]);

  // Load ban đầu khi mở modal
  useEffect(() => {
    if (open && order?.id) {
      setLoading(true);
      loadEvents(true);
    }
  }, [open, order?.id, loadEvents]);

  // Lắng nghe Supabase Realtime WebSocket
  useEffect(() => {
    if (!open || !order?.id) return;

    const unsubscribe = subscribeOrderTracking(order.id, () => {
      loadEvents(false);
      toast.info("Hành trình đơn hàng vừa được cập nhật!");
    });

    return () => {
      unsubscribe();
    };
  }, [open, order?.id, loadEvents]);

  // Copy link tra cứu công khai
  const handleCopyLink = () => {
    if (!order?.id) return;
    const shortCode = order.id.split("-")[0].toUpperCase();
    const url = `${window.location.origin}/tracking/${shortCode}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    toast.success("Đã sao chép link tra cứu hành trình!");
    setTimeout(() => setCopied(false), 2000);
  };

  if (!order) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl md:max-w-5xl max-h-[92vh] overflow-hidden p-0 bg-card/95 backdrop-blur-2xl border-border/50 shadow-2xl rounded-[28px] flex flex-col">
        {/* Header Modal */}
        <DialogHeader className="p-4 sm:p-6 border-b border-border/40 text-left shrink-0">
          <div className="flex flex-wrap items-center justify-between gap-3 pr-8">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="size-12 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                <Image
                  src="/icons/tracking.png"
                  alt="Order Tracking"
                  width={100}
                  height={100}
                />
              </div>
              <div className="min-w-0">
                <DialogTitle className="text-base sm:text-lg md:text-xl font-extrabold text-foreground flex items-center gap-2 truncate">
                  <span>Hành trình Đơn hàng</span>
                  <span className="text-primary font-mono">#{order.id.split("-")[0].toUpperCase()}</span>
                </DialogTitle>
                <p className="text-xs text-muted-foreground truncate">
                  Theo dõi vị trí và tiến độ vận chuyển theo thời gian thực
                </p>
              </div>
            </div>

            {/* <Button
              size="sm"
              variant="outline"
              onClick={handleCopyLink}
              className="h-8 text-xs rounded-full gap-1.5 border-border/60 hover:bg-primary/5 cursor-pointer"
            >
              {copied ? <Check className="size-3.5 text-emerald-500" /> : <Share2 className="size-3.5" />}
              <span>{copied ? "Đã chép link" : "Chia sẻ link"}</span>
            </Button> */}
          </div>
        </DialogHeader>

        {/* Nội dung chính cuộn dọc */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Cột Trái: Bản đồ tương tác Leaflet (chiếm 7 cột trên màn lớn) */}
            <div className="lg:col-span-7 flex flex-col gap-2">
              <div className="flex items-center justify-between text-xs font-bold text-muted-foreground px-1">
                <span className="flex items-center gap-1.5 text-foreground uppercase">
                  {/* <Navigation className="size-3.5 text-blue-600 " /> */}
                  Bản đồ lộ trình
                </span>
                {order.distance_km && (
                  <span className="text-muted-foreground">Khoảng cách: ~{order.distance_km} km</span>
                )}
              </div>

              <OrderTrackingMap
                events={events}
                destinationCoords={
                  order.addresses?.latitude && order.addresses?.longitude
                    ? { lat: order.addresses.latitude, lng: order.addresses.longitude }
                    : null
                }
                destinationAddress={`${order.addresses?.street || ""}, ${order.addresses?.city || ""}`}
                className="h-[320px] sm:h-[400px] lg:h-[460px] w-full rounded-2xl"
              />
            </div>

            {/* Cột Phải: Dòng thời gian Timeline các mốc (chiếm 5 cột trên màn lớn) */}
            <div className="lg:col-span-5 flex flex-col gap-2">
              <div className="uppercase text-xs font-bold text-foreground px-1 flex items-center gap-1.5">
                {/* <Package className="size-3.5 text-emerald-600" /> */}
                <span>Chi tiết các chặng</span>
              </div>

              <div className="max-h-[460px] overflow-y-auto pr-1 rounded-2xl">
                <OrderTrackingTimeline
                  events={events}
                  orderStatus={order.status}
                  isLoading={loading}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 sm:p-4 px-6 border-t border-border/40 bg-muted/20 flex items-center justify-between gap-3 text-xs text-muted-foreground shrink-0">
          <span className="hidden sm:inline">Hệ thống đồng bộ trực tiếp với bưu cục giao nhận.</span>
          <div className="flex items-center gap-2 ml-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="h-8 px-4 rounded-full text-xs font-semibold cursor-pointer"
            >
              Đóng
            </Button>
            <a
              href={`/tracking/${order.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 h-8 px-4 rounded-full text-xs font-bold shadow-sm transition-all cursor-pointer"
            >
              <span>Xem trang riêng</span>
              <ExternalLink className="size-3.5" />
            </a>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
