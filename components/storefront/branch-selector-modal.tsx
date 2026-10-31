"use client";

import React, { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BranchOption } from "@/lib/services/shipping.service";
import { Building2, MapPin, ChevronRight, Search, X, Check } from "lucide-react";
import Image from "next/image";

interface BranchSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  poiName: string;
  cityName: string;
  branches: BranchOption[];
  onSelectBranch: (branch: BranchOption) => void;
  calculateDistanceKm?: (coords: { lat: number; lng: number }) => number;
  onOpenMapPicker?: () => void;
}

export function BranchSelectorModal({
  isOpen,
  onClose,
  poiName,
  cityName,
  branches,
  onSelectBranch,
  calculateDistanceKm,
  onOpenMapPicker,
}: BranchSelectorModalProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDistrict, setSelectedDistrict] = useState<string>("all");

  const handleBranchClick = (branch: BranchOption) => {
    onSelectBranch(branch);
    onClose();
  };

  // Danh sách các quận / huyện / vùng duy nhất từ danh sách cơ sở
  const districtList = useMemo(() => {
    if (!branches) return [];
    const set = new Set<string>();
    branches.forEach((b) => {
      if (b.district?.trim()) set.add(b.district.trim());
    });
    return Array.from(set);
  }, [branches]);

  // Lọc cơ sở theo từ khóa tìm kiếm và quận/huyện
  const filteredBranches = useMemo(() => {
    if (!branches) return [];
    const term = searchTerm.trim().toLowerCase();

    return branches.filter((branch) => {
      // 1. Lọc theo quận/huyện
      if (selectedDistrict !== "all" && branch.district !== selectedDistrict) {
        return false;
      }

      // 2. Lọc theo từ khóa tìm kiếm (tên cơ sở, tên đường, tên quận, tên hiển thị)
      if (term) {
        const fullText = `${branch.branchName} ${branch.street} ${branch.district || ""} ${branch.displayName}`.toLowerCase();
        return fullText.includes(term);
      }

      return true;
    });
  }, [branches, searchTerm, selectedDistrict]);

  if (!branches || branches.length === 0) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        showCloseButton={false}
        className="w-[calc(100%-1.5rem)] sm:max-w-[620px] max-h-[88vh] p-0 rounded-[24px] sm:rounded-[28px] overflow-hidden border border-border/60 shadow-2xl flex flex-col bg-background"
      >
        {/* Header với nhận diện thương hiệu sang trọng */}
        <DialogHeader className="px-5 sm:px-6 pt-5 sm:pt-6 pb-3.5 bg-muted/30 border-b border-border/50 text-left shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0 shadow-2xs">
                <Building2 className="w-5 h-5 text-primary" />
              </div>
              <div className="min-w-0 pr-2">
                <DialogTitle className="text-base sm:text-lg font-bold text-foreground truncate">
                  Chọn cơ sở giao hàng chính xác
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                  Địa điểm <strong className="text-foreground">{poiName}</strong> có <strong className="text-primary">{branches.length} cơ sở</strong> tại {cityName || "khu vực"}.
                </DialogDescription>
              </div>
            </div>

            {/* Nút đóng tinh tế tích hợp ngay trong header, không bị chèn đè lên chữ */}
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer shrink-0"
              title="Đóng"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Ô tìm kiếm nhanh cơ sở / tên đường */}
          <div className="relative mt-3">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Tìm theo tên cơ sở, đường, quận huyện (vd: Cơ sở B, 3/2, Quận 10...)"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-10 pl-9 pr-9 text-xs sm:text-sm bg-background border-border/60 rounded-xl focus-visible:ring-1 focus-visible:ring-primary shadow-xs"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Bộ lọc nhanh theo Vùng / Quận Huyện (Filter Pills) - Ẩn thanh cuộn xấu */}
          {districtList.length > 1 && (
            <div className="flex items-center gap-1.5 overflow-x-auto pt-2.5 pb-0.5 hide-scrollbar [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
              <button
                type="button"
                onClick={() => setSelectedDistrict("all")}
                className={`text-[11px] px-3 py-1 rounded-full font-medium transition-all shrink-0 cursor-pointer ${selectedDistrict === "all"
                    ? "bg-primary text-primary-foreground shadow-xs font-semibold"
                    : "bg-muted/70 hover:bg-muted text-muted-foreground hover:text-foreground border border-border/40"
                  }`}
              >
                Tất cả ({branches.length})
              </button>
              {districtList.map((dist) => {
                const count = branches.filter((b) => b.district === dist).length;
                const isSelected = selectedDistrict === dist;
                return (
                  <button
                    key={dist}
                    type="button"
                    onClick={() => setSelectedDistrict(dist)}
                    className={`text-[11px] px-2.5 py-1 rounded-full font-medium transition-all shrink-0 cursor-pointer ${isSelected
                        ? "bg-primary text-primary-foreground shadow-xs font-semibold"
                        : "bg-muted/70 hover:bg-muted text-muted-foreground hover:text-foreground border border-border/40"
                      }`}
                  >
                    {dist} ({count})
                  </button>
                );
              })}
            </div>
          )}
        </DialogHeader>

        {/* Danh sách các cơ sở để chọn - Bảo đảm không tràn ngang */}
        <div className="px-4 sm:px-6 py-4 space-y-2.5 max-h-[50vh] overflow-y-auto overflow-x-hidden min-h-0 flex-1">
          {filteredBranches.length === 0 ? (
            <div className="text-center py-8 px-4 space-y-2 text-muted-foreground">
              <Building2 className="w-8 h-8 mx-auto opacity-30" />
              <p className="text-xs">Không tìm thấy cơ sở nào khớp với tìm kiếm của bạn.</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearchTerm("");
                  setSelectedDistrict("all");
                }}
                className="text-xs h-8 rounded-lg mt-1 cursor-pointer"
              >
                Xem tất cả ({branches.length}) cơ sở
              </Button>
            </div>
          ) : (
            filteredBranches.map((branch, idx) => {
              const distance = calculateDistanceKm ? calculateDistanceKm(branch.coords) : null;

              return (
                <div
                  key={idx}
                  role="button"
                  tabIndex={0}
                  onClick={() => handleBranchClick(branch)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      handleBranchClick(branch);
                    }
                  }}
                  className="group relative p-3 sm:p-3.5 rounded-2xl border border-border/60 hover:border-primary/60 bg-card hover:bg-primary/[0.03] transition-all duration-200 cursor-pointer shadow-2xs hover:shadow-md flex items-center justify-between gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <div className="flex items-start gap-2.5 sm:gap-3 min-w-0 flex-1">
                    <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5 group-hover:bg-primary group-hover:text-primary-foreground transition-all duration-200 shadow-2xs">
                      <Image unoptimized src="/icons/map.png" alt="GPS" width={20} height={20} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-bold text-xs sm:text-sm text-foreground group-hover:text-primary transition-colors line-clamp-1">
                          {branch.branchName}
                        </span>
                        {branch.district && (
                          <span className="text-[10px] font-semibold text-primary/90 bg-primary/10 border border-primary/20 px-1.5 py-0.5 rounded-md whitespace-nowrap">
                            {branch.district}
                          </span>
                        )}
                        {distance !== null && (
                          <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-500/15 border border-emerald-500/25 px-1.5 py-0.5 rounded-full whitespace-nowrap">
                            ~{distance} km từ kho
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] sm:text-xs text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
                        {branch.street}{branch.district ? `, ${branch.district}` : ""}{branch.city ? `, ${branch.city}` : ""}
                      </p>
                    </div>
                  </div>

                  <div className="shrink-0 flex items-center gap-1 ml-1 sm:ml-2">
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-primary bg-primary/10 group-hover:bg-primary group-hover:text-primary-foreground px-2.5 py-1.5 rounded-xl border border-primary/20 transition-all shadow-2xs whitespace-nowrap">
                      <Check className="w-3 h-3 shrink-0" />
                      <span>Chọn</span>
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-4 sm:px-6 py-3 bg-muted/20 border-t border-border/50 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          {onOpenMapPicker ? (
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenMapPicker();
              }}
              className="text-xs text-primary hover:underline font-semibold flex items-center gap-1.5 cursor-pointer"
            >
              <MapPin className="w-3.5 h-3.5 shrink-0" />
              <span>Không có cơ sở của bạn? Tự ghim trên bản đồ</span>
            </button>
          ) : (
            <div />
          )}

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="rounded-xl text-xs h-8 px-4 text-muted-foreground hover:text-foreground cursor-pointer"
          >
            Đóng
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
