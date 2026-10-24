"use client";

import { useEffect, useState, useCallback } from "react";
import { getAddresses, addAddress, updateAddress, deleteAddress } from "@/lib/services/address.service";
import { useAuth } from "@/components/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { IconLoader2, IconPlus, IconTrash, IconEdit, IconMapPinFilled } from "@tabler/icons-react";
import { LuxeLoading } from "@/components/storefront/luxe-loading";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import Image from "next/image";
import { MapPin, CheckCircle2, ExternalLink, Building2, Info } from "lucide-react";
import { AddressMapPickerModal } from "@/components/storefront/address-map-picker-modal";
import { BranchSelectorModal } from "@/components/storefront/branch-selector-modal";
import { getGoogleMapsUrl, forwardGeocode, forwardGeocodeDetailed, getCoordinatesFromCity, BranchOption } from "@/lib/services/shipping.service";

export default function AddressesPage() {
  const { user } = useAuth();
  const [addresses, setAddresses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deleteModalId, setDeleteModalId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [isMapOpen, setIsMapOpen] = useState(false);
  
  // State phục vụ việc chọn cơ sở đối với các trường học / địa điểm nhiều cơ sở
  const [availableBranches, setAvailableBranches] = useState<BranchOption[]>([]);
  const [multiBranchPoiName, setMultiBranchPoiName] = useState("");
  const [isBranchModalOpen, setIsBranchModalOpen] = useState(false);
  
  const [formData, setFormData] = useState<{
    id: string;
    full_name: string;
    phone: string;
    street: string;
    city: string;
    latitude: number | null;
    longitude: number | null;
    is_default: boolean;
    type: string;
  }>({
    id: "",
    full_name: "",
    phone: "",
    street: "",
    city: "",
    latitude: null,
    longitude: null,
    is_default: false,
    type: "home"
  });

  const fetchAddresses = useCallback(async () => {
    setTimeout(() => setLoading(true), 0);
    const { data, error } = await getAddresses();
    if (!error && data) {
      setAddresses(data);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (user) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      fetchAddresses();
    }
  }, [user, fetchAddresses]);

  const resetForm = () => {
    setFormData({
      id: "",
      full_name: "",
      phone: "",
      street: "",
      city: "",
      latitude: null,
      longitude: null,
      is_default: false,
      type: "home"
    });
    setAvailableBranches([]);
    setMultiBranchPoiName("");
  };

  const handleCheckAddress = async () => {
    if (!formData.street?.trim()) {
      toast.error("Vui lòng nhập địa chỉ cụ thể");
      return;
    }
    const res = await forwardGeocodeDetailed(formData.street, formData.city);
    if (res.hasMultipleBranches && res.branches && res.branches.length > 0) {
      setAvailableBranches(res.branches);
      setMultiBranchPoiName(res.matchedName || "Địa điểm có nhiều cơ sở");
      setIsBranchModalOpen(true);
      return;
    }
    if (res.coords) {
      setFormData((prev) => ({
        ...prev,
        latitude: res.coords!.lat,
        longitude: res.coords!.lng,
      }));
      toast.success("Đã tìm thấy vị trí GPS chính xác!");
    } else {
      toast.error("Không tìm thấy địa chỉ tự động, bạn có thể bấm 'Chọn trên bản đồ'");
    }
  };

  const handleSelectBranch = (branch: BranchOption) => {
    const streetWithBranch =
      branch.branchName && !branch.street.toLowerCase().includes(branch.branchName.toLowerCase())
        ? `${branch.branchName} - ${branch.street}`
        : branch.street;
    const cityToSet = branch.city || formData.city || "TP.HCM";

    setFormData((prev) => ({
      ...prev,
      street: streetWithBranch,
      city: cityToSet,
      latitude: branch.coords.lat,
      longitude: branch.coords.lng,
    }));
    setIsBranchModalOpen(false);
    toast.success(`Đã xác nhận vị trí: ${branch.branchName}`);
  };

  const handleOpenAdd = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  const handleOpenEdit = (addr: any) => {
    setFormData({
      id: addr.id,
      full_name: addr.full_name || "",
      phone: addr.phone || "",
      street: addr.street || "",
      city: addr.city || "",
      latitude: addr.latitude || null,
      longitude: addr.longitude || null,
      is_default: addr.is_default || false,
      type: addr.type || "home"
    });
    setAvailableBranches([]);
    setMultiBranchPoiName("");
    setIsDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!deleteModalId) return;
    setDeleting(true);
    const { error } = await deleteAddress(deleteModalId);
    setDeleting(false);
    if (error) {
      toast.error("Lỗi khi xóa địa chỉ");
    } else {
      toast.success("Đã xóa địa chỉ");
      setDeleteModalId(null);
      fetchAddresses();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const phoneRegex = /^(0|\+84)(3|5|7|8|9)[0-9]{8}$/;
    if (!phoneRegex.test(formData.phone.trim())) {
      toast.error("Số điện thoại không hợp lệ!", {
        description: "Vui lòng nhập đúng định dạng số di động Việt Nam (10 chữ số, ví dụ 098... hoặc 039...)."
      });
      return;
    }

    setIsSubmitting(true);
    
    const finalData = { ...formData };
    if (!finalData.latitude || !finalData.longitude) {
      try {
        const geoRes = await forwardGeocodeDetailed(finalData.street, finalData.city);
        if (geoRes.hasMultipleBranches && geoRes.branches && geoRes.branches.length > 0) {
          setAvailableBranches(geoRes.branches);
          setMultiBranchPoiName(geoRes.matchedName || "Địa điểm có nhiều cơ sở");
          setIsBranchModalOpen(true);
          setIsSubmitting(false);
          toast.info("Địa điểm này có nhiều cơ sở, vui lòng chọn cơ sở của bạn.");
          return;
        }
        if (geoRes.coords) {
          finalData.latitude = geoRes.coords.lat;
          finalData.longitude = geoRes.coords.lng;
        } else {
          // Fallback theo Tỉnh / Thành phố nếu không tìm thấy tên đường cụ thể trên bản đồ
          const cityFallback = getCoordinatesFromCity(finalData.city);
          if (cityFallback) {
            finalData.latitude = cityFallback.lat;
            finalData.longitude = cityFallback.lng;
          }
        }
      } catch (err) {
        console.warn("Auto geocode on save warning:", err);
      }
    }

    let error;
    if (finalData.id) {
      const res = await updateAddress(finalData.id, finalData);
      error = res.error;
    } else {
      const res = await addAddress(finalData);
      error = res.error;
    }

    setIsSubmitting(false);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success(formData.id ? "Đã cập nhật địa chỉ" : "Đã thêm địa chỉ mới");
      setIsDialogOpen(false);
      fetchAddresses();
    }
  };

  if (loading) return <LuxeLoading label="Đang tải Sổ địa chỉ..." />;

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-10 mt-2">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Sổ địa chỉ</h1>
          <p className="text-muted-foreground mt-1.5 text-sm sm:text-base">Quản lý địa chỉ giao hàng và thông tin liên hệ của bạn.</p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button onClick={handleOpenAdd} className="rounded-full px-6 shadow-md shadow-primary/20 hover:shadow-lg transition-all">
              <IconPlus className="size-4 mr-2" /> Thêm Địa Chỉ Mới
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px] p-0 rounded-[24px] overflow-hidden border-border/50 animate__animated animate__zoomIn">
            <DialogHeader className="px-6 pt-6 pb-4 bg-muted/30 border-b border-border/50">
              <DialogTitle className="text-xl font-bold">{formData.id ? "Cập Nhật Địa Chỉ" : "Thêm Địa Chỉ Mới"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-5 px-6 py-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div className="space-y-2.5">
                  <Label htmlFor="full_name" className="text-[13px] font-semibold text-foreground/80">Họ và tên</Label>
                  <Input id="full_name" placeholder="Nguyễn Văn A" value={formData.full_name} onChange={e => setFormData({...formData, full_name: e.target.value})} required className="h-11 bg-background/50 border-border/60 focus-visible:bg-background focus-visible:ring-1 focus-visible:ring-primary rounded-xl transition-all" />
                </div>
                <div className="space-y-2.5">
                  <Label htmlFor="phone" className="text-[13px] font-semibold text-foreground/80">Số điện thoại</Label>
                  <Input id="phone" placeholder="0912345678" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} required className="h-11 bg-background/50 border-border/60 focus-visible:bg-background focus-visible:ring-1 focus-visible:ring-primary rounded-xl transition-all" />
                </div>
              </div>
              <div className="space-y-2.5">
                <Label htmlFor="city" className="text-[13px] font-semibold text-foreground/80">Tỉnh / Thành phố</Label>
                <Input id="city" placeholder="Hà Nội" value={formData.city} onChange={e => setFormData({...formData, city: e.target.value})} required className="h-11 bg-background/50 border-border/60 focus-visible:bg-background focus-visible:ring-1 focus-visible:ring-primary rounded-xl transition-all" />
              </div>
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="street" className="text-[13px] font-semibold text-foreground/80">Địa chỉ cụ thể</Label>
                  <div className="flex items-center gap-3">
                    {availableBranches.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setIsBranchModalOpen(true)}
                        className="text-xs text-primary hover:underline font-semibold flex items-center gap-1 cursor-pointer"
                      >
                        <Building2 className="w-3.5 h-3.5" />
                        <span>Đổi cơ sở</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setIsMapOpen(true)}
                      className="text-xs text-primary hover:underline font-semibold flex items-center gap-1 cursor-pointer"
                    >
                      <MapPin className="w-3.5 h-3.5" />
                      {formData.latitude && formData.longitude ? "Đã ghim vị trí (Sửa)" : "Chọn trên bản đồ"}
                    </button>
                  </div>
                </div>
                <Input id="street" placeholder="Số nhà, ngõ, đường..." value={formData.street} onChange={e => setFormData({...formData, street: e.target.value})} required className="h-11 bg-background/50 border-border/60 focus-visible:bg-background focus-visible:ring-1 focus-visible:ring-primary rounded-xl transition-all" />
                {formData.latitude && formData.longitude ? (
                  <div className="flex items-center justify-between text-[11px] text-emerald-600 dark:text-emerald-400 font-medium mt-1">
                    <span className="flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Đã gắn tọa độ GPS chuẩn ({formData.latitude.toFixed(4)}, {formData.longitude.toFixed(4)})
                    </span>
                    {availableBranches.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setIsBranchModalOpen(true)}
                        className="text-primary hover:underline font-semibold flex items-center gap-1 cursor-pointer"
                      >
                        <Building2 className="w-3 h-3" />
                        Đổi cơ sở ({availableBranches.length})
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center justify-between mt-1 text-[11px]">
                    <span className="text-muted-foreground">Nhập tên trường, cơ sở hoặc địa chỉ</span>
                    <button
                      type="button"
                      onClick={handleCheckAddress}
                      className="text-primary hover:underline font-semibold flex items-center gap-1 cursor-pointer"
                    >
                      <Building2 className="w-3 h-3" />
                      Kiểm tra cơ sở
                    </button>
                  </div>
                )}
                {/* Thông điệp cam kết giao hàng tận nơi & Google Maps */}
                <div className="flex items-start gap-2 p-2.5 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-800 dark:text-sky-300 text-[11px] leading-relaxed mt-2">
                  <Info className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400 shrink-0 mt-0.5" />
                  <span>
                    <strong>Cam kết giao hàng chuẩn xác:</strong> Tọa độ bản đồ dùng để tính cước phí. Khi giao hàng, shipper sẽ điều hướng qua <strong>Google Maps</strong> theo đúng số nhà và địa chỉ chi tiết bạn đã nhập.
                  </span>
                </div>
              </div>
              <div className="space-y-2.5">
                <Label className="text-[13px] font-semibold text-foreground/80">Loại địa chỉ (Giao giờ hành chính hay nhà riêng?)</Label>
                <div className="flex flex-wrap items-center gap-3">
                  <Button type="button" variant={formData.type === 'home' ? 'default' : 'outline'} className="rounded-xl flex-1 min-w-[110px] h-10 border-border/60" onClick={() => setFormData({...formData, type: 'home'})}>
                    <Image src="/icons/home1.png" alt="Home" width={20} height={20} /> Nhà riêng
                  </Button>
                  <Button type="button" variant={formData.type === 'office' ? 'default' : 'outline'} className="rounded-xl flex-1 min-w-[110px] h-10 border-border/60" onClick={() => setFormData({...formData, type: 'office'})}>
                    <Image src="/icons/office.png" alt="Office" width={20} height={20} /> Văn phòng
                  </Button>
                  <Button type="button" variant={formData.type === 'other' ? 'default' : 'outline'} className="rounded-xl flex-1 min-w-[110px] h-10 border-border/60" onClick={() => setFormData({...formData, type: 'other'})}>
                    <Image src="/icons/pin.png" alt="Other" width={20} height={20} /> Khác
                  </Button>
                </div>
              </div>
              <div className="flex items-center space-x-3 pt-2 pb-2">
                <Checkbox 
                  id="is_default" 
                  checked={formData.is_default} 
                  onCheckedChange={(c) => setFormData({...formData, is_default: !!c})}
                  className="rounded-md data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                />
                <Label htmlFor="is_default" className="cursor-pointer font-medium text-sm select-none">Đặt làm địa chỉ mặc định</Label>
              </div>
              <DialogFooter className="px-6 py-4 bg-muted/20 border-t border-border/50 -mx-6 -mb-4 sm:justify-end">
                <Button type="submit" disabled={isSubmitting} className="rounded-xl px-8 shadow-sm">
                  {isSubmitting ? <IconLoader2 className="size-4 mr-2 animate-spin" /> : null}
                  {formData.id ? "Lưu Thay Đổi" : "Thêm Địa Chỉ"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {addresses.length === 0 ? (
        <div className="text-center py-16 bg-card/60 backdrop-blur-xl rounded-[24px] border border-border/50 shadow-sm flex flex-col items-center justify-center">
          <div className="size-20 bg-primary/10 rounded-full flex items-center justify-center mb-5 ring-8 ring-primary/5">
            <IconMapPinFilled className="size-10 text-primary opacity-80" />
          </div>
          <h3 className="text-xl font-bold text-foreground">Chưa Có Địa Chỉ Nào</h3>
          <p className="text-muted-foreground mt-2 max-w-md mx-auto">Bạn hãy thêm địa chỉ giao hàng để chúng tôi có thể giao sản phẩm đến tận tay bạn một cách nhanh nhất nhé.</p>
          <Button onClick={handleOpenAdd} className="mt-6 rounded-full px-8 shadow-md shadow-primary/20">
            <IconPlus className="size-4 mr-2" /> Thêm Ngay
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {addresses.map((addr) => (
            <div key={addr.id} className={`group flex flex-col p-6 rounded-[24px] border transition-all duration-300 relative overflow-hidden ${addr.is_default ? 'bg-primary/10 border-2 border-primary/100  shadow-xl ' : 'bg-card/60 backdrop-blur-xl border-border/50 shadow-xs hover:shadow-md hover:border-border'}`}>
              
              {addr.is_default && (
                <div className="absolute top-4 right-4">
                  <span className="inline-flex items-center gap-1.5 px-2 sm:px-3 py-1 text-[11px] font-bold tracking-wide uppercase rounded-full bg-primary text-primary-foreground shadow-sm">
                    <IconMapPinFilled className="size-3" />
                    <span className="hidden sm:inline">Mặc định</span>
                  </span>
                </div>
              )}
              
              <div className="flex-1 ">
                <div className="flex flex-wrap items-center gap-1 sm:gap-3 mb-1">
                  <h3 className="font-bold text-lg text-foreground">{addr.full_name}</h3>
                  {addr.type === 'home' && <span className="flex items-center gap-1 text-[10px] bg-sky-200 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300 font-bold px-2 py-0.5 rounded-full shadow-sm"><Image src="/icons/home1.png" alt="Home" width={12} height={12} /> Nhà riêng</span>}
                  {addr.type === 'office' && <span className="flex items-center gap-1 text-[10px] bg-emerald-200 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 font-bold px-2 py-0.5 rounded-full shadow-sm"><Image src="/icons/office.png" alt="Office" width={12} height={12} /> Văn phòng</span>}
                  {addr.type === 'other' && <span className="flex items-center gap-1 text-[10px] bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300 font-bold px-2 py-0.5 rounded-full shadow-sm"><Image src="/icons/pin.png" alt="Other" width={12} height={12} /> Khác</span>}
                </div>
                <div className="flex items-center gap-2  mb-2 text-sm font-bold">
                  <span className="text-gray-400 font-normal ">SĐT:</span>
                  <span>{addr.phone}</span>
                </div>
                
                <div className="flex items-start gap-2 text-[14px] text-foreground/80 leading-relaxed">
                  <span className="text-muted-foreground opacity-70 shrink-0">Địa chỉ:</span>
                  <div className="space-y-1 font-bold">
                    <p>{addr.street} - {addr.city}</p>
                  </div>
                </div>

                <div className="mt-2.5 flex items-center gap-2">
                  <a
                    href={getGoogleMapsUrl({
                      lat: addr.latitude,
                      lng: addr.longitude,
                      address: `${addr.street}, ${addr.city}`,
                      mode: "search",
                    })}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs text-sky-600 hover:text-sky-700 dark:text-sky-400 dark:hover:text-sky-300 font-semibold hover:underline"
                    title="Mở Google Maps để xem vị trí trên bản đồ"
                  >
                    <ExternalLink className="size-3.5" />
                    <span>Xem trên Google Maps</span>
                  </a>
                </div>
              </div>

              <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border/40">
                <Button variant="outline" size="sm" className="rounded-xl flex-1 border-border/60 hover:bg-muted/50" onClick={() => handleOpenEdit(addr)}>
                  <IconEdit className="size-4 mr-2 text-foreground/70" /> Sửa
                </Button>
                <Button variant="outline" size="sm" className="rounded-xl flex-1 border-border/60 hover:bg-red-50 hover:text-red-600 hover:border-red-200 dark:hover:bg-red-950/30 dark:hover:border-red-900" onClick={() => setDeleteModalId(addr.id)}>
                  <IconTrash className="size-4 mr-2" /> Xóa
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Xác nhận xóa địa chỉ */}
      <Dialog open={!!deleteModalId} onOpenChange={(open) => { if (!open) setDeleteModalId(null); }}>
        <DialogContent className="sm:max-w-md p-0 rounded-[24px] overflow-hidden border-border/50 text-center animate__animated animate__bounceIn">
          <div className="pt-8 pb-6 px-6">
            <div className="size-16 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-500 rounded-full flex items-center justify-center mx-auto mb-5 ring-8 ring-red-50 dark:ring-red-950/50">
              <IconTrash className="size-8" />
            </div>
            <DialogTitle className="text-xl font-bold mb-2">Xác Nhận Xóa Địa Chỉ?</DialogTitle>
            <p className="text-[14.5px] text-muted-foreground leading-relaxed">
              Địa chỉ này sẽ bị xóa vĩnh viễn khỏi sổ địa chỉ của bạn. Hành động này không thể hoàn tác.
            </p>
          </div>
          <DialogFooter className="flex flex-col sm:flex-row gap-3 px-6 py-4 bg-muted/30 border-t border-border/50 sm:justify-center">
            <Button variant="outline" className="sm:flex-1 rounded-xl h-11" onClick={() => setDeleteModalId(null)}>Hủy Bỏ</Button>
            <Button variant="destructive" className="sm:flex-1 rounded-xl h-11 font-bold shadow-md shadow-destructive/20" disabled={deleting} onClick={confirmDelete}>
              {deleting ? <IconLoader2 className="size-5 animate-spin mr-2" /> : null} Xóa Ngay
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Modal Chọn vị trí trên bản đồ */}
      <AddressMapPickerModal
        open={isMapOpen}
        onOpenChange={setIsMapOpen}
        initialCoords={
          formData.latitude && formData.longitude
            ? { lat: formData.latitude, lng: formData.longitude }
            : null
        }
        initialStreet={formData.street}
        initialCity={formData.city}
        onConfirm={(result) => {
          setFormData((prev) => ({
            ...prev,
            street: result.street || prev.street,
            city: result.city || prev.city,
            latitude: result.lat,
            longitude: result.lng,
          }));
        }}
      />

      {/* Modal Chọn cơ sở đối với các trường / địa điểm nhiều chi nhánh */}
      <BranchSelectorModal
        isOpen={isBranchModalOpen}
        onClose={() => setIsBranchModalOpen(false)}
        poiName={multiBranchPoiName}
        cityName={formData.city || "TP.HCM"}
        branches={availableBranches}
        onSelectBranch={handleSelectBranch}
        onOpenMapPicker={() => setIsMapOpen(true)}
      />
    </div>
  );
}
