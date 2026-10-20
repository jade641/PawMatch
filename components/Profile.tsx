import {
  ArrowLeft,
  Award,
  Bell,
  Calendar,
  Camera,
  Check,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Clock,
  Edit,
  FileCheck,
  FileText,
  HelpCircle,
  KeyRound,
  LogOut,
  Mars,
  MapPin,
  MessageCircle,
  MessageSquare,
  PawPrint,
  Plus,
  Ruler,
  Send,
  Settings,
  Smile,
  ShieldCheck,
  Star,
  Stethoscope,
  Trash2,
  Upload,
  User,
  Venus,
  X,
} from "lucide-react-native";
import { useMemo, useState } from "react";
import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import {
  capitalize,
  DOC_TYPES,
  FONT,
  FONT_BOLD,
  FONT_MEDIUM,
  formatAge,
  formatDate,
  shadow,
  SUBMISSION_STATUS,
  T,
  TIER_DESCRIPTIONS,
} from "../constants/theme";
import { useApp, useSession } from "../contexts/AppContext";
import { useAsync } from "../hooks/useAsync";
import * as api from "../services/api";
import { computeCompatibility, explainCompatibility } from "../services/compatibility";
import { pickImage, type PickedFile } from "../services/media";
import type { Dog, DocType, Sex, Size, Submission } from "../types";
import { BreedInput, ColorCombobox, MyDogSelector, TemperamentPicker, TemperamentTags, TrustIndicators } from "./DogWidgets";
import { CompatibilityBreakdownCard } from "./FloatingMatchResults";
import {
  Avatar,
  Btn,
  Card,
  confirmAction,
  DogImage,
  EmptyState,
  ErrorView,
  Field,
  Header,
  InfoRow,
  ListItem,
  Loading,
  ScoreBar,
  SectionTitle,
  showMessage,
  Stars,
  Tag,
  VeriBadge,
} from "./ui";

/* ── Shared pieces ──────────────────────────────────────────────── */
function TabBar<K extends string>({ tabs, value, onChange }: { tabs: [K, string, typeof FileText][]; value: K; onChange: (k: K) => void }) {
  return (
    <View
      style={{
        flexDirection: "row",
        marginHorizontal: 20,
        marginVertical: 16,
        borderRadius: 12,
        overflow: "hidden",
        borderWidth: 1,
        borderColor: T.border,
      }}
    >
      {tabs.map(([id, label, Icon]) => (
        <TouchableOpacity
          key={id}
          onPress={() => onChange(id)}
          accessibilityRole="tab"
          accessibilityState={{ selected: value === id }}
          style={{
            flex: 1,
            paddingVertical: 10,
            backgroundColor: value === id ? T.primary : T.white,
            alignItems: "center",
            flexDirection: "row",
            justifyContent: "center",
            gap: 6,
          }}
        >
          <Icon size={14} color={value === id ? "#fff" : T.medium} strokeWidth={1.6} />
          <Text style={{ fontSize: 12, color: value === id ? "#fff" : T.medium, fontFamily: FONT_BOLD }}>{label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

/** Newest submission per document type, except that a verified one always wins. Input is newest-first. */
function latestByType(submissions: Submission[]) {
  const map = new Map<DocType, Submission>();
  for (const s of submissions) {
    const current = map.get(s.submission_type);
    if (!current || (current.status !== "vet_verified" && s.status === "vet_verified")) {
      map.set(s.submission_type, s);
    }
  }
  return map;
}

function DogHeaderBlock({ dog }: { dog: Dog }) {
  return (
    <View style={{ alignItems: "center", paddingTop: 20, paddingBottom: 18, backgroundColor: T.white }}>
      <View>
        <DogImage uri={dog.img} width={112} height={112} radius={56} style={{ borderWidth: 4, borderColor: T.primary }} />
        <View style={{ position: "absolute", bottom: -6, alignSelf: "center" }}>
          <VeriBadge tier={dog.tier} />
        </View>
      </View>
      <Text style={{ fontSize: 23, marginTop: 14, color: T.dark, fontFamily: FONT_BOLD }}>{dog.name}</Text>
      <Text style={{ fontSize: 14, color: T.medium, fontFamily: FONT }}>
        {dog.breed} • {formatAge(dog.age)} • {capitalize(dog.sex)}
      </Text>
    </View>
  );
}

function BasicInfoCard({ dog }: { dog: Dog }) {
  return (
    <Card>
      <InfoRow label="Breed" value={dog.breed} />
      <InfoRow label="Age" value={formatAge(dog.age)} />
      <InfoRow label="Sex" value={capitalize(dog.sex)} />
      <InfoRow label="Size" value={capitalize(dog.size)} />
      <InfoRow label="Color" value={dog.color || "—"} />
      <InfoRow
        label="Rating"
        value={dog.reviews > 0 ? `${dog.rating.toFixed(1)} ★ (${dog.reviews})` : "No reviews yet"}
        last={dog.temperament.length === 0 && !dog.description}
      />
      {dog.temperament.length > 0 && (
        <View style={{ paddingTop: 10, gap: 8 }}>
          <Text style={{ fontSize: 14, color: T.medium, fontFamily: FONT }}>Temperament</Text>
          <TemperamentTags traits={dog.temperament} />
        </View>
      )}
      {dog.description ? (
        <View style={{ paddingTop: 12 }}>
          <Text style={{ fontSize: 14, color: T.medium, fontFamily: FONT, marginBottom: 4 }}>About</Text>
          <Text style={{ fontSize: 14, color: T.dark, fontFamily: FONT, lineHeight: 20 }}>{dog.description}</Text>
        </View>
      ) : null}
    </Card>
  );
}

function TierCard({ dog, onAudit }: { dog: Dog; onAudit: () => void }) {
  return (
    <View style={{ padding: 16, borderRadius: 16, backgroundColor: T.primaryLight, gap: 6 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <Award size={16} color={T.primaryDark} strokeWidth={1.75} />
        <Text style={{ fontSize: 14, color: T.primaryDark, fontFamily: FONT_BOLD }}>Verification Status</Text>
      </View>
      <Text style={{ fontSize: 14, color: T.dark, fontFamily: FONT_MEDIUM }}>{TIER_DESCRIPTIONS[dog.tier] ?? ""}</Text>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Text style={{ fontSize: 12, color: T.primaryDark, fontFamily: FONT }}>Trust score</Text>
        <View style={{ flex: 1 }}>
          <ScoreBar score={dog.score} showLabel />
        </View>
      </View>
      <TouchableOpacity onPress={onAudit} style={{ marginTop: 4 }}>
        <Text style={{ fontSize: 13, color: T.primaryDark, fontFamily: FONT_BOLD, textDecorationLine: "underline" }}>
          View Audit Trail →
        </Text>
      </TouchableOpacity>
    </View>
  );
}

/* ── My Dog profile (Figure 15) ─────────────────────────────────── */
export function DogProfile() {
  const { navigate, params, myDogs, dogsLoaded, reloadDogs, setActiveDogId, showToast, lastNotification } = useApp();
  const session = useSession();
  const [tab, setTab] = useState<"info" | "health" | "gallery">(params.tab ?? "info");
  const initialIndex = Math.max(0, myDogs.findIndex((d) => d.id === params.dogId));
  const [index, setIndex] = useState(initialIndex);
  const [busy, setBusy] = useState(false);
  const dog = myDogs[Math.min(index, myDogs.length - 1)];

  const submissions = useAsync(
    () => (dog ? api.listDogSubmissions(dog.id) : Promise.resolve([])),
    [dog?.id, lastNotification?.id],
  );

  if (!dogsLoaded) return <Loading />;
  if (!dog) {
    return (
      <View style={{ flex: 1, backgroundColor: T.bg }}>
        <Header title="My Dogs" icon={PawPrint} />
        <EmptyState
          icon={PawPrint}
          title="No dogs yet"
          message="Add your dog's profile with breed, age, sex and temperament to start receiving compatible matches."
          actionLabel="Add Dog Profile"
          onAction={() => navigate("add-dog")}
        />
      </View>
    );
  }

  const go = (next: number) => {
    setIndex(next);
    setActiveDogId(myDogs[next].id);
  };

  const addPhoto = async () => {
    const file = await pickImage(false);
    if (!file) return;
    setBusy(true);
    try {
      const url = await api.uploadDogPhoto(session.user.id, file.uri, file.mimeType);
      await api.updateDog(dog.id, dog.img ? { photos: [...dog.photos, url] } : { img: url });
      await reloadDogs();
      showToast("Photo added", undefined, "success");
    } catch (e) {
      showMessage("Upload failed", api.errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const removePhoto = (url: string) =>
    confirmAction("Remove photo?", "This photo will be removed from the gallery.", "Remove", async () => {
      try {
        if (url === dog.img) {
          const [next, ...rest] = dog.photos;
          await api.updateDog(dog.id, { img: next ?? null, photos: rest });
        } else {
          await api.updateDog(dog.id, { photos: dog.photos.filter((p) => p !== url) });
        }
        await reloadDogs();
      } catch (e) {
        showMessage("Couldn't remove photo", api.errorMessage(e));
      }
    }, true);

  const makeMain = async (url: string) => {
    try {
      await api.updateDog(dog.id, { img: url, photos: [...(dog.img ? [dog.img] : []), ...dog.photos.filter((p) => p !== url)] });
      await reloadDogs();
    } catch (e) {
      showMessage("Couldn't update photo", api.errorMessage(e));
    }
  };

  const removeDog = () =>
    confirmAction(
      `Delete ${dog.name}?`,
      "This permanently deletes the profile, its verification documents and its match requests.",
      "Delete",
      async () => {
        try {
          await api.deleteDog(dog.id);
          await reloadDogs();
          setIndex(0);
          showToast(`${dog.name} was deleted`);
        } catch (e) {
          showMessage("Couldn't delete", api.errorMessage(e));
        }
      },
      true,
    );

  const byType = latestByType(submissions.data ?? []);
  const gallery = [dog.img, ...dog.photos].filter(Boolean) as string[];

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <Header
        title={`${dog.name}'s Profile`}
        icon={PawPrint}
        right={
          <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
            <TouchableOpacity onPress={() => index > 0 && go(index - 1)} disabled={index === 0} style={{ opacity: index === 0 ? 0.3 : 1 }} accessibilityRole="button" accessibilityLabel="Previous dog">
              <ChevronLeft size={22} color={T.dark} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => index < myDogs.length - 1 && go(index + 1)}
              disabled={index === myDogs.length - 1}
              style={{ opacity: index === myDogs.length - 1 ? 0.3 : 1 }}
              accessibilityRole="button" accessibilityLabel="Next dog"
            >
              <ChevronRight size={22} color={T.dark} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => navigate("edit-dog", { dogId: dog.id })} accessibilityRole="button" accessibilityLabel="Edit dog">
              <Edit size={20} color={T.dark} strokeWidth={1.6} />
            </TouchableOpacity>
          </View>
        }
      />

      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        {myDogs.length > 1 && (
          <View style={{ flexDirection: "row", justifyContent: "center", gap: 6, paddingTop: 12, backgroundColor: T.white }}>
            {myDogs.map((d, i) => (
              <TouchableOpacity
                key={d.id}
                onPress={() => go(i)}
                accessibilityRole="button" accessibilityLabel={`Show ${d.name}`}
                style={{ width: i === index ? 24 : 8, height: 8, borderRadius: 4, backgroundColor: i === index ? T.primary : T.border }}
              />
            ))}
          </View>
        )}
        <DogHeaderBlock dog={dog} />
        <TabBar
          tabs={[
            ["info", "Basic Info", FileText],
            ["health", "Health", Stethoscope],
            ["gallery", "Gallery", Camera],
          ]}
          value={tab}
          onChange={setTab}
        />

        {tab === "info" && (
          <View style={{ paddingHorizontal: 20, gap: 12 }}>
            <BasicInfoCard dog={dog} />
            <Btn title="Find matches for this dog" icon={Star} onPress={() => { setActiveDogId(dog.id); navigate("filter"); }} />
            <View style={{ flexDirection: "row", gap: 10 }}>
              <Btn title="Add another dog" icon={Plus} variant="outline" onPress={() => navigate("add-dog")} style={{ flex: 1 }} />
              <Btn title="Delete" icon={Trash2} variant="danger" onPress={removeDog} />
            </View>
          </View>
        )}

        {tab === "health" && (
          <View style={{ paddingHorizontal: 20, gap: 12 }}>
            {submissions.loading ? (
              <Loading />
            ) : submissions.error ? (
              <ErrorView message={submissions.error} onRetry={() => submissions.reload()} />
            ) : (
              DOC_TYPES.map((d) => {
                const s = byType.get(d.type);
                return (
                  <Card key={d.type} style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                    <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: T.primaryLight, alignItems: "center", justifyContent: "center" }}>
                      <FileCheck size={17} color={T.primary} strokeWidth={1.6} />
                    </View>
                    <View style={{ flex: 1, gap: 3 }}>
                      <Text style={{ fontSize: 14, color: T.dark, fontFamily: FONT_BOLD }}>{d.label}</Text>
                      {s?.status === "vet_verified" && (
                        <Text style={{ fontSize: 12, color: T.medium, fontFamily: FONT }}>
                          Verified by {s.verifier_name} • {formatDate(s.reviewed_at)}
                        </Text>
                      )}
                      {s?.status === "owner_submitted" && (
                        <Text style={{ fontSize: 12, color: T.medium, fontFamily: FONT }}>With {s.verifier_name} for review</Text>
                      )}
                      {s?.status === "verification_failed" && (
                        <Text style={{ fontSize: 12, color: T.error, fontFamily: FONT }}>Remarks: {s.notes}</Text>
                      )}
                    </View>
                    {s && s.status !== "verification_failed" ? (
                      <Tag label={SUBMISSION_STATUS[s.status].label} tone={SUBMISSION_STATUS[s.status].tone} />
                    ) : (
                      <TouchableOpacity
                        onPress={() => navigate("verify-upload", { dogId: dog.id, type: d.type })}
                        style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, backgroundColor: T.primaryLight }}
                      >
                        <Upload size={12} color={T.primaryDark} strokeWidth={2} />
                        <Text style={{ fontSize: 12, color: T.primaryDark, fontFamily: FONT_BOLD }}>
                          {s ? "Re-upload" : "Upload"}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </Card>
                );
              })
            )}
            <TierCard dog={dog} onAudit={() => navigate("audit-trail", { dogId: dog.id })} />
          </View>
        )}

        {tab === "gallery" && (
          <View style={{ paddingHorizontal: 20 }}>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
              {gallery.map((url) => (
                <View key={url} style={{ width: "31%" }}>
                  <TouchableOpacity onPress={() => url !== dog.img && makeMain(url)} activeOpacity={0.8}>
                    <DogImage uri={url} width="100%" height={104} />
                  </TouchableOpacity>
                  {url === dog.img && (
                    <View style={{ position: "absolute", left: 6, bottom: 6 }}>
                      <Tag label="Profile" tone="brand" />
                    </View>
                  )}
                  <TouchableOpacity
                    onPress={() => removePhoto(url)}
                    accessibilityRole="button" accessibilityLabel="Remove photo"
                    style={{ position: "absolute", right: 4, top: 4, width: 22, height: 22, borderRadius: 11, backgroundColor: "rgba(0,0,0,0.55)", alignItems: "center", justifyContent: "center" }}
                  >
                    <X size={13} color="#fff" />
                  </TouchableOpacity>
                </View>
              ))}
              <TouchableOpacity
                onPress={addPhoto}
                disabled={busy}
                style={{
                  width: "31%",
                  height: 104,
                  borderRadius: 12,
                  backgroundColor: T.primaryLight,
                  borderWidth: 2,
                  borderColor: T.primary + "60",
                  borderStyle: "dashed",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 4,
                }}
              >
                {busy ? <Text style={{ color: T.primary, fontFamily: FONT }}>Uploading…</Text> : <Plus size={24} color={T.primary} strokeWidth={1.5} />}
              </TouchableOpacity>
            </View>
            <Text style={{ fontSize: 12, color: T.medium, fontFamily: FONT, marginTop: 12 }}>
              Tap a photo to make it the profile photo.
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

/* ── Add / Edit dog ─────────────────────────────────────────────── */
function DogForm({ existing }: { existing?: Dog }) {
  const { goBack, replace, reloadDogs, setActiveDogId, showToast } = useApp();
  const session = useSession();
  const [form, setForm] = useState({
    name: existing?.name ?? "",
    breed: existing?.breed ?? "",
    age: existing ? String(existing.age) : "",
    sex: (existing?.sex ?? "female") as Sex,
    size: (existing?.size ?? "medium") as Size,
    color: existing?.color ?? "",
    temperament: existing?.temperament ?? [],
    description: existing?.description ?? "",
  });
  const [photo, setPhoto] = useState<PickedFile | null>(null);
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => setForm((f) => ({ ...f, [key]: value }));

  const choosePhoto = async () => {
    const file = await pickImage(true);
    if (file) setPhoto(file);
  };

  const submit = async () => {
    const age = Number(form.age.replace(",", "."));
    const e: Record<string, string | undefined> = {};
    if (!form.name.trim()) e.name = "Enter your dog's name";
    if (!form.breed.trim()) e.breed = "Enter the breed (use Aspin or Mixed Breed if unsure)";
    if (!form.age.trim() || Number.isNaN(age) || age < 0 || age > 25) e.age = "Enter an age between 0 and 25 years";
    if (!form.color.trim()) e.color = "Choose a color";
    if (form.temperament.length === 0) e.temperament = "Pick at least one temperament trait";
    setErrors(e);
    if (Object.values(e).some(Boolean)) {
      showMessage("Check the form", Object.values(e).filter(Boolean)[0]);
      return;
    }

    setSaving(true);
    try {
      let img = existing?.img ?? null;
      let photos = existing?.photos ?? [];
      if (photo) {
        const url = await api.uploadDogPhoto(session.user.id, photo.uri, photo.mimeType);
        if (img) photos = [img, ...photos];
        img = url;
      }
      const input = {
        name: form.name.trim(),
        breed: form.breed.trim(),
        age: Math.round(age * 10) / 10,
        sex: form.sex,
        size: form.size,
        color: form.color.trim(),
        temperament: form.temperament,
        description: form.description.trim(),
        img,
        photos,
      };
      const dog = existing ? await api.updateDog(existing.id, input) : await api.createDog(input);
      await reloadDogs();
      setActiveDogId(dog.id);
      if (!existing) api.notifyCompatibleMatches(dog.id);
      showToast(existing ? "Profile updated" : `${dog.name} was added`, existing ? undefined : "Verify their documents to earn a trust badge.", "success");
      replace("dog-profile", { dogId: dog.id });
    } catch (err) {
      showMessage("Couldn't save", api.errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const preview = photo?.uri ?? existing?.img ?? null;
  const insets = useSafeAreaInsets();

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: T.bg }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        {/* Hero header */}
        <View style={{ paddingTop: Math.max(insets.top, 16) + 8, paddingBottom: 84, paddingHorizontal: 20, overflow: "hidden", borderBottomLeftRadius: 28, borderBottomRightRadius: 28 }}>
          <LinearGradient colors={[T.primary, T.primaryDark]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} />
          <View style={{ position: "absolute", width: 200, height: 200, borderRadius: 100, backgroundColor: "rgba(255,255,255,0.08)", top: -60, right: -50 }} />
          <PawPrint size={22} color="#fff" style={{ position: "absolute", bottom: 40, left: 36, opacity: 0.18, transform: [{ rotate: "-20deg" }] }} />
          <PawPrint size={18} color="#fff" style={{ position: "absolute", bottom: 60, right: 50, opacity: 0.18, transform: [{ rotate: "20deg" }] }} />

          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <TouchableOpacity
              onPress={goBack}
              accessibilityRole="button"
              accessibilityLabel="Back"
              hitSlop={8}
              style={{ width: 40, height: 40, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.22)", alignItems: "center", justifyContent: "center" }}
            >
              <ArrowLeft size={20} color="#fff" strokeWidth={2.5} />
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 22, color: "#fff", fontFamily: FONT_BOLD, letterSpacing: -0.3 }} numberOfLines={1}>
                {existing ? `Edit ${existing.name}` : "Add New Dog"}
              </Text>
              <Text style={{ fontSize: 13, color: "rgba(255,255,255,0.85)", fontFamily: FONT, marginTop: 2 }}>
                {existing ? "Keep your dog's profile up to date" : "Tell us about your furry friend"}
              </Text>
            </View>
          </View>
        </View>

        {/* Photo picker overlapping the hero */}
        <View style={{ alignItems: "center", marginTop: -64, marginBottom: 20 }}>
          <TouchableOpacity onPress={choosePhoto} activeOpacity={0.85} accessibilityRole="button" accessibilityLabel="Choose dog photo">
            <View
              style={{
                width: 128,
                height: 128,
                borderRadius: 40,
                backgroundColor: T.white,
                padding: 5,
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 10 },
                shadowOpacity: 0.12,
                shadowRadius: 20,
                elevation: 8,
              }}
            >
              {preview ? (
                <DogImage uri={preview} width={118} height={118} radius={35} />
              ) : (
                <View
                  style={{
                    flex: 1,
                    borderRadius: 35,
                    backgroundColor: T.primaryLight,
                    borderWidth: 2,
                    borderColor: T.primary,
                    borderStyle: "dashed",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 4,
                  }}
                >
                  <PawPrint size={34} color={T.primary} strokeWidth={1.75} />
                  <Text style={{ fontSize: 11, color: T.primary, fontFamily: FONT_BOLD }}>Add Photo</Text>
                </View>
              )}
            </View>
            <View
              style={{
                position: "absolute",
                right: -4,
                bottom: -4,
                width: 38,
                height: 38,
                borderRadius: 19,
                backgroundColor: T.primary,
                borderWidth: 3,
                borderColor: T.white,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Camera size={17} color="#fff" strokeWidth={2.25} />
            </View>
          </TouchableOpacity>
          <Text style={{ fontSize: 12, color: T.medium, fontFamily: FONT, marginTop: 12 }}>
            {preview ? "Tap to change photo" : "A clear photo helps owners trust your listing"}
          </Text>
        </View>

        <View style={{ paddingHorizontal: 16, gap: 16 }}>
          <FormSection icon={PawPrint} title="Basic Info">
            <Field label="Dog's Name *" value={form.name} onChangeText={(v) => set("name", v)} placeholder="e.g. Bella" maxLength={40} error={errors.name} />

            <Text style={{ fontSize: 13, color: T.dark, marginBottom: 6, fontFamily: FONT_MEDIUM }}>Breed *</Text>
            <BreedInput value={form.breed} onChange={(v) => set("breed", v)} error={errors.breed} />

            <Field
              label="Age (years) *"
              value={form.age}
              onChangeText={(v) => set("age", v)}
              placeholder="e.g. 2 or 0.5 for 6 months"
              keyboardType="decimal-pad"
              error={errors.age}
              style={{ marginBottom: 0 }}
            />
          </FormSection>

          <FormSection icon={Ruler} title="Physical Traits">
            <Text style={{ fontSize: 13, color: T.dark, marginBottom: 8, fontFamily: FONT_MEDIUM }}>Sex *</Text>
            <View style={{ flexDirection: "row", gap: 10, marginBottom: 18 }}>
              {(
                [
                  { id: "female", Icon: Venus, color: "#E0559B" },
                  { id: "male", Icon: Mars, color: T.accent },
                ] as const
              ).map(({ id, Icon, color }) => (
                <SegmentButton
                  key={id}
                  label={capitalize(id)}
                  active={form.sex === id}
                  onPress={() => set("sex", id)}
                  icon={<Icon size={18} color={form.sex === id ? color : T.light} strokeWidth={2.25} />}
                />
              ))}
            </View>

            <Text style={{ fontSize: 13, color: T.dark, marginBottom: 8, fontFamily: FONT_MEDIUM }}>Size *</Text>
            <View style={{ flexDirection: "row", gap: 10, marginBottom: 18 }}>
              {(["small", "medium", "large"] as const).map((s, i) => (
                <SegmentButton
                  key={s}
                  label={capitalize(s)}
                  active={form.size === s}
                  onPress={() => set("size", s)}
                  stacked
                  icon={<PawPrint size={14 + i * 5} color={form.size === s ? T.primary : T.light} strokeWidth={2} />}
                />
              ))}
            </View>

            <Text style={{ fontSize: 13, color: T.dark, marginBottom: 6, fontFamily: FONT_MEDIUM }}>Color *</Text>
            <ColorCombobox value={form.color} onChange={(v) => set("color", v)} />
            {errors.color ? <Text style={{ fontSize: 12, color: T.error, marginTop: -8, fontFamily: FONT }}>{errors.color}</Text> : null}
          </FormSection>

          <FormSection icon={Smile} title="Personality" subtitle="Pick up to 3 traits that describe your dog">
            <TemperamentPicker value={form.temperament} onChange={(v) => set("temperament", v)} />
            {errors.temperament ? <Text style={{ fontSize: 12, color: T.error, marginTop: 6, fontFamily: FONT }}>{errors.temperament}</Text> : null}
          </FormSection>

          <FormSection icon={FileText} title="About" subtitle="Optional">
            <Field
              value={form.description}
              onChangeText={(v) => set("description", v)}
              placeholder="Health history, personality, breeding experience…"
              multiline
              maxLength={1000}
              style={{ marginBottom: 0 }}
            />
          </FormSection>

          <TouchableOpacity
            onPress={submit}
            disabled={saving}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={existing ? "Save Changes" : "Add Dog Profile"}
            accessibilityState={{ disabled: saving, busy: saving }}
            style={{
              marginTop: 4,
              height: 56,
              borderRadius: 16,
              backgroundColor: T.primary,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
              opacity: saving ? 0.8 : 1,
              shadowColor: T.primary,
              shadowOffset: { width: 0, height: 10 },
              shadowOpacity: 0.3,
              shadowRadius: 18,
              elevation: 6,
            }}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                {existing ? <Check size={20} color="#fff" strokeWidth={2.5} /> : <Plus size={20} color="#fff" strokeWidth={2.5} />}
                <Text style={{ fontSize: 17, color: "#fff", fontFamily: FONT_BOLD }}>{existing ? "Save Changes" : "Add Dog Profile"}</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function FormSection({ icon: Icon, title, subtitle, children }: {
  icon: typeof PawPrint;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={{ backgroundColor: T.white, borderRadius: 22, padding: 18, ...shadow }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <View style={{ width: 34, height: 34, borderRadius: 11, backgroundColor: T.primaryLight, alignItems: "center", justifyContent: "center" }}>
          <Icon size={17} color={T.primary} strokeWidth={2.25} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 16, color: T.dark, fontFamily: FONT_BOLD }}>{title}</Text>
          {subtitle ? <Text style={{ fontSize: 12, color: T.medium, fontFamily: FONT, marginTop: 1 }}>{subtitle}</Text> : null}
        </View>
      </View>
      {children}
    </View>
  );
}

function SegmentButton({ label, active, onPress, icon, stacked }: {
  label: string;
  active: boolean;
  onPress: () => void;
  icon?: React.ReactNode;
  stacked?: boolean;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      accessibilityRole="radio"
      accessibilityState={{ selected: active }}
      style={{
        flex: 1,
        flexDirection: stacked ? "column" : "row",
        justifyContent: "center",
        gap: stacked ? 4 : 8,
        minHeight: stacked ? 66 : 50,
        paddingVertical: 10,
        borderRadius: 14,
        borderWidth: 1.5,
        borderColor: active ? T.primary : T.border,
        backgroundColor: active ? T.primaryLight : "#FAFAF9",
        alignItems: "center",
      }}
    >
      {icon}
      <Text style={{ fontSize: 14, color: active ? T.primaryDark : T.medium, fontFamily: FONT_BOLD }}>{label}</Text>
    </TouchableOpacity>
  );
}

export function AddDog() {
  return <DogForm />;
}

export function EditDog() {
  const { params, myDogs } = useApp();
  const dog = myDogs.find((d) => d.id === params.dogId);
  if (!dog) return <Loading />;
  return <DogForm existing={dog} />;
}

/* ── Owner profile (Figure 14) ──────────────────────────────────── */
export function OwnerProfile() {
  const { navigate, goBack, canGoBack, myDogs, signOut, switchPortal } = useApp();
  const session = useSession();
  const owner = session.owner;
  const memberSince = formatDate(session.user.created_at, { day: undefined });

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <Header title="My Profile" icon={User} onBack={canGoBack ? goBack : undefined} />
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        <View style={{ alignItems: "center", paddingVertical: 22, paddingHorizontal: 20, backgroundColor: T.white, gap: 4 }}>
          <View>
            <Avatar name={session.user.full_name} size={80} uri={api.avatarUrl(session.user.avatar_url)} />
            {owner?.verified_at && (
              <View style={{ position: "absolute", right: -4, bottom: -4 }}>
                <Award size={22} color={T.star} fill={T.star} strokeWidth={1.5} />
              </View>
            )}
          </View>
          <Text style={{ fontSize: 20, color: T.dark, fontFamily: FONT_BOLD, marginTop: 10 }}>{session.user.full_name}</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4, flexWrap: "wrap", justifyContent: "center" }}>
            <MapPin size={12} color={T.medium} />
            <Text style={{ fontSize: 13, color: T.medium, fontFamily: FONT }}>{session.user.location}</Text>
            <Text style={{ color: T.medium }}> • </Text>
            <Calendar size={12} color={T.medium} />
            <Text style={{ fontSize: 13, color: T.medium, fontFamily: FONT }}>Member since {memberSince}</Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 }}>
            <Stars rating={owner?.rating ?? 0} />
            <Text style={{ fontSize: 14, color: T.dark, fontFamily: FONT_BOLD }}>
              {owner && owner.review_count > 0 ? `${owner.rating.toFixed(1)} / 5.0` : "No reviews yet"}
            </Text>
          </View>
        </View>

        <View style={{ paddingHorizontal: 20, marginTop: 20 }}>
          <SectionTitle title="My Dogs" icon={PawPrint} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingBottom: 6 }}>
            {myDogs.map((dog) => (
              <TouchableOpacity
                key={dog.id}
                onPress={() => navigate("dog-profile", { dogId: dog.id })}
                style={{ alignItems: "center", gap: 6, padding: 12, borderRadius: 16, backgroundColor: T.white, width: 104, ...shadow }}
              >
                <View>
                  <DogImage uri={dog.img} width={64} height={64} />
                  <View style={{ position: "absolute", right: -6, bottom: -6, backgroundColor: T.white, borderRadius: 10 }}>
                    {dog.verified ? <CheckCircle size={18} color={T.success} /> : <Clock size={18} color={T.warning} />}
                  </View>
                </View>
                <Text style={{ fontSize: 13, color: T.dark, fontFamily: FONT_BOLD }} numberOfLines={1}>{dog.name}</Text>
                <Text style={{ fontSize: 11, color: T.medium, fontFamily: FONT, textAlign: "center" }} numberOfLines={2}>{dog.breed}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              onPress={() => navigate("add-dog")}
              style={{
                width: 90,
                minHeight: 126,
                borderRadius: 16,
                backgroundColor: T.primaryLight,
                borderWidth: 2,
                borderColor: T.primary + "60",
                borderStyle: "dashed",
                alignItems: "center",
                justifyContent: "center",
                gap: 4,
              }}
            >
              <Plus size={24} color={T.primary} strokeWidth={1.5} />
              <Text style={{ fontSize: 12, color: T.primary, fontFamily: FONT_BOLD }}>Add Dog</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>

        <Card style={{ marginHorizontal: 20, marginTop: 16 }} onPress={() => navigate("reputation")}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 }}>
            <Star size={16} color={T.dark} strokeWidth={1.6} />
            <Text style={{ fontSize: 14, color: T.dark, fontFamily: FONT_BOLD }}>Reputation & History</Text>
          </View>
          <Text style={{ fontSize: 12, color: T.medium, fontFamily: FONT }}>
            {owner?.completed_matches ?? 0} completed match{owner?.completed_matches === 1 ? "" : "es"} •{" "}
            {owner?.review_count ?? 0} review{owner?.review_count === 1 ? "" : "s"}
            {owner?.verified_at ? ` • Verified since ${formatDate(owner.verified_at, { day: undefined })}` : ""}
          </Text>
          <Text style={{ fontSize: 12, color: T.primary, fontFamily: FONT_BOLD, marginTop: 8 }}>View Full Reputation →</Text>
        </Card>

        {session.verifier && (
          <View style={{ paddingHorizontal: 20, marginTop: 20 }}>
            <View style={{ borderRadius: 16, overflow: "hidden" }}>
              <ListItem
                icon={Stethoscope}
                title="Switch to Vet / Breeder"
                subtitle={session.verifier.approved ? "Review documents sent to you" : "Your application is waiting for approval"}
                onPress={() => switchPortal("vet")}
                last
              />
            </View>
          </View>
        )}

        <View style={{ paddingHorizontal: 20, marginTop: 20 }}>
          <SectionTitle title="Settings" icon={Settings} />
          <View style={{ borderRadius: 16, overflow: "hidden" }}>
            <ListItem icon={MessageCircle} title="Requests & Messages" onPress={() => navigate("requests")} />
            <ListItem icon={Bell} title="Notifications" onPress={() => navigate("notifications")} />
            <ListItem icon={User} title="Edit Profile" onPress={() => navigate("edit-profile")} />
            <ListItem icon={KeyRound} title="Change Password" onPress={() => navigate("change-password")} />
            <ListItem icon={ShieldCheck} title="My Documents" onPress={() => navigate("verify-status")} />
            <ListItem icon={HelpCircle} title="Help & About" onPress={() => navigate("settings")} />
            <ListItem
              icon={LogOut}
              title="Log Out"
              danger
              last
              onPress={() => confirmAction("Log out?", "You'll need to sign in again to use PawMatch.", "Log Out", signOut)}
            />
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

/* ── Another owner's dog ────────────────────────────────────────── */
export function MatchProfileScreen() {
  const { navigate, goBack, params, activeDog } = useApp();
  const session = useSession();
  const dogId: string = params.dogId;
  const dog = useAsync(() => api.getDog(dogId), [dogId]);
  const existing = useAsync(
    () => (activeDog ? api.findOpenRequest(dogId, activeDog.id) : Promise.resolve(null)),
    [dogId, activeDog?.id],
  );

  const match = useMemo(() => {
    if (!dog.data || !activeDog || dog.data.sex === activeDog.sex) return null;
    const compatibility = computeCompatibility(activeDog, dog.data);
    return { dog: dog.data, compatibility, reasons: explainCompatibility(compatibility, dog.data.breed) };
  }, [dog.data, activeDog]);

  if (dog.loading) return <ScreenShell title="Dog Profile" onBack={goBack}><Loading /></ScreenShell>;
  if (dog.error || !dog.data) {
    return (
      <ScreenShell title="Dog Profile" onBack={goBack}>
        <ErrorView message={dog.error ?? "This dog profile is no longer available."} onRetry={dog.error ? () => dog.reload() : undefined} />
      </ScreenShell>
    );
  }

  const d = dog.data;
  const isMine = d.owner_id === session.user.id;
  const gallery = [d.img, ...d.photos].filter(Boolean) as string[];

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <Header title={`${d.name}'s Profile`} icon={PawPrint} onBack={goBack} />
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        <DogHeaderBlock dog={d} />
        <View style={{ padding: 20, gap: 14 }}>
          <Card style={{ gap: 10 }}>
            <SectionTitle title="Trust indicators" icon={ShieldCheck} />
            <TrustIndicators dog={d} />
            <Text style={{ fontSize: 12, color: T.medium, fontFamily: FONT }}>{TIER_DESCRIPTIONS[d.tier]}</Text>
            <TouchableOpacity onPress={() => navigate("audit-trail", { dogId: d.id })}>
              <Text style={{ fontSize: 13, color: T.primary, fontFamily: FONT_BOLD }}>View Audit Trail →</Text>
            </TouchableOpacity>
          </Card>

          {match && activeDog && (
            <Card style={{ gap: 12 }}>
              <SectionTitle
                title={`Compatibility with ${activeDog.name}`}
                icon={Star}
                right={<Text style={{ fontSize: 18, color: T.primary, fontFamily: FONT_BOLD }}>{match.compatibility.total}%</Text>}
              />
              <CompatibilityBreakdownCard match={match} />
            </Card>
          )}

          <BasicInfoCard dog={d} />

          {d.owner && (
            <Card onPress={() => navigate("reputation", { userId: d.owner_id })} style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <Avatar name={d.owner.display_name} size={48} uri={api.avatarUrl(d.owner.avatar_url)} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={{ fontSize: 15, color: T.dark, fontFamily: FONT_BOLD }}>{d.owner.display_name}</Text>
                <Text style={{ fontSize: 12, color: T.medium, fontFamily: FONT }}>{d.owner.location}</Text>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Stars rating={d.owner.rating} size={12} />
                  <Text style={{ fontSize: 12, color: T.medium, fontFamily: FONT }}>
                    {d.owner.review_count} review{d.owner.review_count === 1 ? "" : "s"} • {d.owner.completed_matches} matches
                  </Text>
                </View>
              </View>
              <ChevronRight size={18} color={T.light} />
            </Card>
          )}

          {gallery.length > 1 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
              {gallery.map((url) => (
                <DogImage key={url} uri={url} width={120} height={120} />
              ))}
            </ScrollView>
          )}

          {isMine ? (
            <Tag label="This is your dog" tone="info" />
          ) : existing.data ? (
            <Btn
              title="Open conversation"
              icon={MessageSquare}
              onPress={() => navigate("conversation", { requestId: existing.data!.id })}
            />
          ) : (
            <Btn title="Send Match Request" icon={Send} onPress={() => navigate("send-request", { dogId: d.id })} />
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function ScreenShell({ title, onBack, children }: { title: string; onBack: () => void; children: React.ReactNode }) {
  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <Header title={title} onBack={onBack} />
      {children}
    </View>
  );
}

/* ── Send breeding request ──────────────────────────────────────── */
export function SendRequest() {
  const { goBack, replace, params, myDogs, activeDog, setActiveDogId, showToast, navigate } = useApp();
  const dogId: string = params.dogId;
  const target = useAsync(() => api.getDog(dogId), [dogId]);
  const eligible = myDogs.filter((d) => target.data && d.sex !== target.data.sex);
  const mine = eligible.find((d) => d.id === activeDog?.id) ?? eligible[0] ?? null;
  const existing = useAsync(() => (mine ? api.findOpenRequest(dogId, mine.id) : Promise.resolve(null)), [dogId, mine?.id]);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  const compatibility = target.data && mine ? computeCompatibility(mine, target.data) : null;

  const send = async () => {
    if (!target.data || !mine) return;
    setSending(true);
    try {
      const request = await api.createRequest({
        dogId: target.data.id,
        myDogId: mine.id,
        message: message.trim() || `Hi! I'd like to discuss pairing ${mine.name} with ${target.data.name}.`,
        score: compatibility?.total ?? null,
      });
      showToast("Request sent", `${target.data.owner?.display_name ?? "The owner"} will be notified.`, "success");
      replace("conversation", { requestId: request.id });
    } catch (e) {
      showMessage("Couldn't send request", api.errorMessage(e));
    } finally {
      setSending(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: T.bg }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <Header title="Send Request" icon={Send} onBack={goBack} />
      {target.loading ? (
        <Loading />
      ) : target.error || !target.data ? (
        <ErrorView message={target.error ?? "This dog profile is no longer available."} />
      ) : (
        <ScrollView contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
          <Card style={{ gap: 10 }}>
            <Text style={{ fontSize: 13, color: T.medium, fontFamily: FONT_MEDIUM }}>Sending request to</Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <DogImage uri={target.data.img} width={52} height={52} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 16, color: T.dark, fontFamily: FONT_BOLD }}>{target.data.name}</Text>
                <Text style={{ fontSize: 12, color: T.medium, fontFamily: FONT }}>
                  {target.data.breed} • {target.data.owner?.display_name}
                </Text>
              </View>
              <VeriBadge tier={target.data.tier} />
            </View>
          </Card>

          {eligible.length === 0 ? (
            <Card>
              <EmptyState
                icon={PawPrint}
                title={`Add a ${target.data.sex === "male" ? "female" : "male"} dog first`}
                message="Breeding requests are sent on behalf of one of your dogs of the opposite sex."
                actionLabel="Add Dog Profile"
                onAction={() => navigate("add-dog")}
              />
            </Card>
          ) : (
            <>
              <Card style={{ gap: 12 }}>
                <MyDogSelector dogs={eligible} activeId={mine?.id} onSelect={setActiveDogId} label="On behalf of" />
                {compatibility && (
                  <View style={{ gap: 6 }}>
                    <Text style={{ fontSize: 13, color: T.dark, fontFamily: FONT_MEDIUM }}>Compatibility score</Text>
                    <ScoreBar score={compatibility.total} showLabel />
                  </View>
                )}
              </Card>

              {existing.data ? (
                <Card style={{ gap: 10 }}>
                  <Text style={{ fontSize: 14, color: T.dark, fontFamily: FONT_BOLD }}>You already have an active request</Text>
                  <Text style={{ fontSize: 13, color: T.medium, fontFamily: FONT }}>
                    Continue the conversation instead of sending a new request.
                  </Text>
                  <Btn title="Open conversation" icon={MessageSquare} onPress={() => replace("conversation", { requestId: existing.data!.id })} />
                </Card>
              ) : (
                <>
                  <Card style={{ gap: 8 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      <MessageSquare size={16} color={T.dark} strokeWidth={1.6} />
                      <Text style={{ fontSize: 14, color: T.dark, fontFamily: FONT_BOLD }}>Message (optional)</Text>
                    </View>
                    <TextInput
                      value={message}
                      onChangeText={setMessage}
                      placeholder={`Introduce ${mine?.name ?? "your dog"}, share health details or suggest a meet-up…`}
                      placeholderTextColor={T.light}
                      multiline
                      maxLength={2000}
                      style={{
                        minHeight: 110,
                        borderRadius: 12,
                        borderWidth: 1,
                        borderColor: T.border,
                        backgroundColor: T.bg,
                        padding: 12,
                        fontSize: 14,
                        color: T.dark,
                        fontFamily: FONT,
                        textAlignVertical: "top",
                      }}
                    />
                  </Card>
                  <Btn title="Send Request" icon={CheckCircle} size="large" loading={sending} onPress={send} />
                </>
              )}
            </>
          )}
        </ScrollView>
      )}
    </KeyboardAvoidingView>
  );
}
