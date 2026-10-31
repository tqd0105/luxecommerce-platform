"use client";

import { useEffect, useState, useCallback } from "react";
import { format } from "date-fns";
import { vi } from "date-fns/locale";
import { toast } from "sonner";
import {
  OrderTrackingEvent,
  initOrderTrackingEvents,
  getOrderTrackingEvents,
  advanceToNextMilestone,
} from "@/lib/services/order-tracking.service";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2,
  Clock,
  Truck,
  MapPin,
  Package,
  ArrowRight,
  ExternalLink,
  Sparkles,
  RefreshCw,
} from "lucide-react";
import { IconLoader2 } from "@tabler/icons-react";

interface OrderTrackingAdminTabProps {
  order: {
    id: string;
    distance_km?: number | null;
    status: string;
    addresses?: {
      city?: string;
      street?: string;
      latitude?: number | null;
      longitude?: number | null;
    } | null;
  };
  onOrderUpdated?: () => void;
}

export function OrderTrackingAdminTab({ order, onOrderUpdated }: OrderTrackingAdminTabProps) {
  const [events, setEvents] = useState<OrderTrackingEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [advancing, setAdvancing] = useState(false);

  const loadMilestones = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
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

      if (error) {
        console.error("Lỗi khi tải mốc hành trình:", error);
        toast.error("Không thể tải hành trình đơn hàng");
      } else {
        setEvents(data || []);
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, [
    order.id,
    order.distance_km,
    order.addresses?.city,
    order.addresses?.street,
    order.addresses?.latitude,
    order.addresses?.longitude,
  ]);

  useEffect(() => {
    loadMilestones();
  }, [loadMilestones]);

  // Tìm mốc hiện tại và mốc kế tiếp
  const currentIndex = events.findIndex((e) => e.is_current);
  const currentEvent = currentIndex !== -1 ? events[currentIndex] : null;
  const nextEvent = currentIndex !== -1 && currentIndex + 1 < events.length ? events[currentIndex + 1] : null;
  const isAllDelivered = currentEvent?.status === "delivered" || (!currentEvent && events.length > 0 && events.every((e) => e.is_completed));

  // 1-Click chuyển mốc
  const handleAdvance = async () => {
    if (!nextEvent || advancing) return;

    setAdvancing(true);
    try {
      const res = await advanceToNextMilestone(order.id);
      if (res.success) {
        toast.success(`Đã chuyển sang mốc: "${nextEvent.title}"`);
        await loadMilestones(true);
        if (onOrderUpdated) onOrderUpdated();
      } else {
        toast.error("Chuyển mốc thất bại: " + (res.error?.message || "Lỗi không xác định"));
      }
    } catch (err: any) {
      toast.error("Lỗi khi cập nhật mốc: " + err.message);
    } finally {
      setAdvancing(false);
    }
  };

  const getStatusIcon = (status: string, isCurrent: boolean, isCompleted: boolean) => {
    if (isCompleted && !isCurrent) {
      return <CheckCircle2 className="size-5 text-emerald-500" />;
    }
    if (isCurrent) {
      return (
        <span className="relative flex size-5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full size-5 bg-blue-600 items-center justify-center text-white">
            <Truck className="size-3 text-white" />
          </span>
        </span>
      );
    }
    return <Clock className="size-5 text-muted-foreground/40" />;
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3">
        <IconLoader2 className="size-8 animate-spin text-primary/60" />
        <p className="text-xs text-muted-foreground font-medium">Đang tải dữ liệu mốc hành trình...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Thanh thao tác nhanh (1-Click Advance) */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-4 rounded-2xl bg-gradient-to-r from-blue-500/10 via-indigo-500/10 to-purple-500/10 border border-blue-500/20 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-blue-500/25">
            <Sparkles className="size-5" />
          </div>
          <div>
            <div className="text-xs text-muted-foreground font-medium">Tiến độ vận chuyển hiện tại:</div>
            <div className="text-sm font-bold text-foreground">
              {currentEvent ? currentEvent.title : "Chờ kích hoạt"}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {nextEvent ? (
            <Button
              onClick={handleAdvance}
              disabled={advancing}
              className="bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs h-9 px-4 rounded-xl shadow-md shadow-blue-500/25 transition-all gap-1.5 cursor-pointer"
            >
              {advancing ? (
                <>
                  <IconLoader2 className="size-3.5 animate-spin" />
                  <span>Đang xử lý...</span>
                </>
              ) : (
                <>
                  <span>Chuyển sang: {nextEvent.title}</span>
                  <ArrowRight className="size-3.5" />
                </>
              )}
            </Button>
          ) : isAllDelivered ? (
            <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 px-3 py-1.5 text-xs font-bold rounded-xl gap-1.5">
              <CheckCircle2 className="size-4" />
              Đã giao thành công toàn bộ chặng
            </Badge>
          ) : null}

          <Button
            size="sm"
            variant="outline"
            onClick={() => loadMilestones(false)}
            className="size-9 p-0 rounded-xl border-border/60 hover:bg-accent"
            title="Tải lại mốc"
          >
            <RefreshCw className="size-4 text-muted-foreground" />
          </Button>
        </div>
      </div>

      {/* Danh sách mốc dạng Timeline / Stepper */}
      <div className="relative pl-6 sm:pl-8 space-y-6 before:absolute before:left-3 sm:before:left-4 before:top-3 before:bottom-3 before:w-0.5 before:bg-border/60">
        {events.map((ev, idx) => {
          const isDone = ev.is_completed && !ev.is_current;
          const isNow = ev.is_current;

          return (
            <div key={ev.id || idx} className="relative group">
              {/* Dot Icon */}
              <div className="absolute -left-6 sm:-left-8 top-1 flex items-center justify-center bg-card rounded-full p-0.5">
                {getStatusIcon(ev.status, isNow, isDone)}
              </div>

              {/* Nội dung mốc */}
              <div
                className={`p-3.5 sm:p-4 rounded-2xl border transition-all ${
                  isNow
                    ? "bg-blue-500/[0.06] border-blue-500/40 shadow-sm"
                    : isDone
                    ? "bg-card/70 border-border/40 opacity-90"
                    : "bg-muted/20 border-border/20 opacity-60"
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[11px] font-bold text-muted-foreground whitespace-nowrap shrink-0">
                      Chặng {ev.sequence_order}:
                    </span>
                    <h4 className="text-sm font-bold text-foreground">{ev.title}</h4>
                    {isNow && (
                      <Badge className="bg-blue-600 text-white text-[10px] px-2 py-0.5 rounded-full font-bold animate-pulse shrink-0">
                        Đang ở đây
                      </Badge>
                    )}
                  </div>

                  {ev.completed_at && (
                    <span className="text-[11px] text-muted-foreground flex items-center gap-1 font-medium">
                      <Clock className="size-3 text-muted-foreground/60" />
                      {format(new Date(ev.completed_at), "HH:mm dd/MM/yyyy", { locale: vi })}
                    </span>
                  )}
                </div>

                <div className="text-xs text-muted-foreground flex items-center gap-1.5 mb-1">
                  <MapPin className="size-3.5 text-primary/70 shrink-0" />
                  <span className="font-semibold text-foreground/80">{ev.location_name}</span>
                </div>

                {ev.description && (
                  <p className="text-xs text-muted-foreground/90 pl-5 italic">
                    {ev.description}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Link xem nhanh trang tra cứu của khách */}
      <div className="flex items-center justify-between pt-2 border-t border-border/40 text-xs text-muted-foreground">
        <span>Xem giao diện bản đồ trực quan của khách:</span>
        <a
          href={`/tracking/${order.id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-blue-600 hover:text-blue-500 font-bold hover:underline cursor-pointer"
        >
          <span>Mở trang /tracking/{order.id.slice(0, 8)}...</span>
          <ExternalLink className="size-3.5" />
        </a>
      </div>
    </div>
  );
}
