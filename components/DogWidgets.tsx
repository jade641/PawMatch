import { Check, ChevronDown, Eye, FileText, MapPin, Send, Star, Stethoscope, Syringe, X } from "lucide-react-native";
import { useRef, useState } from "react";
import { ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";
import { capitalize, DOC_TYPES, FONT, FONT_BOLD, FONT_MEDIUM, formatAge, ON_PHOTO_TEXT, shadow, T } from "../constants/theme";
import { avatarUrl } from "../services/api";
import { BREEDS, canonicalBreed, TEMPERAMENT_OPTIONS } from "../services/compatibility";
import type { Dog, RankedMatch } from "../types";
import { Avatar, Chip, DogImage, ScoreBar, Tag, VeriBadge } from "./ui";

/** Photo height shared by every match card so all dog photos line up. */
export const MATCH_PHOTO_HEIGHT = 190;

/* ── Breed autocomplete ─────────────────────────────────────────── */
export function BreedInput({
  value,
  onChange,
  placeholder = "e.g. Shih Tzu, Aspin, Golden Retriever",
  error,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  error?: string;
}) {
  const [focused, setFocused] = useState(false);
  const query = value.trim().toLowerCase();
  const suggestions =
    focused && query.length > 0
      ? BREEDS.filter((b) => b.toLowerCase().includes(query) && b.toLowerCase() !== query).slice(0, 6)
      : [];

  return (
    <View style={{ marginBottom: 14 }}>
      <TextInput
        value={value}
        onChangeText={onChange}
        onFocus={() => setFocused(true)}
        onBlur={() => setTimeout(() => setFocused(false), 150)}
        onEndEditing={() => value.trim() && onChange(canonicalBreed(value))}
        placeholder={placeholder}
        placeholderTextColor={T.light}
        accessibilityLabel="Breed"
        style={{
          minHeight: 48,
          borderWidth: 1,
          borderColor: error ? T.error : T.border,
          borderRadius: 12,
          paddingHorizontal: 14,
          fontSize: 15,
          color: T.dark,
          backgroundColor: T.white,
          fontFamily: FONT,
        }}
      />
      {suggestions.length > 0 && (
        <View style={{ marginTop: 4, borderRadius: 12, borderWidth: 1, borderColor: T.border, backgroundColor: T.white, overflow: "hidden" }}>
          {suggestions.map((b) => (
            <TouchableOpacity
              key={b}
              onPress={() => {
                onChange(b);
                setFocused(false);
              }}
              style={{ paddingHorizontal: 14, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: T.bg }}
            >
              <Text style={{ fontFamily: FONT, color: T.dark }}>{b}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
      {error ? <Text style={{ fontSize: 12, color: T.error, marginTop: 4, fontFamily: FONT }}>{error}</Text> : null}
    </View>
  );
}

/* ── Color combobox ─────────────────────────────────────────────── */
type ColorOption = { name: string; hex: string; searchTerms: string[] };

export const COLOR_OPTIONS: ColorOption[] = [
  { name: "Black", hex: "#1A1A1A", searchTerms: ["black"] },
  { name: "White", hex: "#FFFFFF", searchTerms: ["white"] },
  { name: "Brown / Chocolate", hex: "#5C3A21", searchTerms: ["brown", "chocolate"] },
  { name: "Liver", hex: "#4A2C2A", searchTerms: ["liver"] },
  { name: "Red", hex: "#A0442A", searchTerms: ["red"] },
  { name: "Mahogany / Rust", hex: "#8B3A1E", searchTerms: ["mahogany", "rust"] },
  { name: "Fawn", hex: "#D9B382", searchTerms: ["fawn"] },
  { name: "Cream", hex: "#F3E5C0", searchTerms: ["cream"] },
  { name: "Buff", hex: "#E0C08A", searchTerms: ["buff"] },
  { name: "Yellow", hex: "#E6C35C", searchTerms: ["yellow"] },
  { name: "Golden", hex: "#D99A2B", searchTerms: ["golden"] },
  { name: "Apricot", hex: "#F0B27A", searchTerms: ["apricot"] },
  { name: "Tan", hex: "#C9A27A", searchTerms: ["tan"] },
  { name: "Wheaten", hex: "#E8D3A2", searchTerms: ["wheaten"] },
  { name: "Orange", hex: "#E9822B", searchTerms: ["orange"] },
  { name: "Gray", hex: "#8A8D91", searchTerms: ["gray", "grey"] },
  { name: "Silver", hex: "#C0C4C8", searchTerms: ["silver"] },
  { name: "Charcoal", hex: "#36393D", searchTerms: ["charcoal"] },
  { name: "Blue", hex: "#5B6F86", searchTerms: ["blue"] },
  { name: "Lilac / Isabella", hex: "#A99A9F", searchTerms: ["lilac", "isabella"] },
  { name: "Champagne", hex: "#EBD9B4", searchTerms: ["champagne"] },
  { name: "Brindle", hex: "#6B4F3A", searchTerms: ["brindle"] },
  { name: "Tricolor", hex: "gradient", searchTerms: ["tricolor", "tri"] },
  { name: "Mixed / Multiple colors", hex: "gradient", searchTerms: ["mixed", "multiple", "colors"] },
  { name: "Other", hex: "other", searchTerms: ["other"] },
];

function ColorSwatch({ hex, size = 16 }: { hex: string; size?: number }) {
  if (hex === "gradient") {
    return (
      <View style={{ width: size, height: size, borderRadius: size / 2, overflow: "hidden", flexDirection: "row" }}>
        <View style={{ flex: 1, backgroundColor: "#8B4513" }} />
        <View style={{ flex: 1, backgroundColor: "#FFFFFF" }} />
      </View>
    );
  }
  if (hex === "other") {
    return (
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: 1.5,
          borderColor: T.medium,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text style={{ fontSize: size * 0.6, color: T.medium, fontWeight: "600" }}>?</Text>
      </View>
    );
  }
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: hex,
        borderWidth: hex === "#FFFFFF" ? 1 : 0,
        borderColor: T.border,
      }}
    />
  );
}

/** Searchable color picker. `value` is the stored color text; "Other" reveals a free-text field. */
export function ColorCombobox({
  value,
  onChange,
  placeholder = "Select or search color",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchText, setSearchText] = useState("");
  const inputRef = useRef<TextInput>(null);
  const known = COLOR_OPTIONS.find((o) => o.name === value && o.name !== "Other");
  const [otherMode, setOtherMode] = useState(!!value && !known);

  const filtered = COLOR_OPTIONS.filter((option) => {
    const q = searchText.trim().toLowerCase();
    if (!q) return true;
    return option.searchTerms.some((t) => t.includes(q)) || option.name.toLowerCase().includes(q);
  });

  const select = (option: ColorOption) => {
    setSearchText("");
    setIsOpen(false);
    if (option.name === "Other") {
      setOtherMode(true);
      onChange("");
    } else {
      setOtherMode(false);
      onChange(option.name);
    }
  };

  const clear = () => {
    onChange("");
    setOtherMode(false);
    setSearchText("");
    setIsOpen(false);
  };

  const shown = otherMode ? "Other" : value;

  return (
    <View style={{ gap: 8, zIndex: isOpen ? 1000 : 1, marginBottom: isOpen ? 290 : 14 }}>
      <View
        style={{
          borderRadius: 12,
          paddingHorizontal: 14,
          height: 48,
          backgroundColor: T.white,
          borderWidth: 1,
          borderColor: isOpen ? T.primary : T.border,
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
        }}
      >
        {known && !isOpen && <ColorSwatch hex={known.hex} size={20} />}
        <TextInput
          ref={inputRef}
          value={isOpen ? searchText : shown}
          onChangeText={(text) => {
            setSearchText(text);
            if (!isOpen) setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
          placeholderTextColor={T.light}
          accessibilityLabel="Color"
          style={{ flex: 1, fontSize: 15, color: T.dark, fontFamily: FONT }}
        />
        {shown ? (
          <TouchableOpacity
            onPress={clear}
            hitSlop={10}
            accessibilityRole="button" accessibilityLabel="Clear color"
            style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: T.medium, alignItems: "center", justifyContent: "center" }}
          >
            <X size={12} color="#fff" strokeWidth={2.5} />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            onPress={() => setIsOpen((o) => !o)}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={isOpen ? "Close color list" : "Open color list"}
          >
            <ChevronDown size={18} color={T.medium} strokeWidth={1.5} />
          </TouchableOpacity>
        )}
      </View>

      {isOpen && (
        <View
          style={{
            position: "absolute",
            top: 56,
            left: 0,
            right: 0,
            backgroundColor: T.white,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: T.border,
            maxHeight: 280,
            overflow: "hidden",
            zIndex: 1001,
            ...shadow,
            elevation: 8,
          }}
        >
          <ScrollView keyboardShouldPersistTaps="handled" nestedScrollEnabled contentContainerStyle={{ padding: 4 }}>
            {filtered.length === 0 ? (
              <Text style={{ padding: 18, textAlign: "center", color: T.medium, fontFamily: FONT }}>No matching color found</Text>
            ) : (
              filtered.map((option) => {
                const selected = option.name === shown;
                return (
                  <TouchableOpacity
                    key={option.name}
                    onPress={() => select(option)}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 12,
                      paddingHorizontal: 14,
                      paddingVertical: 12,
                      borderRadius: 10,
                      backgroundColor: selected ? T.primaryLight : "transparent",
                    }}
                  >
                    <ColorSwatch hex={option.hex} size={20} />
                    <Text style={{ flex: 1, fontSize: 14, color: T.dark, fontFamily: selected ? FONT_BOLD : FONT }}>
                      {option.name}
                    </Text>
                    {selected && <Check size={16} color={T.primary} strokeWidth={2.5} />}
                  </TouchableOpacity>
                );
              })
            )}
          </ScrollView>
        </View>
      )}

      {otherMode && !isOpen && (
        <TextInput
          value={value}
          onChangeText={onChange}
          placeholder="Describe the color, e.g. brindle-gray mix"
          placeholderTextColor={T.light}
          accessibilityLabel="Describe the color"
          style={{
            borderRadius: 12,
            paddingHorizontal: 14,
            height: 48,
            backgroundColor: T.white,
            borderWidth: 1,
            borderColor: T.border,
            fontSize: 15,
            color: T.dark,
            fontFamily: FONT,
          }}
        />
      )}
    </View>
  );
}

/* ── Temperament picker ─────────────────────────────────────────── */
export function TemperamentPicker({
  value,
  onChange,
  max = 3,
}: {
  value: string[];
  onChange: (v: string[]) => void;
  max?: number;
}) {
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
      {TEMPERAMENT_OPTIONS.map((t) => {
        const active = value.includes(t);
        return (
          <Chip
            key={t}
            label={t}
            active={active}
            disabled={!active && value.length >= max}
            onPress={() => onChange(active ? value.filter((x) => x !== t) : [...value, t])}
          />
        );
      })}
    </View>
  );
}

/* ── Trust indicators (Figure 10 / 12) ──────────────────────────── */
const DOC_ICONS = { vaccination: Syringe, health_clearance: Stethoscope, pedigree: FileText, dna: FileText };

export function TrustIndicators({ dog }: { dog: Dog }) {
  const docs = DOC_TYPES.filter((d) => d.type !== "dna" || dog.verified_docs.includes("dna"));
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
      {docs.map((d) => {
        const ok = dog.verified_docs.includes(d.type);
        const Icon = DOC_ICONS[d.type];
        return (
          <View key={d.type} style={{ flexDirection: "row", alignItems: "center", gap: 4, opacity: ok ? 1 : 0.45 }}>
            <Icon size={12} color={ok ? T.success : T.medium} strokeWidth={2} />
            <Text style={{ fontSize: 11, color: ok ? T.success : T.medium, fontFamily: FONT_MEDIUM }}>{d.short}</Text>
            {ok ? <Check size={12} color={T.success} strokeWidth={2.5} /> : <X size={11} color={T.medium} strokeWidth={2} />}
          </View>
        );
      })}
    </View>
  );
}

export function TemperamentTags({ traits }: { traits: string[] }) {
  if (traits.length === 0) return null;
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
      {traits.map((t) => (
        <Tag key={t} label={t} />
      ))}
    </View>
  );
}

export function OwnerLine({ dog }: { dog: Dog }) {
  if (!dog.owner) return null;
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
      <Avatar name={dog.owner.display_name} size={24} uri={avatarUrl(dog.owner.avatar_url)} />
      <Text style={{ fontSize: 12, color: T.medium, fontFamily: FONT, flexShrink: 1 }} numberOfLines={1}>
        {dog.owner.display_name} •{" "}
      </Text>
      <MapPin size={11} color={T.medium} strokeWidth={2} />
      <Text style={{ fontSize: 12, color: T.medium, fontFamily: FONT, flexShrink: 1 }} numberOfLines={1}>
        {dog.owner.location.split(",")[0]}
      </Text>
    </View>
  );
}

/* ── Match card (Figure 10 / 12) ────────────────────────────────── */
export function MatchCard({
  match,
  banner,
  onView,
  onRequest,
  width,
}: {
  match: RankedMatch;
  banner?: string;
  onView: () => void;
  onRequest: () => void;
  width?: number;
}) {
  const { dog, compatibility, reasons } = match;
  return (
    <View style={{ width, backgroundColor: T.white, borderRadius: 18, overflow: "hidden", ...shadow, elevation: 3 }}>
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={onView}
        accessibilityRole="button"
        accessibilityLabel={`${dog.name}, ${compatibility.total}% match. View profile`}
      >
        <DogImage uri={dog.img} width="100%" height={MATCH_PHOTO_HEIGHT} radius={0} />
        {/* A corner badge (not a strip) so every card shows the same, uncovered photo area. */}
        {banner ? (
          <View
            style={{
              position: "absolute",
              right: 12,
              top: 12,
              maxWidth: "58%",
              flexDirection: "row",
              alignItems: "center",
              gap: 5,
              paddingHorizontal: 10,
              paddingVertical: 5,
              borderRadius: 999,
              backgroundColor: T.secondary,
            }}
          >
            <Star size={12} color="#fff" fill="#fff" />
            <Text style={{ fontSize: 12, color: "#fff", fontFamily: FONT_BOLD, flexShrink: 1 }} numberOfLines={1}>
              {banner}
            </Text>
          </View>
        ) : null}
        <View
          style={{
            position: "absolute",
            left: 12,
            top: 12,
            paddingHorizontal: 10,
            paddingVertical: 5,
            borderRadius: 999,
            backgroundColor: "rgba(255,255,255,0.95)",
          }}
        >
          <Text style={{ fontSize: 12, color: ON_PHOTO_TEXT, fontFamily: FONT_BOLD }}>{compatibility.total}% match</Text>
        </View>
      </TouchableOpacity>
      <View style={{ padding: 14, gap: 9 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <Text style={{ fontSize: 18, color: T.dark, fontFamily: FONT_BOLD, flexShrink: 1 }} numberOfLines={1}>
            {dog.name}
          </Text>
          <VeriBadge tier={dog.tier} />
        </View>
        <Text style={{ fontSize: 13, color: T.medium, fontFamily: FONT }}>
          {dog.breed} • {formatAge(dog.age)} • {capitalize(dog.sex)}
        </Text>
        <TemperamentTags traits={dog.temperament} />
        <OwnerLine dog={dog} />
        <ScoreBar score={compatibility.total} showLabel />
        {reasons.length > 0 && (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            {reasons.map((r) => (
              <Tag key={r} label={r} tone="brand" />
            ))}
          </View>
        )}
        <TrustIndicators dog={dog} />
        <View style={{ flexDirection: "row", gap: 8, marginTop: 2 }}>
          <TouchableOpacity
            onPress={onRequest}
            accessibilityRole="button"
            accessibilityLabel={`Request a match with ${dog.name}`}
            style={{
              flex: 1,
              paddingVertical: 11,
              borderRadius: 12,
              backgroundColor: T.primary,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
            }}
          >
            <Send size={14} color="#fff" strokeWidth={2} />
            <Text style={{ fontSize: 13, color: "#fff", fontFamily: FONT_BOLD }}>Request Match</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={onView}
            accessibilityRole="button"
            accessibilityLabel={`View ${dog.name}'s profile`}
            style={{
              flex: 1,
              paddingVertical: 11,
              borderRadius: 12,
              borderWidth: 1.5,
              borderColor: T.primary,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
            }}
          >
            <Eye size={14} color={T.primary} strokeWidth={2} />
            <Text style={{ fontSize: 13, color: T.primary, fontFamily: FONT_BOLD }}>View Profile</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

/* ── "Matching for" selector ────────────────────────────────────── */
export function MyDogSelector({
  dogs,
  activeId,
  onSelect,
  label = "Matching for",
}: {
  dogs: Dog[];
  activeId: string | undefined;
  onSelect: (id: string) => void;
  label?: string;
}) {
  if (dogs.length === 0) return null;
  return (
    <View style={{ gap: 8 }}>
      <Text style={{ fontSize: 12, color: T.medium, fontFamily: FONT_MEDIUM }}>{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {dogs.map((d) => {
          const active = d.id === activeId;
          return (
            <TouchableOpacity
              key={d.id}
              onPress={() => onSelect(d.id)}
              accessibilityRole="button"
              accessibilityLabel={`${label}: ${d.name}, ${d.sex}`}
              accessibilityState={{ selected: active }}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                paddingRight: 14,
                paddingLeft: 4,
                paddingVertical: 4,
                borderRadius: 999,
                borderWidth: 1.5,
                borderColor: active ? T.primary : T.border,
                backgroundColor: active ? T.primaryLight : T.white,
              }}
            >
              <DogImage uri={d.img} width={30} height={30} radius={15} />
              <Text style={{ fontFamily: FONT_BOLD, fontSize: 13, color: active ? T.primaryDark : T.dark }}>{d.name}</Text>
              <Text style={{ fontFamily: FONT, fontSize: 12, color: T.medium }}>{d.sex === "male" ? "♂" : "♀"}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}
