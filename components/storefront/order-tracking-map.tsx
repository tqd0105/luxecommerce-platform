"use client";

import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { OrderTrackingEvent } from "@/lib/services/order-tracking.service";
import { WAREHOUSE_LOCATION } from "@/lib/services/shipping.service";
import { Button } from "@/components/ui/button";
import { Maximize2, LocateFixed, Navigation } from "lucide-react";
import { format } from "date-fns";
import { vi } from "date-fns/locale";

interface OrderTrackingMapProps {
  events: OrderTrackingEvent[];
  originCoords?: { lat: number; lng: number };
  destinationCoords?: { lat: number; lng: number } | null;
  destinationAddress?: string;
  className?: string;
}

export default function OrderTrackingMap({
  events,
  originCoords = WAREHOUSE_LOCATION,
  destinationCoords,
  destinationAddress = "Địa chỉ nhận hàng",
  className = "h-[350px] sm:h-[420px] w-full rounded-2xl",
}: OrderTrackingMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);

  // Mốc hiện tại
  const currentEvent = events.find((e) => e.is_current) || events[0];

  const initialCenterRef = useRef<[number, number]>([
    currentEvent?.latitude && currentEvent?.longitude ? currentEvent.latitude : originCoords.lat,
    currentEvent?.latitude && currentEvent?.longitude ? currentEvent.longitude : originCoords.lng,
  ]);

  // Khởi tạo bản đồ Leaflet
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: initialCenterRef.current,
      zoom: 12,
      zoomControl: false,
    });
    mapRef.current = map;

    // Zoom control góc dưới phải
    L.control.zoom({ position: "bottomright" }).addTo(map);

    // Tile Layer: Ưu tiên Goong Maps nếu có key, fallback về OpenStreetMap
    const goongMapKey = process.env.NEXT_PUBLIC_GOONG_MAP_KEY;
    const tileUrl = goongMapKey
      ? `https://tiles.goong.io/{z}/{x}/{y}.png?api_key=${goongMapKey}`
      : "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";

    L.tileLayer(tileUrl, {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);

    const layerGroup = L.layerGroup().addTo(map);
    markersLayerRef.current = layerGroup;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Vẽ các mốc, icon xe, đường polyline khi events thay đổi
  useEffect(() => {
    const map = mapRef.current;
    const layer = markersLayerRef.current;
    if (!map || !layer) return;

    layer.clearLayers();

    const points: [number, number][] = [];
    const completedPoints: [number, number][] = [];
    const remainingPoints: [number, number][] = [];

    // 1. Điểm Xuất Phát (Kho hàng)
    const originPoint: [number, number] = [originCoords.lat, originCoords.lng];
    points.push(originPoint);
    completedPoints.push(originPoint);

    const warehouseIcon = L.divIcon({
      className: "custom-warehouse-pin",
      html: `
        <div style="display:flex; align-items:center; justify-content:center; width:34px; height:34px; background:#4f46e5; color:white; border-radius:50%; border:3px solid white; box-shadow:0 4px 10px rgba(0,0,0,0.25);">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
        </div>
      `,
      iconSize: [34, 34],
      iconAnchor: [17, 17],
    });

    L.marker(originPoint, { icon: warehouseIcon })
      .addTo(layer)
      .bindPopup(`
        <div style="font-family:inherit; min-width:180px;">
          <div style="display:flex; align-items:center; gap:6px; margin-bottom:4px;">
            <span style="font-size:10px; font-weight:800; color:#4f46e5; background:rgba(79,70,229,0.12); padding:1.5px 7px; border-radius:6px; text-transform:uppercase; letter-spacing:0.03em;">
              🏢 Kho xuất phát
            </span>
          </div>
          <div class="popup-title" style="font-weight:800; color:#0f172a; font-size:13px; line-height:1.35;">
            ${WAREHOUSE_LOCATION.name || "Kho Tổng LuxeCommerce"}
          </div>
          <div class="popup-loc" style="color:#64748b; font-size:11px; margin-top:4px; display:flex; align-items:center; gap:4px;">
            <span>📍</span> <span>Trung tâm đóng gói & xuất kho</span>
          </div>
        </div>
      `);

    // 2. Các Mốc Sự Kiện (Events)
    let passedCurrent = false;

    events.forEach((ev, idx) => {
      if (typeof ev.latitude !== "number" || typeof ev.longitude !== "number") return;
      const pt: [number, number] = [ev.latitude, ev.longitude];
      points.push(pt);

      if (ev.is_current) {
        passedCurrent = true;
        completedPoints.push(pt);
        remainingPoints.push(pt);

        // Radar Shipper Icon
        const currentIcon = L.divIcon({
          className: "custom-current-truck-pin",
          html: `
            <div style="position:relative; width:44px; height:44px; display:flex; align-items:center; justify-content:center;">
              <span style="position:absolute; width:100%; height:100%; border-radius:50%; background:#3b82f6; opacity:0.4; animation:ping 1.5s cubic-bezier(0,0,0.2,1) infinite;"></span>
              <div style="position:relative; width:36px; height:36px; border-radius:50%; background:#2563eb; color:white; display:flex; align-items:center; justify-content:center; border:3px solid white; box-shadow:0 6px 14px rgba(37,99,235,0.45);">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/></svg>
              </div>
            </div>
          `,
          iconSize: [44, 44],
          iconAnchor: [22, 22],
        });

        L.marker(pt, { icon: currentIcon })
          .addTo(layer)
          .bindPopup(`
            <div style="font-family:inherit; min-width:200px;">
              <div style="display:flex; align-items:center; gap:6px; margin-bottom:5px;">
                <span style="font-size:10px; font-weight:800; color:#2563eb; background:rgba(37,99,235,0.12); padding:1.5px 7px; border-radius:6px; text-transform:uppercase; letter-spacing:0.03em;">
                  🚚 Vị trí hiện tại
                </span>
                <span style="font-size:10px; font-weight:800; color:#2563eb; background:rgba(37,99,235,0.08); padding:1.5px 6px; border-radius:6px;">
                  Chặng ${ev.sequence_order}
                </span>
              </div>
              <div class="popup-title" style="font-weight:800; color:#0f172a; font-size:13px; line-height:1.35;">
                ${ev.title}
              </div>
              <div class="popup-loc" style="color:#64748b; font-size:11px; margin-top:4px; display:flex; align-items:center; gap:4px;">
                <span>📍</span> <span style="font-weight:600;">${ev.location_name}</span>
              </div>
              ${ev.completed_at ? `
                <div class="popup-sub" style="font-size:10px; color:#94a3b8; margin-top:4px; display:flex; align-items:center; gap:4px; font-weight:500;">
                  <span>🕒</span> <span>${format(new Date(ev.completed_at), "HH:mm - dd/MM/yyyy", { locale: vi })}</span>
                </div>
              ` : ""}
            </div>
          `)
          .openPopup();
      } else if (ev.is_completed) {
        if (!passedCurrent) {
          completedPoints.push(pt);
        }
        // Điểm đã qua
        const completedIcon = L.divIcon({
          className: "custom-completed-pin",
          html: `
            <div style="width:20px; height:20px; border-radius:50%; background:#10b981; border:2.5px solid white; box-shadow:0 2px 6px rgba(0,0,0,0.2); display:flex; align-items:center; justify-content:center;">
              <div style="width:6px; height:6px; border-radius:50%; background:white;"></div>
            </div>
          `,
          iconSize: [20, 20],
          iconAnchor: [10, 10],
        });

        L.marker(pt, { icon: completedIcon })
          .addTo(layer)
          .bindPopup(`
            <div style="font-family:inherit; min-width:190px;">
              <div style="display:flex; align-items:center; gap:6px; margin-bottom:4px;">
                <span style="font-size:10px; font-weight:800; color:#059669; background:rgba(16,185,129,0.12); padding:1.5px 7px; border-radius:6px; text-transform:uppercase; letter-spacing:0.03em;">
                  ✓ Chặng ${ev.sequence_order} • Đã qua
                </span>
              </div>
              <div class="popup-title" style="font-weight:800; color:#0f172a; font-size:13px; line-height:1.35;">
                ${ev.title}
              </div>
              <div class="popup-loc" style="color:#64748b; font-size:11px; margin-top:4px; display:flex; align-items:center; gap:4px;">
                <span>📍</span> <span style="font-weight:600;">${ev.location_name}</span>
              </div>
              ${ev.completed_at ? `
                <div class="popup-sub" style="font-size:10px; color:#94a3b8; margin-top:4px; display:flex; align-items:center; gap:4px; font-weight:500;">
                  <span>🕒</span> <span>${format(new Date(ev.completed_at), "HH:mm - dd/MM/yyyy", { locale: vi })}</span>
                </div>
              ` : ""}
            </div>
          `);
      } else {
        remainingPoints.push(pt);
        // Điểm sắp tới
        const upcomingIcon = L.divIcon({
          className: "custom-upcoming-pin",
          html: `
            <div style="width:16px; height:16px; border-radius:50%; background:#94a3b8; border:2px solid white; box-shadow:0 1px 4px rgba(0,0,0,0.15);"></div>
          `,
          iconSize: [16, 16],
          iconAnchor: [8, 8],
        });

        L.marker(pt, { icon: upcomingIcon })
          .addTo(layer)
          .bindPopup(`
            <div style="font-family:inherit; min-width:190px;">
              <div style="display:flex; align-items:center; gap:6px; margin-bottom:4px;">
                <span style="font-size:10px; font-weight:800; color:#64748b; background:rgba(148,163,184,0.15); padding:1.5px 7px; border-radius:6px; text-transform:uppercase; letter-spacing:0.03em;">
                  Chặng ${ev.sequence_order} • Sắp tới
                </span>
              </div>
              <div class="popup-title" style="font-weight:700; color:#334155; font-size:12.5px; line-height:1.35;">
                ${ev.title}
              </div>
              <div class="popup-loc" style="color:#64748b; font-size:11px; margin-top:4px; display:flex; align-items:center; gap:4px;">
                <span>📍</span> <span>${ev.location_name}</span>
              </div>
            </div>
          `);
      }
    });

    // 3. Điểm Đến Của Khách Hàng (Destination)
    if (destinationCoords && destinationCoords.lat && destinationCoords.lng) {
      const destPt: [number, number] = [destinationCoords.lat, destinationCoords.lng];
      points.push(destPt);
      remainingPoints.push(destPt);

      const destIcon = L.divIcon({
        className: "custom-dest-pin",
        html: `
          <div style="display:flex; align-items:center; justify-content:center; width:34px; height:34px; background:#ef4444; color:white; border-radius:50%; border:3px solid white; box-shadow:0 4px 10px rgba(239,68,68,0.35);">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
          </div>
        `,
        iconSize: [34, 34],
        iconAnchor: [17, 34],
      });

      L.marker(destPt, { icon: destIcon })
        .addTo(layer)
        .bindPopup(`
          <div style="font-family:inherit; min-width:190px;">
            <div style="display:flex; align-items:center; gap:6px; margin-bottom:4px;">
              <span style="font-size:10px; font-weight:800; color:#dc2626; background:rgba(239,68,68,0.12); padding:1.5px 7px; border-radius:6px; text-transform:uppercase; letter-spacing:0.03em;">
                🎯 Điểm giao hàng
              </span>
            </div>
            <div class="popup-title" style="color:#0f172a; font-weight:700; font-size:12.5px; line-height:1.35;">
              ${destinationAddress || "Địa chỉ nhận hàng"}
            </div>
          </div>
        `);
    }

    // 4. Vẽ Polyline Lộ Trình
    // Đoạn đã đi qua: Nét liền màu xanh dương rực rỡ
    if (completedPoints.length > 1) {
      L.polyline(completedPoints, {
        color: "#2563eb",
        weight: 4.5,
        opacity: 0.85,
        smoothFactor: 1,
      }).addTo(layer);
    }

    // Đoạn còn lại: Nét đứt màu xám bạc
    if (remainingPoints.length > 1) {
      L.polyline(remainingPoints, {
        color: "#94a3b8",
        weight: 3.5,
        dashArray: "6, 8",
        opacity: 0.7,
      }).addTo(layer);
    }

    // 5. Fit bounds để nhìn trọn lộ trình
    if (points.length > 0) {
      const bounds = L.latLngBounds(points);
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
    }
  }, [events, originCoords, destinationCoords, destinationAddress, currentEvent]);

  // Nút căn giữa vị trí xe hiện tại
  const handleRecenter = () => {
    if (!mapRef.current) return;
    if (currentEvent?.latitude && currentEvent?.longitude) {
      mapRef.current.flyTo([currentEvent.latitude, currentEvent.longitude], 14, { duration: 1.2 });
    }
  };

  // Nút bao quát toàn bộ hành trình
  const handleFitRoute = () => {
    if (!mapRef.current) return;
    const allPts: [number, number][] = [[originCoords.lat, originCoords.lng]];
    events.forEach((e) => {
      if (e.latitude && e.longitude) allPts.push([e.latitude, e.longitude]);
    });
    if (destinationCoords?.lat && destinationCoords?.lng) {
      allPts.push([destinationCoords.lat, destinationCoords.lng]);
    }
    if (allPts.length > 1) {
      mapRef.current.fitBounds(L.latLngBounds(allPts), { padding: [40, 40] });
    }
  };

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border/60 shadow-xs">
      <div ref={containerRef} className={className} />

      {/* Floating Controls */}
      <div className="absolute top-3 right-3 z-[400] flex flex-col gap-1.5">
        <Button
          size="sm"
          variant="secondary"
          onClick={handleRecenter}
          className="size-8 p-0 rounded-xl bg-card/90 backdrop-blur-md hover:bg-card border border-border/50 shadow-md cursor-pointer"
          title="Căn giữa vị trí hiện tại"
        >
          <LocateFixed className="size-4 text-blue-600 dark:text-blue-400" />
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onClick={handleFitRoute}
          className="size-8 p-0 rounded-xl bg-card/90 backdrop-blur-md hover:bg-card border border-border/50 shadow-md cursor-pointer"
          title="Xem toàn bộ lộ trình"
        >
          <Maximize2 className="size-4 text-foreground/80" />
        </Button>
      </div>

      {/* Chú thích chặng bản đồ nhỏ gọn ở góc dưới */}
      <div className="absolute bottom-3 left-3 z-[400] hidden sm:flex items-center gap-3 bg-card/90 backdrop-blur-md px-3 py-1.5 rounded-xl border border-border/50 shadow-md text-[11px] font-semibold text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-blue-600"></span>
          Đã đi qua
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 border-b-2 border-dashed border-slate-400"></span>
          Chặng kế tiếp
        </span>
      </div>

      {/* Styles tối ưu font chữ tiếng Việt và giao diện popup cho Leaflet */}
      <style dangerouslySetInnerHTML={{ __html: `
        .leaflet-container {
          font-family: inherit !important;
        }
        .leaflet-popup-content-wrapper {
          font-family: inherit !important;
          border-radius: 18px !important;
          padding: 4px 6px !important;
          box-shadow: 0 16px 32px -6px rgba(0, 0, 0, 0.15), 0 8px 16px -6px rgba(0, 0, 0, 0.08) !important;
          border: 1px solid rgba(0, 0, 0, 0.08) !important;
          background: rgba(255, 255, 255, 0.98) !important;
          backdrop-filter: blur(12px) !important;
        }
        .dark .leaflet-popup-content-wrapper {
          background: rgba(24, 24, 27, 0.96) !important;
          color: #f4f4f5 !important;
          border: 1px solid rgba(255, 255, 255, 0.14) !important;
        }
        .leaflet-popup-content {
          font-family: inherit !important;
          margin: 12px 30px 12px 14px !important;
          line-height: 1.45 !important;
          min-width: 190px !important;
          max-width: 280px !important;
        }
        .dark .popup-title {
          color: #f8fafc !important;
        }
        .dark .popup-loc {
          color: #94a3b8 !important;
        }
        .dark .popup-sub {
          color: #64748b !important;
        }
        .leaflet-popup-tip {
          background: rgba(255, 255, 255, 0.98) !important;
        }
        .dark .leaflet-popup-tip {
          background: rgba(24, 24, 27, 0.96) !important;
        }
        .leaflet-container a.leaflet-popup-close-button {
          top: 10px !important;
          right: 10px !important;
          width: 22px !important;
          height: 22px !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          border-radius: 50% !important;
          color: #94a3b8 !important;
          font-size: 16px !important;
          font-weight: 700 !important;
          text-decoration: none !important;
          line-height: 1 !important;
          padding: 0 !important;
          transition: all 0.15s ease !important;
        }
        .leaflet-container a.leaflet-popup-close-button:hover {
          background: rgba(0, 0, 0, 0.08) !important;
          color: #0f172a !important;
        }
        .dark .leaflet-container a.leaflet-popup-close-button:hover {
          background: rgba(255, 255, 255, 0.15) !important;
          color: #ffffff !important;
        }
      ` }} />
    </div>
  );
}
