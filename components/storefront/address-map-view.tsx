"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { WAREHOUSE_LOCATION } from "@/lib/services/shipping.service";

interface AddressMapViewProps {
  coords: { lat: number; lng: number };
  onCoordsChange: (coords: { lat: number; lng: number }) => void;
  zoom?: number;
}

export default function AddressMapView({
  coords,
  onCoordsChange,
  zoom = 15,
}: AddressMapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const customerMarkerRef = useRef<L.Marker | null>(null);
  const polylineRef = useRef<L.Polyline | null>(null);
  const coordsRef = useRef(coords);
  const onCoordsChangeRef = useRef(onCoordsChange);

  useEffect(() => {
    coordsRef.current = coords;
    onCoordsChangeRef.current = onCoordsChange;
  }, [coords, onCoordsChange]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    // 1. Khởi tạo bản đồ Leaflet
    const map = L.map(containerRef.current, {
      center: [coords.lat, coords.lng],
      zoom: zoom,
      zoomControl: false,
    });
    mapRef.current = map;

    // Đặt nút zoom ở góc dưới phải gọn gàng
    L.control.zoom({ position: "bottomright" }).addTo(map);

    // 2. Thêm lớp Tile Layer (Ưu tiên Goong Maps Tiles với CDN Việt Nam nếu có Map Key)
    const goongMapKey = process.env.NEXT_PUBLIC_GOONG_MAP_KEY;
    const tileUrl = goongMapKey
      ? `https://tiles.goong.io/{z}/{x}/{y}.png?api_key=${goongMapKey}`
      : "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";

    L.tileLayer(tileUrl, {
      maxZoom: 19,
      attribution: goongMapKey
        ? '&copy; <a href="https://www.goong.io/" target="_blank" rel="noreferrer">Goong Maps</a>'
        : '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);

    // 3. Custom SVG Pin cho Vị trí khách hàng:
    // Chiều rộng 36px, chiều cao 48px. Mũi nhọn tiếp đất chính xác tại pixel (18, 46).
    // iconAnchor: [18, 46] đảm bảo mũi nhọn ghim trùng khớp 100% với điểm kết thúc của đường Polyline!
    const customerIcon = L.divIcon({
      className: "custom-customer-pin-wrapper",
      html: `
        <div style="width: 36px; height: 48px; cursor: grab; user-select: none;">
          <svg xmlns="http://www.w3.org/2000/svg" width="36" height="48" viewBox="0 0 36 48" fill="none">
            <ellipse cx="18" cy="46" rx="7" ry="2.2" fill="rgba(0,0,0,0.35)" filter="blur(1px)"/>
            <path d="M18 0C8.05887 0 0 8.05887 0 18C0 30.5 18 46 18 46C18 46 36 30.5 36 18C36 8.05887 27.9411 0 18 0Z" fill="#10B981"/>
            <path d="M18 1C8.61116 1 1 8.61116 1 18C1 29.8 18 44.5 18 44.5C18 44.5 35 29.8 35 18C35 8.61116 27.3888 1 18 1Z" stroke="#FFFFFF" stroke-width="2.2"/>
            <circle cx="18" cy="18" r="7.5" fill="#FFFFFF"/>
            <circle cx="18" cy="18" r="4.2" fill="#10B981"/>
          </svg>
        </div>
      `,
      iconSize: [36, 48],
      iconAnchor: [18, 46],
    });

    // 4. Custom SVG Pin cho Kho Tổng LuxeCommerce:
    const warehouseIcon = L.divIcon({
      className: "custom-warehouse-pin-wrapper",
      html: `
        <div style="width: 36px; height: 48px; cursor: pointer; user-select: none;">
          <svg xmlns="http://www.w3.org/2000/svg" width="36" height="48" viewBox="0 0 36 48" fill="none">
            <ellipse cx="18" cy="46" rx="7" ry="2.2" fill="rgba(0,0,0,0.35)" filter="blur(1px)"/>
            <path d="M18 0C8.05887 0 0 8.05887 0 18C0 30.5 18 46 18 46C18 46 36 30.5 36 18C36 8.05887 27.9411 0 18 0Z" fill="#F59E0B"/>
            <path d="M18 1C8.61116 1 1 8.61116 1 18C1 29.8 18 44.5 18 44.5C18 44.5 35 29.8 35 18C35 8.61116 27.3888 1 18 1Z" stroke="#FFFFFF" stroke-width="2.2"/>
            <circle cx="18" cy="18" r="8" fill="#FFFFFF"/>
            <path d="M13 21V16.5L18 12.5L23 16.5V21H13Z" fill="#D97706"/>
          </svg>
        </div>
      `,
      iconSize: [36, 48],
      iconAnchor: [18, 46],
    });

    // Thêm Marker Kho Tổng
    const warehouseMarker = L.marker([WAREHOUSE_LOCATION.lat, WAREHOUSE_LOCATION.lng], {
      icon: warehouseIcon,
    }).addTo(map);
    warehouseMarker.bindPopup(
      `<div style="font-family: sans-serif; font-size: 12px; padding: 2px;">
        <strong style="color: #d97706; display: block; margin-bottom: 2px;">${WAREHOUSE_LOCATION.name}</strong>
        <span style="color: #64748b;">${WAREHOUSE_LOCATION.address}</span>
      </div>`
    );

    // Thêm Marker Khách Hàng (Kéo thả được)
    const customerMarker = L.marker([coords.lat, coords.lng], {
      draggable: true,
      icon: customerIcon,
    }).addTo(map);
    customerMarkerRef.current = customerMarker;

    // Đường nét đứt nối Kho Tổng và Vị trí giao hàng
    const polyline = L.polyline(
      [
        [WAREHOUSE_LOCATION.lat, WAREHOUSE_LOCATION.lng],
        [coords.lat, coords.lng],
      ],
      {
        color: "#10b981",
        weight: 3,
        dashArray: "6, 8",
        opacity: 0.85,
      }
    ).addTo(map);
    polylineRef.current = polyline;

    // Cập nhật đường nối trực tiếp trong khi kéo thả
    customerMarker.on("drag", (e) => {
      const target = e.target as L.Marker;
      const pos = target.getLatLng();
      polyline.setLatLngs([
        [WAREHOUSE_LOCATION.lat, WAREHOUSE_LOCATION.lng],
        [pos.lat, pos.lng],
      ]);
    });

    // Chốt vị trí khi thả chuột
    customerMarker.on("dragend", (e) => {
      const target = e.target as L.Marker;
      const pos = target.getLatLng();
      onCoordsChangeRef.current({ lat: pos.lat, lng: pos.lng });
      polyline.setLatLngs([
        [WAREHOUSE_LOCATION.lat, WAREHOUSE_LOCATION.lng],
        [pos.lat, pos.lng],
      ]);
    });

    // Sự kiện nhấp trực tiếp vào bản đồ để di chuyển Marker
    map.on("click", (e: L.LeafletMouseEvent) => {
      const { lat, lng } = e.latlng;
      customerMarker.setLatLng([lat, lng]);
      polyline.setLatLngs([
        [WAREHOUSE_LOCATION.lat, WAREHOUSE_LOCATION.lng],
        [lat, lng],
      ]);
      onCoordsChangeRef.current({ lat, lng });
    });

    // Fix lỗi hiển thị tile khi mở modal dialog (chờ CSS animation hoàn thành)
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 150);

    const handleResize = () => {
      map.invalidateSize();
    };
    window.addEventListener("resize", handleResize);

    return () => {
      clearTimeout(timer);
      window.removeEventListener("resize", handleResize);
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run on mount

  // Khi tọa độ từ bên ngoài truyền vào thay đổi (do search hoặc bấm GPS)
  useEffect(() => {
    if (!mapRef.current || !customerMarkerRef.current || !polylineRef.current) return;

    const currentPos = customerMarkerRef.current.getLatLng();
    const isDifferent =
      Math.abs(currentPos.lat - coords.lat) > 0.00001 ||
      Math.abs(currentPos.lng - coords.lng) > 0.00001;

    if (isDifferent) {
      customerMarkerRef.current.setLatLng([coords.lat, coords.lng]);
      polylineRef.current.setLatLngs([
        [WAREHOUSE_LOCATION.lat, WAREHOUSE_LOCATION.lng],
        [coords.lat, coords.lng],
      ]);
      mapRef.current.flyTo([coords.lat, coords.lng], mapRef.current.getZoom() || 15, {
        duration: 0.8,
      });
    }
  }, [coords.lat, coords.lng]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full relative z-0"
      style={{ cursor: "crosshair" }}
    />
  );
}
