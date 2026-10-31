"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { getCart } from "@/lib/services/cart.service";
import { placeOrder } from "@/lib/services/checkout.service";
import { getAddresses } from "@/lib/services/address.service";
import { supabase } from "@/lib/supabase/client";
import { validateCoupon, Coupon } from "@/lib/services/coupon.service";
import {
  calculateShippingFee,
  reverseGeocode,
  forwardGeocode,
  forwardGeocodeDetailed,
  getGoogleMapsUrl,
  getCoordinatesFromCity,
  Coordinates,
  BranchOption
} from "@/lib/services/shipping.service";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/components/providers/auth-provider";
import { IconLoader2 } from "@tabler/icons-react";
import {
  Navigation,
  Truck,
  MapPin,
  CheckCircle2,
  ShieldCheck,
  AlertCircle,
  ExternalLink,
  Building2,
  Info,
  AlertTriangle,
  ChevronRight,
  Lock,
  Bookmark,
  Banknote,
  QrCode,
  Sparkles,
  RotateCcw
} from "lucide-react";
import { toast } from "sonner";
import { LuxeLoading } from "@/components/storefront/luxe-loading";
import { CouponSelector } from "@/components/storefront/coupon-selector";
import { AddressMapPickerModal } from "@/components/storefront/address-map-picker-modal";
import { BranchSelectorModal } from "@/components/storefront/branch-selector-modal";
import { getLoyaltyProfile, LoyaltyProfile, TIER_CONFIGS } from "@/lib/services/loyalty.service";
import Link from "next/link";

const PHONE_REGEX = /^(0|84)(3|5|7|8|9)[0-9]{8}$/;

export default function CheckoutPage() {
  const router = useRouter();
  const { user, role, loading: authLoading } = useAuth();

  const [cartItems, setCartItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const [couponCodeInput, setCouponCodeInput] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<Coupon | null>(null);
  const [couponError, setCouponError] = useState("");

  const [formData, setFormData] = useState({
    fullName: "",
    phone: "",
    street: "",
    city: "",
    paymentMethod: "cod"
  });

  const [savedAddresses, setSavedAddresses] = useState<any[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string>("");
  const [saveNewAddress, setSaveNewAddress] = useState<boolean>(true);
  const [createdOrder, setCreatedOrder] = useState<any>(null);

  // Loyalty Coins State
  const [loyaltyProfile, setLoyaltyProfile] = useState<LoyaltyProfile | null>(null);
  const [useCoins, setUseCoins] = useState<boolean>(false);

  // Vị trí GPS và Phí vận chuyển
  const [customerCoords, setCustomerCoords] = useState<Coordinates | null>(null);
  const [verifiedAddress, setVerifiedAddress] = useState<string>("");
  const submittingRef = useRef<boolean>(false);
  const [isLocating, setIsLocating] = useState(false);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [isMapPickerOpen, setIsMapPickerOpen] = useState(false);
  const [availableBranches, setAvailableBranches] = useState<BranchOption[]>([]);
  const [multiBranchPlaceName, setMultiBranchPlaceName] = useState<string>("");
  const [isBranchModalOpen, setIsBranchModalOpen] = useState(false);
  const [addressNotFound, setAddressNotFound] = useState(false);

  const loadAddresses = useCallback(async () => {
    const { data } = await getAddresses();
    if (data && data.length > 0) {
      setSavedAddresses(data);
      const defaultAddr = data.find((a: any) => a.is_default) || data[0];
      if (defaultAddr) {
        setSelectedAddressId(defaultAddr.id);
        setFormData(prev => ({
          ...prev,
          fullName: defaultAddr.full_name || prev.fullName,
          phone: defaultAddr.phone || "",
          street: defaultAddr.street || "",
          city: defaultAddr.city || ""
        }));
        setVerifiedAddress(`${defaultAddr.street || ""}, ${defaultAddr.city || ""}`);
        if (defaultAddr.latitude && defaultAddr.longitude) {
          setCustomerCoords({ lat: defaultAddr.latitude, lng: defaultAddr.longitude });
        } else if (defaultAddr.street || defaultAddr.city) {
          // Tự động định vị từ địa chỉ cũ và lưu ngầm vào CSDL
          forwardGeocode(defaultAddr.street || "", defaultAddr.city || "").then(coords => {
            if (coords) {
              setCustomerCoords(coords);
              supabase.from("addresses").update({ latitude: coords.lat, longitude: coords.lng }).eq("id", defaultAddr.id).then();
            }
          });
        }
      }
    }
  }, []);

  const loadCart = useCallback(async () => {
    setLoading(true);
    const { data, error } = await getCart();
    if (!error && data) {
      setCartItems(data);
    }
    setLoading(false);
  }, []);

  const loadLoyalty = useCallback(async () => {
    const { data } = await getLoyaltyProfile();
    if (data) {
      setLoyaltyProfile(data);
    }
  }, []);

  useEffect(() => {
    if (!authLoading) {
      if (user) {
        setTimeout(() => {
          setFormData(prev => ({ ...prev, fullName: user.user_metadata?.full_name || "" }));
        }, 0);
        loadCart();
        loadAddresses();
        loadLoyalty();
      } else {
        router.push("/login");
      }
    }
  }, [user, authLoading, router, loadCart, loadAddresses, loadLoyalty]);

  useEffect(() => {
    window.addEventListener("cart-updated", loadCart);
    return () => {
      window.removeEventListener("cart-updated", loadCart);
    };
  }, [loadCart]);

  const subtotal = useMemo(() => {
    return cartItems.reduce((total, item) => {
      const basePrice = Number(item.products?.price || 0);
      const discount = Number(item.products?.discount_percent || 0);
      const modifier = Number(item.product_variants?.price_modifier || 0);
      const discountedBase = basePrice - (basePrice * discount / 100);
      return total + ((discountedBase + modifier) * item.quantity);
    }, 0);
  }, [cartItems]);

  const getSubtotal = useCallback(() => subtotal, [subtotal]);

  // Kiểm tra tồn kho giỏ hàng
  const isOutOfStock = useMemo(() => {
    return cartItems.some(item => {
      const stock = item.product_variants?.stock_quantity ?? item.products?.stock_quantity;
      return typeof stock === "number" && item.quantity > stock;
    });
  }, [cartItems]);

  // Tính phí ship động theo giỏ hàng & tọa độ GPS
  const shippingInfo = useMemo(() => {
    return calculateShippingFee(subtotal, customerCoords);
  }, [subtotal, customerCoords]);

  // Tính mức giảm giá từ Xu LuxeCommerce (1 Xu = 1 VNĐ, tối đa 50% tiền hàng)
  const coinDiscount = useMemo(() => {
    if (!useCoins || !loyaltyProfile || loyaltyProfile.coinsBalance <= 0) return 0;
    const productTotal = getSubtotal();
    const afterCoupon = appliedCoupon ? productTotal - (productTotal * appliedCoupon.discount_percent / 100) : productTotal;
    const maxAllowed = Math.floor(afterCoupon * 0.5);
    return Math.min(loyaltyProfile.coinsBalance, maxAllowed);
  }, [useCoins, loyaltyProfile, getSubtotal, appliedCoupon]);

  // Phí vận chuyển sau khi áp dụng đặc quyền Hạng thành viên
  const effectiveShippingFee = useMemo(() => {
    const rawFee = shippingInfo.shippingFee;
    if (shippingInfo.isFreeShipping) return 0;
    if (loyaltyProfile?.tier === "diamond") return 0; // Freeship trọn đời cho Kim Cương
    if (loyaltyProfile?.tier === "gold") return Math.round(rawFee * 0.5); // Giảm 50% phí ship cho Vàng
    return rawFee;
  }, [shippingInfo, loyaltyProfile]);

  const calculateTotal = () => {
    let total = getSubtotal();
    if (appliedCoupon) {
      total = total - (total * appliedCoupon.discount_percent / 100);
    }
    total = Math.max(0, total - coinDiscount);
    total += effectiveShippingFee;
    return total;
  };

  // Ước tính số xu tích lũy được sau khi đơn hàng giao thành công
  const estimatedCoinsEarned = useMemo(() => {
    const rate = loyaltyProfile?.tierConfig?.rewardRate || 0.01;
    const productTotal = getSubtotal();
    const afterCoupon = appliedCoupon ? productTotal - (productTotal * appliedCoupon.discount_percent / 100) : productTotal;
    return Math.floor(Math.max(0, afterCoupon - coinDiscount) * rate);
  }, [loyaltyProfile, getSubtotal, appliedCoupon, coinDiscount]);

  const handleApplyCoupon = async (codeOverride?: string) => {
    const code = (codeOverride || couponCodeInput).trim();
    if (!code) return;
    setCouponError("");
    const { data, error } = await validateCoupon(code, getSubtotal());
    if (error || !data) {
      setCouponError(error?.message || "Mã không hợp lệ");
      setAppliedCoupon(null);
    } else {
      setAppliedCoupon(data);
      setCouponCodeInput(data.code);
      setCouponError("");
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponCodeInput("");
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(val);
  };



  // Định vị vị trí hiện tại bằng GPS của trình duyệt
  const handleGetGPSLocation = () => {
    if (typeof window === "undefined" || !navigator.geolocation) {
      toast.error("Trình duyệt không hỗ trợ định vị GPS.");
      return;
    }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setCustomerCoords(coords);
        toast.success("Đã xác định vị trí GPS!");

        // Tự động chuyển đổi tọa độ GPS sang tên đường, quận, thành phố
        const geo = await reverseGeocode(coords);
        if (geo) {
          const newStreet = geo.street || formData.street;
          const newCity = geo.city || formData.city;
          setFormData((prev) => ({
            ...prev,
            street: newStreet,
            city: newCity,
          }));
          setSelectedAddressId("");
          setVerifiedAddress(`${newStreet}, ${newCity}`);
        } else {
          setVerifiedAddress("GPS");
        }
        setIsLocating(false);
      },
      (err) => {
        console.warn("GPS error:", err);
        setIsLocating(false);
        toast.error("Không thể lấy vị trí. Vui lòng cho phép quyền truy cập GPS trên trình duyệt.");
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // Chọn cơ sở cụ thể khi địa điểm có nhiều cơ sở (ví dụ trường ĐH có nhiều cơ sở)
  const handleSelectBranch = (branch: BranchOption) => {
    const streetWithBranch =
      branch.branchName && !branch.street.toLowerCase().includes(branch.branchName.toLowerCase())
        ? `${branch.branchName} - ${branch.street}`
        : branch.street;
    const cityToSet = branch.city || formData.city || "TP. Hồ Chí Minh";

    setFormData((prev) => ({
      ...prev,
      street: streetWithBranch,
      city: cityToSet,
    }));

    setCustomerCoords(branch.coords);
    setVerifiedAddress(`${streetWithBranch}, ${cityToSet}`);
    setSelectedAddressId("");
    setAddressNotFound(false);
    setIsBranchModalOpen(false);

    const tempShipping = calculateShippingFee(subtotal, branch.coords);
    toast.success(`Đã xác nhận vị trí: ${branch.branchName}!`, {
      description: `Tọa độ GPS chuẩn (~${tempShipping.distanceKm} km). Cước vận chuyển: ${tempShipping.isFreeShipping ? "Miễn phí (Freeship)" : formatCurrency(tempShipping.shippingFee)}.`
    });
  };

  // Áp dụng cước phí theo khu vực Tỉnh/Thành khi địa chỉ ngõ/hẻm cụ thể chưa có trên bản đồ số
  const handleUseCityFallback = () => {
    const fallbackCoords = getCoordinatesFromCity(formData.city);
    if (!fallbackCoords) {
      toast.warning(`Chưa tìm thấy tọa độ trung tâm cho "${formData.city}". Quý khách hãy bấm [Chọn trên bản đồ].`);
      setIsMapPickerOpen(true);
      return;
    }
    setCustomerCoords(fallbackCoords);
    setVerifiedAddress(`${formData.street}, ${formData.city}`);
    setAddressNotFound(false);
    const tempShipping = calculateShippingFee(getSubtotal(), fallbackCoords);
    toast.info(`Đã áp dụng định vị khu vực ${formData.city}`, {
      description: `Cước phí vận chuyển tính theo cự ly khu vực (~${tempShipping.distanceKm} km). Shipper sẽ điều hướng qua Google Maps đến đúng chính xác địa chỉ "${formData.street}".`
    });
  };

  // Xác thực địa chỉ thủ công khi khách tự nhập hoặc thay đổi
  const handleVerifyAddress = async () => {
    const street = formData.street.trim();
    const city = formData.city.trim();

    if (!city || !street) {
      toast.warning("Thông tin địa chỉ chưa đầy đủ!", {
        description: "Vui lòng nhập cả Tỉnh/Thành phố và Địa chỉ cụ thể trước khi kiểm tra."
      });
      return;
    }

    setIsGeocoding(true);
    setAddressNotFound(false);
    try {
      const result = await forwardGeocodeDetailed(street, city);
      const coords = result.coords;

      // Xử lý khi địa điểm có NHIỀU CƠ SỞ (Ví dụ: Trường Đại học GTVT TP.HCM, ĐH Bách Khoa...)
      if (result.hasMultipleBranches && result.branches && result.branches.length > 1) {
        setAvailableBranches(result.branches);
        setMultiBranchPlaceName(result.matchedName || street);
        setIsBranchModalOpen(true);
        toast.info(`Phát hiện ${result.branches.length} cơ sở tại ${city}`, {
          description: "Vui lòng chọn cơ sở chính xác bạn muốn nhận hàng để chốt cước."
        });
        return;
      }

      if (coords && typeof coords.lat === "number" && typeof coords.lng === "number") {
        setAddressNotFound(false);
        // Cập nhật danh sách cơ sở nếu có
        if (result.branches && result.branches.length > 0) {
          setAvailableBranches(result.branches);
          setMultiBranchPlaceName(result.matchedName || street);
        } else {
          setAvailableBranches([]);
        }

        setCustomerCoords(coords);
        setVerifiedAddress(`${street}, ${city}`);
        const tempShipping = calculateShippingFee(subtotal, coords);
        toast.success(result.matchedName ? `Đã xác thực: ${result.matchedName}` : "Xác thực địa chỉ thành công!", {
          description: `Tọa độ GPS chuẩn (~${tempShipping.distanceKm} km từ kho). Cước vận chuyển: ${tempShipping.isFreeShipping ? "Miễn phí (Freeship)" : formatCurrency(tempShipping.shippingFee)}.`
        });
      } else if (result.error === "RATE_LIMITED") {
        setCustomerCoords(null);
        setVerifiedAddress("");
        setAddressNotFound(true);
        toast.warning("Hệ thống bản đồ đang bận", {
          description: result.message || "OpenStreetMap tạm thời bận lượt truy vấn (429). Quý khách hãy bấm 'Chọn trên bản đồ' để ghim vị trí ngay lập tức.",
          action: {
            label: "Mở bản đồ",
            onClick: () => setIsMapPickerOpen(true),
          },
        });
      } else {
        setCustomerCoords(null);
        setVerifiedAddress("");
        setAddressNotFound(true);
        toast.error("Chưa tìm thấy vị trí tự động trên bản đồ!", {
          description: result.message || `Hệ thống chưa tìm thấy địa chỉ "${street}" tại "${city}". Quý khách có thể tự ghim trên bản đồ, lấy GPS hoặc áp dụng cước theo khu vực bên dưới.`,
          action: {
            label: "Mở bản đồ",
            onClick: () => setIsMapPickerOpen(true),
          },
        });
      }
    } catch (err) {
      console.error("Lỗi khi kiểm tra địa chỉ:", err);
      toast.error("Lỗi kết nối khi xác thực địa chỉ. Vui lòng thử lại!");
    } finally {
      setIsGeocoding(false);
    }
  };

  const isPhoneValid = useMemo(() => {
    const clean = formData.phone.replace(/[\s.-]/g, "");
    return PHONE_REGEX.test(clean);
  }, [formData.phone]);

  const isAddressVerified = useMemo(() => {
    if (!customerCoords || typeof customerCoords.lat !== "number" || typeof customerCoords.lng !== "number") return false;
    if (selectedAddressId) return true;
    if (!formData.street.trim() || !formData.city.trim()) return false;
    if (verifiedAddress === "GPS") return true;

    const currentNorm = `${formData.street.toLowerCase().trim()}, ${formData.city.toLowerCase().trim()}`;
    const verifiedNorm = verifiedAddress.toLowerCase().trim();

    return (
      verifiedNorm === currentNorm ||
      verifiedNorm.includes(formData.street.toLowerCase().trim()) ||
      formData.street.toLowerCase().trim().includes(verifiedNorm)
    );
  }, [customerCoords, selectedAddressId, verifiedAddress, formData.street, formData.city]);

  const formValidationReason = useMemo(() => {
    if (cartItems.length === 0) return "Giỏ hàng đang trống";
    if (isOutOfStock) return "Có sản phẩm trong giỏ hàng vượt quá số lượng tồn kho";
    if (!formData.fullName.trim() || formData.fullName.trim().length < 2) return "Vui lòng nhập Họ và Tên người nhận (tối thiểu 2 ký tự)";
    if (!formData.phone.trim()) return "Vui lòng nhập Số điện thoại nhận hàng";
    if (!isPhoneValid) return "Số điện thoại không đúng định dạng 10 số (VD: 098..., 039...)";
    if (!formData.city.trim() || !formData.street.trim()) return "Vui lòng nhập đầy đủ Tỉnh/Thành phố & Địa chỉ cụ thể";
    if (!isAddressVerified || !customerCoords) return "Vui lòng bấm [Xác nhận & Tìm vị trí] để định vị và chốt phí vận chuyển";
    return null;
  }, [cartItems.length, isOutOfStock, formData.fullName, formData.phone, isPhoneValid, formData.city, formData.street, isAddressVerified, customerCoords]);

  const canPlaceOrder = !formValidationReason && !submitting && !(role === "admin" || role === "staff");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (submitting || submittingRef.current) return;

    if (!canPlaceOrder) {
      toast.error(formValidationReason || "Thông tin đơn hàng chưa đầy đủ!", {
        description: "Vui lòng hoàn tất xác thực thông tin và vị trí giao hàng trước khi đặt hàng."
      });
      return;
    }

    if (cartItems.length === 0) {
      toast.error("Giỏ hàng của bạn đang trống!", {
        description: "Vui lòng thêm sản phẩm vào giỏ hàng trước khi đặt hàng."
      });
      return;
    }

    if (role === "admin" || role === "staff") {
      toast.error(
        role === "admin"
          ? "Quản trị viên (Admin) không được tạo đơn hàng cá nhân để bảo đảm tính trung thực về doanh thu!"
          : "Nhân viên (Staff) không thể tạo đơn hàng bằng tài khoản nội bộ. Vui lòng dùng tài khoản Khách hàng!"
      );
      return;
    }

    if (isOutOfStock) {
      toast.error("Sản phẩm trong giỏ hàng đã vượt quá tồn kho!", {
        description: "Vui lòng kiểm tra lại số lượng hoặc xóa bớt sản phẩm hết hàng."
      });
      return;
    }

    const fullName = formData.fullName.trim();
    if (!fullName || fullName.length < 2) {
      toast.error("Họ và Tên không hợp lệ!", {
        description: "Vui lòng nhập đầy đủ Họ và Tên người nhận (tối thiểu 2 ký tự)."
      });
      return;
    }

    const cleanPhone = formData.phone.replace(/[\s.-]/g, "");
    if (!PHONE_REGEX.test(cleanPhone)) {
      toast.error("Số điện thoại không hợp lệ!", {
        description: "Vui lòng nhập số điện thoại Việt Nam (10 số, bắt đầu bằng 03, 05, 07, 08, 09)."
      });
      return;
    }

    const city = formData.city.trim();
    const street = formData.street.trim();
    if (!city || !street) {
      toast.error("Địa chỉ giao hàng chưa đầy đủ!", {
        description: "Vui lòng nhập cả Tỉnh/Thành phố và Địa chỉ cụ thể."
      });
      return;
    }

    if (!isAddressVerified || !customerCoords || typeof customerCoords.lat !== "number" || typeof customerCoords.lng !== "number") {
      toast.error("Địa chỉ chưa được xác thực tọa độ!", {
        description: "Vui lòng bấm nút 'Xác nhận & Tìm vị trí' hoặc chọn 'Lấy vị trí GPS' để hệ thống tính phí vận chuyển chính xác."
      });
      return;
    }

    // Kiểm tra phạm vi tọa độ GPS hợp lệ (Việt Nam)
    if (customerCoords.lat < 8.0 || customerCoords.lat > 24.5 || customerCoords.lng < 102.0 || customerCoords.lng > 110.5) {
      toast.error("Tọa độ GPS không hợp lệ hoặc nằm ngoài phạm vi phục vụ!", {
        description: "Vui lòng xác thực lại địa chỉ giao hàng trong lãnh thổ Việt Nam."
      });
      return;
    }

    submittingRef.current = true;
    setSubmitting(true);

    try {
      const { data: order, error } = await placeOrder({
        fullName,
        phone: cleanPhone,
        street,
        city,
        paymentMethod: formData.paymentMethod,
        couponId: appliedCoupon ? appliedCoupon.id : undefined,
        selectedAddressId: selectedAddressId || undefined,
        saveToAddressBook: !selectedAddressId ? saveNewAddress : false,
        shippingFee: effectiveShippingFee,
        distanceKm: shippingInfo.distanceKm,
        latitude: customerCoords.lat,
        longitude: customerCoords.lng,
        coinsToUse: useCoins ? coinDiscount : 0,
      });

      if (error || !order) {
        submittingRef.current = false;
        setSubmitting(false);
        toast.error("Đặt hàng thất bại!", {
          description: error?.message || "Lỗi kết nối máy chủ"
        });
      } else {
        setCreatedOrder(order);
        if (formData.paymentMethod === "banking") {
          toast.info("Đang chuyển đến cổng thanh toán QR...", {
            description: "Vui lòng hoàn tất chuyển khoản trong 10 phút."
          });
          router.push(`/checkout/payment/${order.id}`);
        } else {
          toast.success("Đặt hàng thành công!");
          setSuccess(true);
          submittingRef.current = false;
          setSubmitting(false);
        }
      }
    } catch (err: any) {
      submittingRef.current = false;
      setSubmitting(false);
      toast.error("Đã xảy ra lỗi không mong muốn!", {
        description: err?.message || "Vui lòng thử lại sau."
      });
    }
  };

  if (success) {
    return (
      <div className="flex flex-col items-center justify-center py-24 space-y-6 px-4 bg-card/50 backdrop-blur-xl border border-border/50 rounded-[32px] mx-auto max-w-2xl my-10 shadow-lg relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-green-500/5 via-transparent to-transparent opacity-50 pointer-events-none" />
        <div className="mx-auto w-24 h-24 bg-green-500/10 text-green-600 rounded-[24px] flex items-center justify-center mb-2 shadow-inner">
          <Image src="/icons/success.png" alt="Success" width={60} height={60} className="object-contain drop-shadow-sm" />
        </div>
        <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-green-600 to-green-400 relative z-10">Đặt hàng thành công!</h1>
        <p className="text-muted-foreground text-base relative z-10 text-center">
          Cảm ơn bạn đã mua sắm. Đơn hàng của bạn đang được xử lý.
        </p>
        <div className=" relative z-10">
          <Button asChild size="lg" className="rounded-xl px-8 font-bold shadow-lg shadow-green-500/20 bg-green-600 hover:bg-green-700 hover:scale-105 transition-all duration-300">
            <Link href="/account/orders">Quản lý Đơn hàng </Link>
          </Button>
        </div>
      </div>
    );
  }

  if ((authLoading || loading) && !submitting) {
    return <LuxeLoading label="Đang chuẩn bị thông tin thanh toán..." />;
  }

  if (role === "admin" || role === "staff") {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-4 bg-card/50 backdrop-blur-xl border border-border/50 rounded-[32px] mx-auto max-w-2xl my-10 shadow-lg relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-red-500/5 via-transparent to-transparent opacity-50 pointer-events-none" />
        <div className="h-24 w-24 bg-red-500/10 rounded-[24px] flex items-center justify-center mb-4 shadow-inner">
          <Image src="/icons/warning2.png" alt="Warning" width={56} height={56} className="object-contain drop-shadow-sm" />
        </div>
        <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/70 relative z-10 text-center mb-3">
          Tài khoản {role === "admin" ? "Quản trị viên (Admin)" : "Nhân viên (Staff)"}
        </h2>
        <p className="text-muted-foreground text-[15px] relative z-10 text-center max-w-lg leading-relaxed mb-6">
          {role === "admin"
            ? "Tài khoản Quản trị viên (Admin) không được tạo đơn hàng và thanh toán cá nhân để bảo đảm tính trung thực cho các báo cáo doanh thu."
            : "Tài khoản Nhân viên (Staff) là tài khoản vận hành nội bộ, không thể tiến hành thanh toán."}
        </p>
        <div className="pt-2 flex flex-col sm:flex-row gap-4 w-full justify-center relative z-10">
          <Button asChild className="w-full sm:w-auto font-bold rounded-full px-8 shadow-md shadow-primary/20 h-11 transition-all hover:scale-105">
            <Link href="/dashboard">Về Dashboard Quản Trị</Link>
          </Button>
          <Button variant="outline" asChild className="w-full sm:w-auto rounded-full px-8 font-bold hover:bg-muted/50 h-11 transition-all border-border/50 hover:border-foreground/20">
            <Link href="/">Về Trang Chủ</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (cartItems.length === 0 && !submitting) {
    return (
      <div className="flex flex-col items-center justify-center py-24 space-y-6 px-4 bg-card/50 backdrop-blur-xl border border-border/50 rounded-[32px] mx-auto max-w-2xl my-10 shadow-lg relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-50 pointer-events-none" />
        <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/70 relative z-10">Giỏ hàng trống</h1>
        <Button asChild size="lg" className="rounded-xl px-8 font-bold shadow-lg shadow-primary/20 hover:scale-105 transition-transform duration-300 relative z-10">
          <Link href="/cart">Quay lại Giỏ hàng</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 sm:py-10 px-4 sm:px-6 max-w-7xl">
      {/* Progress Stepper & Page Title */}
      <div className="mb-6 sm:mb-8 space-y-4">
        {/* Stepper Navigation */}
        <nav aria-label="Tiến trình mua hàng" className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
          <Link href="/cart" className="inline-flex items-center gap-1.5 hover:text-foreground transition-colors group">
            <span className="w-5 h-5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-bold flex items-center justify-center text-[11px] group-hover:bg-emerald-500/25">
              ✓
            </span>
            <span>Giỏ hàng</span>
          </Link>
          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/40 shrink-0" />
          <div className="inline-flex items-center gap-1.5 text-primary font-bold">
            <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground font-bold flex items-center justify-center text-[11px] shadow-xs">
              2
            </span>
            <span>Thông tin &amp; Thanh toán</span>
          </div>
          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/40 shrink-0" />
          <div className="inline-flex items-center gap-1.5 opacity-60">
            <span className="w-5 h-5 rounded-full bg-muted text-muted-foreground font-medium flex items-center justify-center text-[11px]">
              3
            </span>
            <span>Hoàn tất</span>
          </div>
        </nav>

        {/* Title & Trust Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 pb-3 border-b border-border/50">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
              Thanh toán đơn hàng
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">
              Kiểm tra thông tin nhận hàng, phương thức thanh toán và chốt cước giao tận nơi
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="grid lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Information & Payment (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Card 1: Thông tin giao hàng */}
          <div className="bg-card/90 backdrop-blur-xl border border-border/60 rounded-3xl p-5 sm:p-7 shadow-sm space-y-5 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-48 h-48 bg-primary/5 rounded-full blur-3xl -z-10 pointer-events-none" />

            {/* Header */}
            <div className="flex items-center justify-between gap-3 border-b border-border/50 pb-4">
              <div className="flex items-center gap-2.5">
                <span className="w-7 h-7 rounded-full bg-primary/15 text-primary font-bold text-xs flex items-center justify-center border border-primary/25 shadow-2xs">
                  1
                </span>
                <h2 className="text-base sm:text-lg font-bold tracking-tight text-foreground">
                  Thông tin nhận hàng
                </h2>
              </div>

              {/* GPS Button */}
              <button
                type="button"
                onClick={handleGetGPSLocation}
                disabled={isLocating}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 px-3 py-1.5 rounded-xl border border-emerald-500/25 transition-all cursor-pointer shadow-2xs whitespace-nowrap shrink-0 hover:scale-[1.02] active:scale-[0.98]"
                title="Sử dụng GPS thiết bị để định vị và tự động điền địa chỉ"
              >
                <Image
                  src="/icons/earth.png"
                  className={`w-3.5 h-3.5 shrink-0 ${isLocating ? "animate-spin" : ""}`}
                  alt="GPS"
                  width={14}
                  height={14}
                />
                <span>{isLocating ? "Đang định vị..." : "Lấy vị trí GPS"}</span>
              </button>
            </div>

            {/* Sổ địa chỉ đã lưu (nếu có) */}
            {savedAddresses.length > 0 && (
              <div className="bg-primary/[0.03] dark:bg-primary/[0.06] p-3.5 sm:p-4 rounded-2xl border border-primary/15 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Label className="text-xs font-bold text-primary flex items-center gap-1.5 tracking-tight">
                    <Bookmark className="w-3.5 h-3.5 text-primary" />
                    <span>Sổ địa chỉ của bạn ({savedAddresses.length})</span>
                  </Label>
                  <span className="text-[11px] text-muted-foreground hidden sm:inline">
                    Chọn để tự động điền nhanh
                  </span>
                </div>
                <Select
                  value={selectedAddressId || "new"}
                  onValueChange={(val) => {
                    if (val === "new") {
                      setSelectedAddressId("");
                      setFormData(prev => ({
                        ...prev,
                        phone: "",
                        street: "",
                        city: ""
                      }));
                      setCustomerCoords(null);
                      setVerifiedAddress("");
                    } else {
                      setSelectedAddressId(val);
                      const addr = savedAddresses.find(a => a.id === val);
                      if (addr) {
                        setFormData(prev => ({
                          ...prev,
                          fullName: addr.full_name || prev.fullName,
                          phone: addr.phone || "",
                          street: addr.street || "",
                          city: addr.city || ""
                        }));
                        setVerifiedAddress(`${addr.street || ""}, ${addr.city || ""}`);
                        if (addr.latitude && addr.longitude) {
                          setCustomerCoords({ lat: addr.latitude, lng: addr.longitude });
                        } else {
                          // Địa chỉ cũ chưa có GPS -> Tự động chuyển đổi và lưu ngầm
                          setCustomerCoords(null);
                          setIsGeocoding(true);
                          forwardGeocode(addr.street || "", addr.city || "").then(coords => {
                            setIsGeocoding(false);
                            if (coords) {
                              setCustomerCoords(coords);
                              setVerifiedAddress(`${addr.street || ""}, ${addr.city || ""}`);
                              supabase.from("addresses").update({ latitude: coords.lat, longitude: coords.lng }).eq("id", addr.id).then();
                            } else {
                              toast.warning("Địa chỉ chưa có GPS", {
                                description: "Vui lòng bấm nút [Xác nhận & Tìm vị trí] bên dưới để định vị tọa độ chuẩn."
                              });
                            }
                          });
                        }
                      }
                    }
                  }}
                >
                  <SelectTrigger className="w-full h-11 px-3.5 rounded-xl border border-input bg-background/80 hover:bg-background text-sm focus:ring-2 focus:ring-primary outline-none cursor-pointer text-foreground shadow-2xs overflow-hidden [&>span]:truncate [&>span]:text-left transition-colors">
                    <SelectValue placeholder="-- Tự nhập địa chỉ mới bên dưới --" />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl max-h-[280px]">
                    <SelectItem value="new" className="cursor-pointer font-medium text-muted-foreground">
                      + Tự nhập địa chỉ giao hàng mới
                    </SelectItem>
                    {savedAddresses.map(addr => (
                      <SelectItem key={addr.id} value={addr.id} className="cursor-pointer py-2.5">
                        <div className="flex items-center gap-2 text-xs">
                          {addr.type === 'home' && (
                            <span className="flex items-center gap-1 text-[10px] bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300 font-bold px-2 py-0.5 rounded-full shrink-0">
                              <Image src="/icons/home1.png" alt="Home" width={11} height={11} /> Nhà riêng
                            </span>
                          )}
                          {addr.type === 'office' && (
                            <span className="flex items-center gap-1 text-[10px] bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 font-bold px-2 py-0.5 rounded-full shrink-0">
                              <Image src="/icons/office.png" alt="Office" width={11} height={11} /> Văn phòng
                            </span>
                          )}
                          {addr.type === 'other' && (
                            <span className="flex items-center gap-1 text-[10px] bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 font-bold px-2 py-0.5 rounded-full shrink-0">
                              <Image src="/icons/pin.png" alt="Other" width={11} height={11} /> Khác
                            </span>
                          )}
                          <span className="truncate font-medium">{addr.full_name} ({addr.phone}) - {addr.street}, {addr.city}</span>
                          {addr.is_default && (
                            <span className="text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded-sm shrink-0">
                              Mặc định
                            </span>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* 2-Column Form Fields */}
            <div className="grid sm:grid-cols-2 gap-4">
              {/* Họ và Tên */}
              <div className="space-y-1.5">
                <Label htmlFor="fullName" className="text-xs font-semibold text-foreground/80 flex items-center justify-between">
                  <span>Họ và Tên <span className="text-destructive">*</span></span>
                </Label>
                <Input
                  id="fullName"
                  required
                  placeholder="VD: Nguyễn Văn A"
                  className="h-11 rounded-xl bg-background/60 focus:bg-background border-border/80 transition-colors text-sm"
                  value={formData.fullName}
                  onChange={e => {
                    const val = e.target.value;
                    setFormData(prev => ({ ...prev, fullName: val }));
                  }}
                />
              </div>

              {/* Số điện thoại */}
              <div className="space-y-1.5">
                <Label htmlFor="phone" className="text-xs font-semibold text-foreground/80 flex items-center justify-between">
                  <span>Số điện thoại <span className="text-destructive">*</span></span>
                  {formData.phone && (
                    <span className={`text-[10px] font-semibold ${isPhoneValid ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}`}>
                      {isPhoneValid ? "✓ Hợp lệ" : "10 số"}
                    </span>
                  )}
                </Label>
                <Input
                  id="phone"
                  required
                  type="tel"
                  placeholder="VD: 0912345678"
                  className="h-11 rounded-xl bg-background/60 focus:bg-background border-border/80 transition-colors text-sm"
                  value={formData.phone}
                  onChange={e => {
                    const val = e.target.value;
                    setFormData(prev => ({ ...prev, phone: val }));
                  }}
                />
              </div>

              {/* Tỉnh / Thành phố */}
              <div className="space-y-1.5">
                <Label htmlFor="city" className="text-xs font-semibold text-foreground/80">
                  Tỉnh / Khu vực <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="city"
                  required
                  placeholder="VD: TP. Hồ Chí Minh, Hà Nội, Đà Nẵng..."
                  className="h-11 rounded-xl bg-background/60 focus:bg-background border-border/80 transition-colors text-sm"
                  value={formData.city}
                  onChange={e => {
                    const val = e.target.value;
                    setFormData(prev => ({ ...prev, city: val }));
                    setSelectedAddressId("");
                    setCustomerCoords(null);
                    setVerifiedAddress("");
                    setAddressNotFound(false);
                  }}
                  onKeyDown={e => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleVerifyAddress();
                    }
                  }}
                />
              </div>

              {/* Địa chỉ cụ thể */}
              <div className="space-y-1.5">
                <Label htmlFor="street" className="text-xs font-semibold text-foreground/80">
                  Địa chỉ cụ thể / Tên địa điểm <span className="text-destructive">*</span>
                </Label>
                <div className="relative">
                  <Input
                    id="street"
                    required
                    placeholder="VD: Chung cư Ehome 3, 103 Hồ Học Lãm..."
                    className="h-11 rounded-xl bg-background/60 focus:bg-background border-border/80 transition-colors pr-10 text-sm"
                    value={formData.street}
                    onChange={e => {
                      const val = e.target.value;
                      setFormData(prev => ({ ...prev, street: val }));
                      setSelectedAddressId("");
                      setCustomerCoords(null);
                      setVerifiedAddress("");
                      setAddressNotFound(false);
                    }}
                    autoComplete="street-address"
                    onKeyDown={e => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleVerifyAddress();
                      }
                    }}
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                    {isGeocoding ? (
                      <IconLoader2 className="w-4 h-4 text-primary animate-spin" />
                    ) : customerCoords && isAddressVerified ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    ) : (
                      <MapPin className="w-4 h-4 text-muted-foreground/60" />
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* HỘP ĐỊNH VỊ & XÁC THỰC TỌA ĐỘ VỊ TRÍ GIAO HÀNG */}
            <div className={`rounded-2xl border p-4 sm:p-5 transition-all duration-300 ${customerCoords && isAddressVerified
              ? "bg-emerald-500/[0.04] dark:bg-emerald-950/20 border-emerald-500/30 shadow-2xs"
              : addressNotFound
                ? "bg-amber-500/[0.05] dark:bg-amber-950/20 border-amber-500/35 shadow-2xs"
                : formData.street.trim() && formData.city.trim()
                  ? "bg-primary/[0.03] dark:bg-primary/[0.06] border-primary/25 shadow-2xs"
                  : "bg-muted/30 border-border/60"
              }`}>
              <div className="space-y-3.5">
                {/* Header trạng thái */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div className="flex items-center gap-2.5">
                    {isGeocoding ? (
                      <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                        <IconLoader2 className="w-4 h-4 animate-spin text-primary" />
                      </div>
                    ) : customerCoords && isAddressVerified ? (
                      <div className="w-8 h-8 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      </div>
                    ) : addressNotFound ? (
                      <div className="w-8 h-8 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                        <AlertTriangle className="w-4 h-4 text-amber-500" />
                      </div>
                    ) : (
                      <div className="w-8 h-8 border  rounded-full bg-muted text-muted-foreground flex items-center justify-center shrink-0">
                        <MapPin className="w-4 h-4 text-muted-foreground" />
                      </div>
                    )}

                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-foreground">
                          {isGeocoding
                            ? "Đang tìm kiếm tọa độ địa chỉ..."
                            : customerCoords && isAddressVerified
                              ? "Đã xác thực vị trí giao hàng"
                              : addressNotFound
                                ? "Chưa tìm thấy địa chỉ trên bản đồ số"
                                : formData.street.trim() && formData.city.trim()
                                  ? "Cần bấm Xác nhận vị trí để chốt cước"
                                  : "Chưa xác thực tọa độ vị trí"}
                        </span>

                        {customerCoords && isAddressVerified && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 rounded-full shadow-2xs">
                            <Truck className="w-3 h-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
                            ~{shippingInfo.distanceKm} km
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-muted-foreground mt-0.5">
                        {customerCoords && isAddressVerified
                          ? `Tọa độ: (${customerCoords.lat.toFixed(4)}, ${customerCoords.lng.toFixed(4)})`
                          : "Bản đồ số dùng để tính cước vận chuyển chuẩn xác"}
                      </p>
                    </div>
                  </div>

                  {/* Nút đổi cơ sở (nếu có nhiều cơ sở) */}
                  {availableBranches.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setIsBranchModalOpen(true)}
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-primary bg-primary/10 hover:bg-primary/20 border border-primary/25 px-3 py-1 rounded-xl transition-all cursor-pointer whitespace-nowrap shadow-2xs self-start sm:self-center"
                    >
                      <Building2 className="w-3.5 h-3.5 text-primary shrink-0" />
                      <span>Đổi cơ sở ({availableBranches.length} cơ sở)</span>
                    </button>
                  )}
                </div>

                {/* Case 1: Đã xác thực vị trí */}
                {customerCoords && isAddressVerified && (
                  <div className="space-y-2.5 pt-2 border-t border-emerald-500/20">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      <div className="flex items-center gap-2 bg-background/50 dark:bg-background/30 p-2.5 rounded-xl border border-emerald-500/15">
                        <span className="text-muted-foreground">Dự kiến giao:</span>
                        <strong className="text-foreground font-bold">{shippingInfo.estimatedDeliveryText}</strong>
                      </div>
                      <div className="flex items-center gap-2 bg-background/50 dark:bg-background/30 p-2.5 rounded-xl border border-emerald-500/15">
                        <span className="text-muted-foreground">Phí vận chuyển:</span>
                        <strong className={shippingInfo.isFreeShipping ? "text-emerald-600 dark:text-emerald-400 font-bold" : "text-foreground font-bold"}>
                          {shippingInfo.isFreeShipping ? "Miễn phí (Freeship)" : formatCurrency(shippingInfo.shippingFee)}
                        </strong>
                      </div>
                    </div>

                    {/* Thông điệp cam kết giao hàng Google Maps */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-900 dark:text-sky-200 text-[11.5px] leading-relaxed">
                      <div className="flex items-start gap-2">
                        <Info className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400 shrink-0 mt-0.5" />
                        <span>
                          <strong>Giao tận cửa nhà:</strong> Tọa độ dùng để tính cước cự ly. Khi giao, shipper sẽ điều hướng <strong>Google Maps</strong> theo đúng số nhà và địa chỉ chi tiết bạn đã nhập.
                        </span>
                      </div>
                      <a
                        href={getGoogleMapsUrl({
                          lat: customerCoords.lat,
                          lng: customerCoords.lng,
                          address: formData.street && formData.city ? `${formData.street}, ${formData.city}` : undefined,
                          mode: "search",
                        })}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 font-bold text-sky-600 hover:text-sky-700 dark:text-sky-400 hover:underline shrink-0 whitespace-nowrap self-start sm:self-center pl-5 sm:pl-0"
                        title="Mở Google Maps để kiểm tra vị trí nhà của bạn"
                      >
                        <ExternalLink className="w-3 h-3" />
                        Google Maps
                      </a>
                    </div>
                  </div>
                )}

                {/* Case 2: Chưa tìm thấy địa chỉ */}
                {addressNotFound && !customerCoords && (
                  <div className="space-y-2.5 pt-2 border-t border-amber-500/20 text-xs">
                    <p className="text-muted-foreground leading-relaxed text-[11.5px]">
                      Đường mới, hẻm sâu hoặc địa điểm mới chưa có trên bản đồ số. Quý khách vui lòng chọn 1 phương án dưới đây để tiếp tục đặt hàng ngay:
                    </p>
                    <div className="flex flex-wrap items-center gap-2 pt-0.5">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setIsMapPickerOpen(true)}
                        className="h-8 text-xs font-semibold rounded-lg border-primary/40 text-primary hover:bg-primary/10 gap-1.5 cursor-pointer shadow-2xs"
                      >
                        {/* <MapPin className="w-3.5 h-3.5" /> */}
                        1. Ghim trên bản đồ
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={handleGetGPSLocation}
                        className="h-8 text-xs font-semibold rounded-lg border-emerald-500/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/10 gap-1.5 cursor-pointer shadow-2xs"
                      >
                        {/* <Image src="/icons/earth.png" alt="GPS" width={12} height={12} /> */}
                        2. Lấy vị trí GPS
                      </Button>
                      {formData.city.trim() && (
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          onClick={handleUseCityFallback}
                          className="h-8 text-xs font-bold rounded-lg gap-1.5 cursor-pointer bg-amber-500/15 hover:bg-amber-500/25 text-amber-900 dark:text-amber-200 border border-amber-500/30 shadow-2xs"
                        >
                          3. Tính cước theo khu vực {formData.city}
                        </Button>
                      )}
                    </div>
                  </div>
                )}

                {/* Case 3: Đang chờ nhập */}
                {!customerCoords && !addressNotFound && (
                  <div className="text-xs text-muted-foreground leading-relaxed pt-1">
                    Sau khi nhập Tỉnh/Thành &amp; Địa chỉ, hãy bấm <strong className="text-foreground font-semibold">Xác nhận &amp; Tìm vị trí</strong> hoặc <strong className="text-foreground font-semibold">Chọn trên bản đồ</strong> để hoàn tất tính phí ship.
                  </div>
                )}

                {/* Các nút hành động (Bản đồ + Xác thực) */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 pt-3 border-t border-border/50">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setIsMapPickerOpen(true)}
                    className="rounded-xl text-xs font-semibold h-9 sm:h-10 px-4 border-border/80 hover:bg-primary/5 hover:border-primary/40 transition-all flex items-center justify-center gap-1.5 w-full sm:w-auto shrink-0 shadow-2xs whitespace-nowrap cursor-pointer"
                  >
                    <Image src="/icons/location.png" alt="GPS" width={16} height={16} />
                    <span>Chọn trên bản đồ</span>
                  </Button>

                  <Button
                    type="button"
                    variant={customerCoords && isAddressVerified ? "outline" : "default"}
                    size="sm"
                    onClick={handleVerifyAddress}
                    disabled={isGeocoding || !formData.street.trim() || !formData.city.trim()}
                    className={`rounded-xl text-xs font-bold h-9 sm:h-10 px-4 transition-all flex items-center justify-center gap-1.5 w-full sm:w-auto shrink-0 shadow-2xs whitespace-nowrap cursor-pointer ${customerCoords && isAddressVerified
                      ? "border-emerald-500/30 hover:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                      : "bg-primary text-primary-foreground shadow-md shadow-primary/20 hover:scale-[1.01]"
                      }`}
                  >
                    {isGeocoding ? (
                      <>
                        <IconLoader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                        Đang tìm...
                      </>
                    ) : customerCoords && isAddressVerified ? (
                      <>
                        <Image src="/icons/check.png" alt="GPS" width={16} height={16} />
                        Kiểm tra lại vị trí
                      </>
                    ) : (
                      <>
                        <Image src="/icons/send1.png" alt="GPS" width={16} height={16} />
                        Xác nhận &amp; Tìm vị trí
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>

            {/* Checkbox Lưu địa chỉ mới */}
            {!selectedAddressId && (
              <div className="flex items-center gap-2.5 pt-2">
                <input
                  type="checkbox"
                  id="saveNewAddr"
                  checked={saveNewAddress}
                  onChange={e => setSaveNewAddress(e.target.checked)}
                  className="w-4 h-4 rounded border-input text-primary focus:ring-primary cursor-pointer accent-primary"
                />
                <Label htmlFor="saveNewAddr" className="text-xs cursor-pointer text-muted-foreground font-medium select-none">
                  Lưu địa chỉ này vào Sổ địa chỉ để sử dụng nhanh cho các đơn sau
                </Label>
              </div>
            )}
          </div>

          {/* Card 2: Phương thức thanh toán */}
          <div className="bg-card/90 backdrop-blur-xl border border-border/60 rounded-3xl p-5 sm:p-7 shadow-sm space-y-5 relative overflow-hidden">
            <div className="flex items-center gap-2.5 border-b border-border/50 pb-4">
              <span className="w-7 h-7 rounded-full bg-primary/15 text-primary font-bold text-xs flex items-center justify-center border border-primary/25 shadow-2xs">
                2
              </span>
              <h2 className="text-base sm:text-lg font-bold tracking-tight text-foreground">
                Phương thức thanh toán
              </h2>
            </div>

            <RadioGroup
              value={formData.paymentMethod}
              onValueChange={v => setFormData(prev => ({ ...prev, paymentMethod: v }))}
              className="grid sm:grid-cols-2 gap-3.5"
            >
              {/* Option COD */}
              <div
                className={`relative flex flex-col justify-between p-4 rounded-2xl border-2 transition-all duration-200 cursor-pointer ${formData.paymentMethod === 'cod'
                  ? 'border-primary bg-primary/[0.04] dark:bg-primary/[0.08] shadow-sm'
                  : 'border-border/60 bg-background/50 hover:bg-muted/40 hover:border-border'
                  }`}
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <Banknote className="w-5 h-5 text-primary" />
                  </div>
                  <RadioGroupItem value="cod" id="cod" className="mt-0.5 relative z-10" />
                </div>
                <div>
                  <Label htmlFor="cod" className="cursor-pointer font-bold text-sm block text-foreground after:absolute after:inset-0">
                    Thanh toán khi nhận hàng (COD)
                  </Label>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                    Kiểm tra hàng tận tay trước khi gửi tiền cho nhân viên giao hàng
                  </p>
                </div>
              </div>

              {/* Option Banking */}
              <div
                className={`relative flex flex-col justify-between p-4 rounded-2xl border-2 transition-all duration-200 cursor-pointer ${formData.paymentMethod === 'banking'
                  ? 'border-primary bg-primary/[0.04] dark:bg-primary/[0.08] shadow-sm'
                  : 'border-border/60 bg-background/50 hover:bg-muted/40 hover:border-border'
                  }`}
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                    <QrCode className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div className="flex items-center gap-2 relative z-10">
                    <span className="text-[10.5px] bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full font-bold shadow-2xs">
                      Quét QR tự động
                    </span>
                    <RadioGroupItem value="banking" id="banking" className="mt-0.5" />
                  </div>
                </div>
                <div>
                  <Label htmlFor="banking" className="cursor-pointer font-bold text-sm block text-foreground after:absolute after:inset-0">
                    Chuyển khoản ngân hàng
                  </Label>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                    Tạo mã VietQR tự động, xác nhận thanh toán tức thì 24/7
                  </p>
                </div>
              </div>
            </RadioGroup>
          </div>
        </div>

        {/* Right Column: Order Summary (5 cols - Sticky) */}
        <div className="lg:col-span-5">
          <div className="bg-card/90 backdrop-blur-xl border border-border/60 rounded-3xl p-5 sm:p-7 shadow-lg sticky top-24 overflow-hidden relative space-y-5">
            <div className="absolute top-0 right-0 w-40 h-40 bg-primary/5 rounded-full blur-3xl -z-10 pointer-events-none" />

            {/* Header */}
            <div className="flex items-center justify-between border-b border-border/50 pb-4">
              <div>
                <h2 className="text-base sm:text-lg font-bold tracking-tight text-foreground">
                  Đơn hàng của bạn
                </h2>
                <span className="text-xs text-muted-foreground">
                  {cartItems.reduce((acc, it) => acc + it.quantity, 0)} sản phẩm trong giỏ
                </span>
              </div>
              <Link href="/cart" className="text-xs font-semibold text-primary hover:underline">
                Sửa giỏ hàng
              </Link>
            </div>

            {/* Cart Items Preview */}
            <div className="space-y-3 max-h-[260px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-muted-foreground/20">
              {cartItems.map((item) => {
                const basePrice = Number(item.products?.price || 0);
                const discount = Number(item.products?.discount_percent || 0);
                const modifier = Number(item.product_variants?.price_modifier || 0);
                const price = basePrice - (basePrice * discount / 100) + modifier;

                return (
                  <div key={item.id} className="flex items-center justify-between gap-3 text-xs p-2 rounded-xl bg-muted/20 hover:bg-muted/40 transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="relative shrink-0">
                        <Image
                          width={46}
                          height={46}
                          unoptimized
                          src={item.products?.image_url || "https://placehold.co/46x46"}
                          alt={item.products?.name || "Product"}
                          className="h-12 w-12 rounded-xl border border-border/50 object-cover shadow-2xs"
                        />
                        <span className="absolute -top-1.5 -right-1.5 flex h-4.5 min-w-[18px] px-1 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground font-bold shadow-xs">
                          {item.quantity}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-foreground truncate max-w-[160px] sm:max-w-[180px]">
                          {item.products?.name}
                        </p>
                        {item.product_variants && (
                          <span className="text-[11px] text-muted-foreground block truncate">
                            Phân loại: {item.product_variants.name}
                          </span>
                        )}
                        <span className="text-[11px] text-muted-foreground sm:hidden">
                          {formatCurrency(price)} × {item.quantity}
                        </span>
                      </div>
                    </div>
                    <span className="font-bold text-foreground text-sm shrink-0 whitespace-nowrap">
                      {formatCurrency(price * item.quantity)}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Coupon Selector */}
            <div className="pt-1">
              <CouponSelector
                subtotal={getSubtotal()}
                appliedCoupon={appliedCoupon}
                couponCodeInput={couponCodeInput}
                setCouponCodeInput={setCouponCodeInput}
                onApplyCoupon={handleApplyCoupon}
                onRemoveCoupon={handleRemoveCoupon}
                couponError={couponError}
              />
            </div>

            {/* LuxeCommerce Loyalty Coins Selector */}
            {loyaltyProfile && loyaltyProfile.coinsBalance > 0 && (
              <div className="p-3.5 sm:p-4 rounded-2xl border border-amber-500/30 bg-gradient-to-r from-amber-500/[0.08] via-yellow-500/[0.05] to-transparent shadow-xs transition-all">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="size-8 rounded-xl bg-amber-500/20 text-amber-700 dark:text-amber-400 flex items-center justify-center shrink-0 font-bold text-sm shadow-2xs">
                      🪙
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-xs sm:text-sm text-foreground">
                          Dùng Xu LuxeCommerce
                        </span>
                        <Badge variant="outline" className={`text-[10px] px-1.5 py-0 font-extrabold ${loyaltyProfile.tierConfig.badgeClass}`}>
                          {loyaltyProfile.tierConfig.iconName} {loyaltyProfile.tierConfig.label}
                        </Badge>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                        Khả dụng: <strong className="text-amber-700 dark:text-amber-300 font-bold">{loyaltyProfile.coinsBalance.toLocaleString("vi-VN")} Xu</strong>
                        {coinDiscount > 0 && useCoins ? ` (Giảm -${formatCurrency(coinDiscount)})` : " (1 Xu = 1đ)"}
                      </p>
                    </div>
                  </div>

                  <label className="relative inline-flex items-center cursor-pointer shrink-0">
                    <input
                      type="checkbox"
                      checked={useCoins}
                      onChange={(e) => setUseCoins(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-muted peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-600 shadow-inner"></div>
                  </label>
                </div>

                {useCoins && (
                  <div className="mt-2.5 pt-2.5 border-t border-amber-500/20 flex items-center justify-between text-[11px] text-amber-800 dark:text-amber-300 font-semibold">
                    <span>Áp dụng giảm tiền hàng:</span>
                    <span className="text-xs font-extrabold text-amber-700 dark:text-amber-300">
                      -{formatCurrency(coinDiscount)}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Pricing Breakdown */}
            <div className="space-y-3 text-xs border-t border-border/50 pt-4">
              <div className="flex justify-between items-center text-muted-foreground">
                <span>Tạm tính</span>
                <span className="font-semibold text-foreground text-sm">{formatCurrency(getSubtotal())}</span>
              </div>

              {appliedCoupon && (
                <div className="flex justify-between items-center text-emerald-600 dark:text-emerald-400">
                  <span className="font-medium">Mã giảm ({appliedCoupon.code})</span>
                  <span className="font-bold text-sm">-{formatCurrency(getSubtotal() * appliedCoupon.discount_percent / 100)}</span>
                </div>
              )}

              {useCoins && coinDiscount > 0 && (
                <div className="flex justify-between items-center text-amber-700 dark:text-amber-300">
                  <span className="font-medium flex items-center gap-1.5">
                    <span>🪙</span> Xu tích lũy cấn trừ ({coinDiscount.toLocaleString("vi-VN")} Xu)
                  </span>
                  <span className="font-bold text-sm">-{formatCurrency(coinDiscount)}</span>
                </div>
              )}

              {/* Phí vận chuyển & Freeship */}
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <Truck className="w-3.5 h-3.5 text-primary" />
                  Phí vận chuyển (~{shippingInfo.distanceKm} km):
                </span>
                {shippingInfo.isFreeShipping || effectiveShippingFee === 0 ? (
                  <div className="flex items-center gap-1.5">
                    {shippingInfo.originalFee > 0 && (
                      <span className="line-through text-[11px] text-muted-foreground">
                        {formatCurrency(shippingInfo.originalFee)}
                      </span>
                    )}
                    <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/25 text-[10px] font-bold px-2 py-0.5">
                      {loyaltyProfile?.tier === "diamond" ? "💎 Freeship Kim Cương" : "Freeship"}
                    </Badge>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5">
                    {loyaltyProfile?.tier === "gold" && (
                      <span className="line-through text-[11px] text-muted-foreground">
                        {formatCurrency(shippingInfo.shippingFee)}
                      </span>
                    )}
                    <span className="font-bold text-foreground text-sm">
                      {formatCurrency(effectiveShippingFee)}
                    </span>
                    {loyaltyProfile?.tier === "gold" && (
                      <Badge className="bg-yellow-500/15 text-yellow-700 dark:text-yellow-400 border border-yellow-500/25 text-[10px] font-bold px-1.5 py-0">
                        🥇 -50%
                      </Badge>
                    )}
                  </div>
                )}
              </div>

              {/* Gợi ý / Trạng thái Freeship */}
              {!shippingInfo.isFreeShipping && effectiveShippingFee > 0 && (
                <div className="p-3 rounded-xl bg-amber-500/[0.08] border border-amber-500/20 space-y-1.5">
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-amber-800 dark:text-amber-300 font-medium">
                      Mua thêm <strong>{formatCurrency(shippingInfo.freeShippingThreshold - getSubtotal())}</strong> để được Freeship 100%
                    </span>
                  </div>
                  {/* Thanh tiến trình */}
                  <div className="w-full bg-amber-500/20 h-1.5 rounded-full overflow-hidden">
                    <div
                      className="bg-amber-500 h-full rounded-full transition-all duration-300"
                      style={{ width: `${Math.min(100, Math.round((getSubtotal() / shippingInfo.freeShippingThreshold) * 100))}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Tổng thanh toán */}
              <div className="border-t border-border/60 pt-4 mt-2">
                <div className="flex justify-between items-baseline mb-1">
                  <div>
                    <span className="font-bold text-sm text-foreground block">Tổng thanh toán</span>
                    <span className="text-[11px] text-muted-foreground">(Đã bao gồm VAT &amp; phí ship)</span>
                  </div>
                  <span className="text-2xl sm:text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-primary to-primary/80">
                    {formatCurrency(calculateTotal())}
                  </span>
                </div>
              </div>

              {/* Preview số xu sẽ nhận được */}
              {estimatedCoinsEarned > 0 && (
                <div className="mt-3 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-between text-xs text-amber-800 dark:text-amber-300 font-bold">
                  <span className="flex items-center gap-1.5">
                    <span>✨</span>
                    <span>Tích lũy sau khi giao:</span>
                  </span>
                  <span className="font-extrabold text-sm text-amber-600 dark:text-amber-400">
                    +{estimatedCoinsEarned.toLocaleString("vi-VN")} Xu
                  </span>
                </div>
              )}
            </div>

            {/* CTA Button Đặt hàng */}
            {role === "admin" || role === "staff" ? (
              <div className="space-y-3 pt-2">
                <Button type="button" className="w-full h-12 text-sm font-bold rounded-xl opacity-60 cursor-not-allowed" disabled>
                  Hoàn tất đặt hàng
                </Button>
                <p className="text-[11.5px] text-center text-amber-600 dark:text-amber-400 font-medium bg-amber-500/10 p-2.5 rounded-xl border border-amber-500/20">
                  * {role === "admin"
                    ? "Tài khoản Quản trị viên (Admin) không được tạo đơn mua hàng cá nhân."
                    : "Nhân viên (Staff) vui lòng dùng tài khoản Khách hàng để thanh toán."}
                </p>
              </div>
            ) : (
              <div className="space-y-2.5 pt-2">
                <Button
                  type="submit"
                  className={`w-full h-13 text-sm sm:text-base font-bold rounded-2xl shadow-lg transition-all duration-300 ${!canPlaceOrder
                    ? "bg-muted text-muted-foreground hover:bg-muted/80 cursor-not-allowed opacity-75"
                    : "bg-gradient-to-r from-primary to-primary/85 hover:opacity-95 shadow-primary/25 hover:shadow-primary/40 hover:scale-[1.01] cursor-pointer"
                    }`}
                  size="lg"
                  disabled={!canPlaceOrder}
                >
                  {submitting ? (
                    <>
                      <IconLoader2 className="mr-2 h-4 w-4 animate-spin" />
                      Đang xử lý đặt hàng...
                    </>
                  ) : isOutOfStock ? (
                    "⚠️ Giỏ hàng có sản phẩm vượt tồn kho"
                  ) : !formData.fullName.trim() || formData.fullName.trim().length < 2 ? (
                    "⚠️ Vui lòng nhập Họ và Tên"
                  ) : !isPhoneValid ? (
                    "⚠️ Vui lòng nhập Số điện thoại hợp lệ"
                  ) : !formData.city.trim() || !formData.street.trim() ? (
                    "⚠️ Vui lòng nhập đầy đủ Địa chỉ"
                  ) : !customerCoords || !isAddressVerified ? (
                    "📍 Xác nhận vị trí để đặt hàng"
                  ) : (
                    <span className="flex items-center gap-1.5">
                      <span>Đặt hàng ngay</span>
                      <span className="opacity-80">({formatCurrency(calculateTotal())})</span>
                    </span>
                  )}
                </Button>

                {/* Thông báo trạng thái xác thực form */}
                {formValidationReason ? (
                  <p className="text-[11.5px] text-center text-amber-700 dark:text-amber-400 font-medium bg-amber-500/10 py-1.5 px-3 rounded-xl border border-amber-500/20 flex items-center justify-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{formValidationReason}</span>
                  </p>
                ) : (
                  <p className="text-[11.5px] text-center text-emerald-700 dark:text-emerald-300 font-medium bg-emerald-500/10 py-1.5 px-3 rounded-xl border border-emerald-500/20 flex items-center justify-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-emerald-500" />
                    <span>Vị trí hợp lệ (~{shippingInfo.distanceKm} km). Sẵn sàng đặt hàng!</span>
                  </p>
                )}
              </div>
            )}

            {/* Footer cam kết & tin cậy */}
            <div className="grid grid-cols-3 gap-2 pt-3 border-t border-border/50 text-[10.5px] text-muted-foreground text-center">
              <div className="flex flex-col items-center gap-1">
                <ShieldCheck className="w-4 h-4 text-primary" />
                <span>Bảo mật 100%</span>
              </div>
              <div className="flex flex-col items-center gap-1">
                <Truck className="w-4 h-4 text-primary" />
                <span>Giao hàng tận nơi</span>
              </div>
              <div className="flex flex-col items-center gap-1">
                <RotateCcw className="w-4 h-4 text-primary" />
                <span>Đổi trả 7 ngày</span>
              </div>
            </div>
          </div>
        </div>
      </form>

      {/* Modal Chọn vị trí trực quan trên Bản đồ tương tác Leaflet/OpenStreetMap */}
      <AddressMapPickerModal
        open={isMapPickerOpen}
        onOpenChange={setIsMapPickerOpen}
        initialCoords={customerCoords}
        initialStreet={formData.street}
        initialCity={formData.city}
        subtotal={getSubtotal()}
        onConfirm={(result) => {
          setFormData((prev) => ({
            ...prev,
            street: result.street || prev.street,
            city: result.city || prev.city,
          }));
          setCustomerCoords({ lat: result.lat, lng: result.lng });
          setVerifiedAddress(`${result.street || formData.street}, ${result.city || formData.city}`);
          setSelectedAddressId("");
          setAddressNotFound(false);
        }}
      />

      {/* Modal Chọn cơ sở giao hàng khi địa điểm có nhiều cơ sở (Ví dụ: Đại học GTVT TP.HCM, ĐH Bách Khoa...) */}
      <BranchSelectorModal
        isOpen={isBranchModalOpen}
        onClose={() => setIsBranchModalOpen(false)}
        poiName={multiBranchPlaceName}
        cityName={formData.city}
        branches={availableBranches}
        onSelectBranch={handleSelectBranch}
        calculateDistanceKm={(coords) => calculateShippingFee(subtotal, coords).distanceKm}
        onOpenMapPicker={() => setIsMapPickerOpen(true)}
      />
    </div>
  );
}
