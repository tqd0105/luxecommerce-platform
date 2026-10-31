"use client";

import { format } from "date-fns";
import { vi } from "date-fns/locale";
import { OrderTrackingEvent } from "@/lib/services/order-tracking.service";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2,
  Clock,
  Truck,
  MapPin,
  Package,
  Radio,
  AlertCircle,
  Building2,
  Home,
} from "lucide-react";
import Image from "next/image";

interface OrderTrackingTimelineProps {
  events: OrderTrackingEvent[];
  orderStatus?: string;
  className?: string;
  isLoading?: boolean;
}

export function OrderTrackingTimeline({
  events,
  orderStatus,
  className = "",
  isLoading = false,
}: OrderTrackingTimelineProps) {
  // Trạng thái đang tải (Loading Skeleton)
  if (isLoading) {
    return (
      <div className={`space-y-4 animate-in fade-in duration-300 ${className}`}>
        {/* Banner Skeleton */}
        <div className="p-4 sm:p-5 rounded-2xl bg-card border border-border/60 shadow-xs flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="relative flex size-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full size-2.5 bg-blue-500"></span>
            </span>
            <span className="text-xs font-semibold text-muted-foreground animate-pulse">
              Đang kết nối hệ thống vận chuyển...
            </span>
          </div>
          <div className="h-6 w-24 rounded-full bg-muted/60 animate-pulse" />
        </div>

        {/* Skeleton timeline items */}
        <div className="space-y-3 pl-8 relative before:absolute before:left-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-muted/40">
          {[1, 2, 3].map((i) => (
            <div key={i} className="relative group">
              <div className="absolute -left-6 sm:-left-7 top-2 size-5 rounded-full bg-muted/60 animate-pulse border border-background shadow-xs" />
              <div className="p-3.5 sm:p-4 rounded-2xl border border-border/30 bg-card/40 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="h-4 w-36 rounded-md bg-muted/60 animate-pulse" />
                  <div className="h-3 w-16 rounded-md bg-muted/40 animate-pulse" />
                </div>
                <div className="h-3 w-48 rounded-md bg-muted/40 animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!events || events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center rounded-2xl bg-muted/20 border border-border/40 animate-in fade-in duration-300">
        <Package className="size-10 text-muted-foreground/40 mb-2 animate-bounce" />
        <p className="text-sm font-semibold text-foreground">Đang chuẩn bị thông tin hành trình</p>
        <p className="text-xs text-muted-foreground mt-1">
          Hệ thống đang đồng bộ dữ liệu với bưu cục. Vui lòng đợi trong giây lát...
        </p>
      </div>
    );
  }

  // Mốc hiện tại
  const currentEvent = events.find((e) => e.is_current) || events[0];
  const isDelivered = currentEvent?.status === "delivered";
  const isCancelled = orderStatus === "cancelled";

  return (
    <div className={`space-y-5 ${className}`}>
      {/* Banner Tóm Tắt Trạng Thái Hiện Tại */}
      <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-card via-card to-primary/[0.03] border border-border/60 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-2.5">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-2.5">
              <Radio className="size-3.5 animate-ping" />
              Cập nhật trực tiếp
            </span>
          </div>

          <Badge
            variant="outline"
            className={`font-bold px-3 py-1 rounded-full text-xs shadow-2xs ${isDelivered
              ? "bg-emerald-500/15 text-emerald-600 border-emerald-500/30 dark:text-emerald-400"
              : isCancelled
                ? "bg-red-500/15 text-red-600 border-red-500/30 dark:text-red-400"
                : "bg-blue-500/15 text-blue-600 border-blue-500/30 dark:text-blue-400"
              }`}
          >
            {isDelivered
              ? "Giao hàng thành công"
              : isCancelled
                ? "Đơn hàng đã hủy"
                : currentEvent.title}
          </Badge>
        </div>

        <div className="space-y-1">
          <div className="flex items-center gap-2 text-foreground font-extrabold text-sm sm:text-base">
            <MapPin className="size-4 text-primary shrink-0" />
            <span className="line-clamp-1">{currentEvent.location_name}</span>
          </div>

          {currentEvent.description && (
            <p className="text-xs text-muted-foreground pl-6 line-clamp-2">
              {currentEvent.description}
            </p>
          )}

          {currentEvent.completed_at && (
            <p className="text-[11px] text-muted-foreground/80 pl-6 pt-1 flex items-center gap-1.5 font-medium">
              <Clock className="size-3" />
              <span>Cập nhật lúc: {format(new Date(currentEvent.completed_at), "HH:mm, dd/MM/yyyy", { locale: vi })}</span>
            </p>
          )}
        </div>
      </div>

      {/* Dòng Thời Gian (Vertical Stepper) */}
      <div className="relative pl-6 sm:pl-8 space-y-6 before:absolute before:left-3 sm:before:left-4 before:top-3 before:bottom-3 before:w-0.5 before:bg-gradient-to-b before:from-emerald-500 before:via-blue-500 before:to-border/40">
        {events.map((ev, idx) => {
          const isDone = ev.is_completed && !ev.is_current;
          const isNow = ev.is_current;

          return (
            <div key={ev.id || idx} className="relative group">
              {/* Icon Mốc Hành Trình */}
              <div className="absolute -left-6 sm:-left-7 top-1 flex items-center justify-center bg-card rounded-full p-0.5 shadow-2xs">
                {isDone ? (
                  <div className="size-5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-500/30">
                    <Image unoptimized src="/icons/check1.png" alt="" width={15} height={15} />
                  </div>
                ) : isNow ? (
                  <span className="relative flex size-5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full size-5 bg-blue-600 items-center justify-center text-white shadow-md shadow-blue-500/40">
                      <Image unoptimized src="/icons/truck.png" alt="" width={15} height={15} />
                    </span>
                  </span>
                ) : (
                  <div className="size-5 rounded-full bg-muted/40 text-muted-foreground/50 flex items-center justify-center border border-border/40">
                    <Image unoptimized src="/icons/clock.png" alt="" width={15} height={15} />
                  </div>
                )}
              </div>

              {/* Card Thông Tin Mốc */}
              <div
                className={`p-3.5 sm:p-4 rounded-2xl border transition-all duration-200 ${isNow
                  ? "bg-blue-500/[0.05] border-blue-500/40 shadow-xs ring-1 ring-blue-500/20"
                  : isDone
                    ? "bg-card border-border/50 hover:border-border"
                    : "bg-muted/15 border-border/20 opacity-60"
                  }`}
              >
                <div className="flex items-start justify-between gap-2.5 mb-1.5">
                  <div className="min-w-0 flex-1">
                    <h4 className="text-xs sm:text-sm font-bold text-foreground leading-snug">
                      <span className="text-[11px] font-extrabold text-muted-foreground mr-1.5 whitespace-nowrap">
                        Chặng {ev.sequence_order}:
                      </span>
                      <span>{ev.title}</span>
                    </h4>
                  </div>

                  {ev.completed_at && (
                    <span className="text-[10px] sm:text-[11px] font-semibold text-muted-foreground flex items-center gap-1 shrink-0 whitespace-nowrap pt-0.5">
                      <Clock className="size-3 opacity-60" />
                      {format(new Date(ev.completed_at), "HH:mm - dd/MM", { locale: vi })}
                    </span>
                  )}
                </div>

                <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <MapPin className="size-3.5 text-primary/70 shrink-0" />
                  <span className="font-semibold text-foreground/80">{ev.location_name}</span>
                </div>

                {ev.description && (
                  <p className="text-xs text-muted-foreground/80 pl-5 pt-1 italic">
                    {ev.description}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
