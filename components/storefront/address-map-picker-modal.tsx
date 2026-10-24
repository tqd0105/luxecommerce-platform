"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import dynamic from "next/dynamic";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  calculateShippingFee,
  reverseGeocode,
  getCoordinatesFromCity,
  searchAddressSuggestions,
  AddressSuggestion,
  Coordinates,
  WAREHOUSE_LOCATION,
} from "@/lib/services/shipping.service";
import {
  MapPin,
  Navigation,
  Search,
  CheckCircle2,
  Truck,
  Sparkles,
  X,
} from "lucide-react";
import { IconLoader2 } from "@tabler/icons-react";
import { toast } from "sonner";

// Dynamic import Leaflet component để tuyệt đối không bị lỗi SSR "window is not defined"
const AddressMapView = dynamic(() => import("./address-map-view"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full min-h-[260px] bg-muted/30 animate-pulse flex flex-col items-center justify-center gap-3">
      <IconLoader2 className="w-8 h-8 animate-spin text-primary" />
      <span className="text-xs text-muted-foreground font-medium">
        Đang tải bản đồ tương tác...
      </span>
    </div>
  ),
});

export interface AddressMapPickerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialCoords?: Coordinates | null;
  initialStreet?: string;
  initialCity?: string;
  subtotal?: number;
  onConfirm: (result: {
    lat: number;
    lng: number;
    street: string;
    city: string;
    formattedAddress: string;
  }) => void;
}

export function AddressMapPickerModal({
  open,
  onOpenChange,
  initialCoords,
  initialStreet = "",
  initialCity = "",
  subtotal = 0,
  onConfirm,
}: AddressMapPickerModalProps) {
  // Xác định tọa độ xuất phát
  const defaultStartingCoords = useCallback((): Coordinates => {
    if (initialCoords && typeof initialCoords.lat === "number" && typeof initialCoords.lng === "number") {
      return initialCoords;
    }
    if (initialCity) {
      const cityCoords = getCoordinatesFromCity(initialCity);
      if (cityCoords) return cityCoords;
    }
    return WAREHOUSE_LOCATION;
  }, [initialCoords, initialCity]);

  const [currentCoords, setCurrentCoords] = useState<Coordinates>(defaultStartingCoords);
  const [searchQuery, setSearchQuery] = useState("");
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [isReverseGeocoding, setIsReverseGeocoding] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const [resolvedAddress, setResolvedAddress] = useState<{
    street: string;
    city: string;
    formattedAddress: string;
  }>({
    street: initialStreet,
    city: initialCity,
    formattedAddress: [initialStreet, initialCity].filter(Boolean).join(", "),
  });

  const searchDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const reverseDebounceRef = useRef<NodeJS.Timeout | null>(null);

  // Hàm chuyển đổi tọa độ GPS sang tên đường & địa chỉ
  const handleReverseLookup = useCallback(async (coords: Coordinates) => {
    setIsReverseGeocoding(true);
    try {
      const res = await reverseGeocode(coords);
      if (res && res.city) {
        setResolvedAddress({
          street: res.street,
          city: res.city,
          formattedAddress: res.formattedAddress,
        });
      } else {
        setResolvedAddress(prev => ({
          ...prev,
          formattedAddress: `Tọa độ GPS (${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)})`,
        }));
      }
    } catch {
      // Giữ nguyên địa chỉ trước đó nếu gặp lỗi
    } finally {
      setIsReverseGeocoding(false);
    }
  }, []);

  // Cập nhật khi mở Modal
  useEffect(() => {
    if (open) {
      const start = defaultStartingCoords();
      setCurrentCoords(start);
      setSearchQuery("");
      setSuggestions([]);
      setShowSuggestions(false);
      handleReverseLookup(start);
    }
  }, [open, defaultStartingCoords, handleReverseLookup]);

  // Khi người dùng kéo thả hoặc nhấp vào bản đồ
  const handleCoordsChange = useCallback(
    (newCoords: Coordinates) => {
      setCurrentCoords(newCoords);
      if (reverseDebounceRef.current) {
        clearTimeout(reverseDebounceRef.current);
      }
      reverseDebounceRef.current = setTimeout(() => {
        handleReverseLookup(newCoords);
      }, 350);
    },
    [handleReverseLookup]
  );

  // Tìm kiếm địa chỉ với gợi ý tự động (Autocomplete)
  const handleSearchChange = (val: string) => {
    setSearchQuery(val);
    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }

    if (!val.trim() || val.trim().length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    searchDebounceRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const results = await searchAddressSuggestions(val);
        setSuggestions(results);
        setShowSuggestions(results.length > 0);
      } catch (err) {
        console.error("Lỗi khi tìm kiếm địa chỉ:", err);
      } finally {
        setIsSearching(false);
      }
    }, 300);
  };

  const handleSelectSuggestion = (item: AddressSuggestion) => {
    const newCoords = { lat: item.lat, lng: item.lng };
    setCurrentCoords(newCoords);
    setSearchQuery(item.displayName);
    setShowSuggestions(false);
    setResolvedAddress({
      street: item.street,
      city: item.city,
      formattedAddress: item.displayName,
    });
  };

  // Định vị thiết bị qua Browser GPS
  const handleLocateMe = () => {
    if (!navigator.geolocation) {
      toast.error("Trình duyệt không hỗ trợ định vị GPS.");
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const gpsCoords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setCurrentCoords(gpsCoords);
        handleReverseLookup(gpsCoords);
        setIsLocating(false);
        toast.success("Đã tìm thấy vị trí GPS hiện tại của bạn!");
      },
      (err) => {
        console.warn("GPS error:", err);
        setIsLocating(false);
        toast.error("Không thể lấy vị trí. Vui lòng cấp quyền truy cập vị trí trên trình duyệt.");
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // Nhanh chóng chuyển góc nhìn đến các thành phố lớn
  const handleQuickJumpCity = (cityName: string) => {
    const coords = getCoordinatesFromCity(cityName);
    if (coords) {
      setCurrentCoords(coords);
      handleReverseLookup(coords);
    }
  };

  // Tính phí ship trực tiếp theo vị trí đang ghim
  const shippingPreview = calculateShippingFee(subtotal, currentCoords);

  // Xác nhận vị trí đã ghim
  const handleConfirmLocation = () => {
    const finalStreet = resolvedAddress.street.trim() || initialStreet.trim() || "Vị trí đã chọn trên bản đồ";
    const finalCity = resolvedAddress.city.trim() || initialCity.trim() || "Việt Nam";

    onConfirm({
      lat: currentCoords.lat,
      lng: currentCoords.lng,
      street: finalStreet,
      city: finalCity,
      formattedAddress: resolvedAddress.formattedAddress,
    });

    toast.success("Đã chốt vị trí nhận hàng thành công!", {
      description: `Khoảng cách: ~${shippingPreview.distanceKm} km. Phí ship: ${
        shippingPreview.isFreeShipping ? "Miễn phí (Freeship)" : `${shippingPreview.shippingFee.toLocaleString("vi-VN")}₫`
      }.`,
    });

    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="max-w-[96vw] sm:max-w-[760px] w-full h-[88vh] max-h-[680px] min-h-[480px] p-0 rounded-[24px] overflow-hidden border border-border/70 bg-background flex flex-col shadow-2xl duration-200"
      >
        {/* Header gọn gàng & Nút đóng trang nhã */}
        <DialogHeader className="shrink-0 px-4 py-3 sm:px-6 sm:py-3.5 border-b border-border/40 bg-muted/20 flex flex-row items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <MapPin className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
            </div>
            <div className="min-w-0">
              <DialogTitle className="text-sm sm:text-base font-bold tracking-tight text-foreground truncate">
                Chọn Vị Trí Giao Hàng Trên Bản Đồ
              </DialogTitle>
              <p className="text-[11px] sm:text-xs text-muted-foreground truncate mt-0.5">
                Chạm hoặc kéo ghim đến số nhà/ngõ của bạn để định vị chuẩn xác 100%.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="w-8 h-8 rounded-full bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer shrink-0 ml-2"
            title="Đóng bản đồ"
          >
            <X className="w-4 h-4" />
            <span className="sr-only">Đóng</span>
          </button>
        </DialogHeader>

        {/* Thanh tìm kiếm & Quick Jump Chips (Cố định phía trên) */}
        <div className="shrink-0 px-4 pt-3 pb-2 sm:px-5 space-y-2 bg-background border-b border-border/30 relative z-30">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Input
                placeholder="Tìm nhanh đường, phố, tòa nhà hoặc địa danh..."
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                className="h-9.5 rounded-xl bg-background/80 border-border/70 pr-9 text-xs sm:text-sm pl-9"
              />
              <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
              {isSearching && (
                <IconLoader2 className="w-4 h-4 text-primary animate-spin absolute right-3 top-1/2 -translate-y-1/2" />
              )}

              {/* Danh sách gợi ý tìm kiếm */}
              {showSuggestions && suggestions.length > 0 && (
                <div className="absolute left-0 right-0 top-full mt-1.5 bg-popover/95 backdrop-blur-xl border border-border/70 rounded-2xl shadow-2xl max-h-[220px] overflow-y-auto divide-y divide-border/40 z-50">
                  {suggestions.map((item, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleSelectSuggestion(item)}
                      className="w-full text-left px-3.5 py-2 hover:bg-primary/10 transition-colors flex items-start gap-2.5 text-xs group cursor-pointer"
                    >
                      <MapPin className="w-4 h-4 text-primary shrink-0 mt-0.5 group-hover:scale-110 transition-transform" />
                      <div className="truncate">
                        <strong className="text-foreground block truncate">{item.street}</strong>
                        <span className="text-[11px] text-muted-foreground block truncate">
                          {item.displayName}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleLocateMe}
              disabled={isLocating}
              className="h-9.5 rounded-xl shrink-0 font-semibold text-xs border-border/70 bg-background hover:bg-muted"
            >
              {isLocating ? (
                <>
                  <IconLoader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  Đang tìm...
                </>
              ) : (
                <>
                  <Navigation className="w-3.5 h-3.5 mr-1.5 text-primary" />
                  Vị trí của tôi
                </>
              )}
            </Button>
          </div>

          {/* Quick Jump Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto text-[11px] pb-0.5 scrollbar-none">
            <span className="text-muted-foreground shrink-0 font-medium mr-1 text-[11px]">Chuyển nhanh:</span>
            {["Hà Nội", "TP. Hồ Chí Minh", "Đà Nẵng", "Cần Thơ", "Hải Phòng"].map((city) => (
              <button
                key={city}
                type="button"
                onClick={() => handleQuickJumpCity(city)}
                className="px-2.5 py-0.5 rounded-full bg-muted/60 hover:bg-primary/10 hover:text-primary transition-colors border border-border/50 shrink-0 font-medium text-[11px] cursor-pointer"
              >
                {city}
              </button>
            ))}
          </div>
        </div>

        {/* Khung bản đồ Leaflet (Co giãn linh hoạt chiếm trọn diện tích còn lại, không tràn) */}
        <div className="flex-1 w-full min-h-[220px] relative overflow-hidden bg-muted/20">
          <AddressMapView
            coords={currentCoords}
            onCoordsChange={handleCoordsChange}
            zoom={15}
          />

          {/* Floating hint chip */}
          <div className="absolute top-3 left-3 z-10 pointer-events-none bg-background/90 backdrop-blur-md border border-border/60 rounded-xl px-2.5 py-1.5 shadow-sm text-[11px] text-foreground flex items-center gap-1.5 font-medium">
            <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            <span>Kéo ghim xanh để điều chỉnh số nhà/ngõ</span>
          </div>
        </div>

        {/* Khung chân trang hiển thị kết quả & nút bấm (Cố định dưới cùng) */}
        <div className="shrink-0 p-3 sm:px-5 sm:py-3.5 border-t border-border/50 bg-muted/30 backdrop-blur-md flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="space-y-0.5 min-w-0 flex-1">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <MapPin className="w-3.5 h-3.5 text-primary shrink-0" />
              <span className="font-semibold text-foreground">Vị trí đã chọn:</span>
              {isReverseGeocoding && (
                <span className="text-[11px] text-primary flex items-center gap-1">
                  <IconLoader2 className="w-3 h-3 animate-spin" /> Đang nhận diện địa chỉ...
                </span>
              )}
            </div>
            <p className="text-xs sm:text-sm font-bold text-foreground truncate">
              {resolvedAddress.street ? (
                <>
                  {resolvedAddress.street}
                  {resolvedAddress.city ? `, ${resolvedAddress.city}` : ""}
                </>
              ) : (
                resolvedAddress.formattedAddress || "Chưa xác định tên đường"
              )}
            </p>
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[11px] text-muted-foreground pt-0.5">
              <span className="whitespace-nowrap">
                Khoảng cách: <strong className="text-foreground">~{shippingPreview.distanceKm} km</strong>
              </span>
              <span>•</span>
              <span className="whitespace-nowrap">
                Phí ship:{" "}
                <strong className={shippingPreview.isFreeShipping ? "text-emerald-500 font-extrabold" : "text-foreground"}>
                  {shippingPreview.isFreeShipping ? "Miễn phí (Freeship)" : `${shippingPreview.shippingFee.toLocaleString("vi-VN")}₫`}
                </strong>
              </span>
              <span>•</span>
              <span className="whitespace-nowrap">
                Giao dự kiến: <strong className="text-foreground">{shippingPreview.estimatedDeliveryText}</strong>
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="rounded-xl h-9.5 px-4 text-xs font-semibold flex-1 sm:flex-initial whitespace-nowrap"
            >
              Đóng
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleConfirmLocation}
              className="rounded-xl h-9.5 px-5 text-xs font-bold bg-primary text-primary-foreground shadow-md shadow-primary/20 hover:scale-[1.02] transition-transform flex-1 sm:flex-initial whitespace-nowrap"
            >
              <CheckCircle2 className="w-4 h-4 mr-1.5 text-emerald-400" />
              Xác nhận vị trí này
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
