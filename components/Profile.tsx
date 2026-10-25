import Constants from "expo-constants";
import {
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
  Heart,
  HelpCircle,
  KeyRound,
  Lock,
  LogOut,
  Mars,
  MapPin,
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
import { KeyboardAvoidingView, Platform, ScrollView, Text, TouchableOpacity, View } from "react-native";
import {
  capitalize,
  DOC_TYPES,
  FONT,
  FONT_BOLD,
  FONT_MEDIUM,
  formatAge,
  formatDate,
  latestByType,
  oppositeSex,
  shadow,
  SUBMISSION_STATUS,
  T,
  TIER_DESCRIPTIONS,
} from "../constants/theme";
import { useApp, useLocationGate, useSession } from "../contexts/AppContext";
import { useAsync } from "../hooks/useAsync";
import * as api from "../services/api";
import { computeCompatibility, explainCompatibility } from "../services/compatibility";
import { pickImage, type PickedFile } from "../services/media";
import type { Dog, Sex, Size } from "../types";
import { BreedInput, ColorCombobox, MyDogSelector, TemperamentPicker, TemperamentTags, TrustIndicators } from "./DogWidgets";
import { CompatibilityBreakdownCard } from "./FloatingMatchResults";
import {
  Avatar,
  Btn,
  Card,
  confirmAction,
  CountBadge,
  DATA_DELETION_URL,
  DogImage,
  EmptyState,
  ErrorView,
  Field,
  Header,
  HeroHeader,
  HeroIconButton,
  InfoRow,
  ListItem,
  Loading,
  openLink,
  PRIVACY_URL,
  ScoreBar,
  SectionCard,
  SectionTitle,
  SegmentedTabs,
  SettingsGroup,
  SettingsProfileCard,
  showMessage,
  Stars,
  DarkModeToggle,
  Tag,
  TextLink,
  useThemeScrollRestore,
  VeriBadge,
} from "./ui";

/* ── Shared pieces ──────────────────────────────────────────────── */
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
      <TextLink label="View Audit Trail" onPress={onAudit} style={{ marginTop: 4, alignSelf: "flex-start" }} />
    </View>
  );
}

/* ── My Dog profile (Figure 15) ─────────────────────────────────── */
export function DogProfile() {
  const { navigate, params, myDogs, dogsLoaded, reloadDogs, activeDog, setActiveDogId, showToast, lastNotification } = useApp();
  const session = useSession();
  const [tab, setTab] = useState<"info" | "health" | "gallery">(params.tab ?? "info");
  const initialIndex = Math.max(0, myDogs.findIndex((d) => d.id === (params.dogId ?? activeDog?.id)));
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
    if (busy) return;
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
      if (busy) return;
      setBusy(true);
      try {
        if (url === dog.img) {
          const [next, ...rest] = dog.photos;
          await api.updateDog(dog.id, { img: next ?? null, photos: rest });
        } else {
          await api.updateDog(dog.id, { photos: dog.photos.filter((p) => p !== url) });
        }
        await reloadDogs();
        showToast("Photo removed", undefined, "success");
      } catch (e) {
        showMessage("Couldn't remove photo", api.errorMessage(e));
      } finally {
        setBusy(false);
      }
    }, true);

  const makeMain = async (url: string) => {
    if (busy) return;
    setBusy(true);
    try {
      await api.updateDog(dog.id, { img: url, photos: [...(dog.img ? [dog.img] : []), ...dog.photos.filter((p) => p !== url)] });
      await reloadDogs();
      showToast("Profile photo updated", undefined, "success");
    } catch (e) {
      showMessage("Couldn't update photo", api.errorMessage(e));
    } finally {
      setBusy(false);
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
        <SegmentedTabs
          tabs={[
            { id: "info", label: "Basic Info", icon: FileText },
            { id: "health", label: "Health", icon: Stethoscope },
            { id: "gallery", label: "Gallery", icon: Camera },
          ]}
          value={tab}
          onChange={setTab}
          style={{ marginHorizontal: 20, marginVertical: 16 }}
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
                        <Text style={{ fontSize: 12, color: T.error, fontFamily: FONT }}>
                          {s.notes ? `Not verified: ${s.notes}` : "Not verified — please upload a clearer copy."}
                        </Text>
                      )}
                    </View>
                    {s && s.status !== "verification_failed" ? (
                      <Tag label={SUBMISSION_STATUS[s.status].label} tone={SUBMISSION_STATUS[s.status].tone} />
                    ) : (
                      <TouchableOpacity
                        onPress={() => navigate("verify-upload", { dogId: dog.id, type: d.type })}
                        accessibilityRole="button"
                        accessibilityLabel={`${s ? "Re-upload" : "Upload"} ${d.label}`}
                        hitSlop={6}
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
                  <TouchableOpacity
                    onPress={() => url !== dog.img && makeMain(url)}
                    disabled={busy}
                    activeOpacity={0.8}
                    accessibilityRole="button"
                    accessibilityLabel={url === dog.img ? "Current profile photo" : "Make this the profile photo"}
                  >
                    <DogImage uri={url} width="100%" height={104} />
                  </TouchableOpacity>
                  {url === dog.img && (
                    <View style={{ position: "absolute", left: 6, bottom: 6 }}>
                      <Tag label="Profile" tone="brand" />
                    </View>
                  )}
                  <TouchableOpacity
                    onPress={() => removePhoto(url)}
                    disabled={busy}
                    accessibilityRole="button" accessibilityLabel="Remove photo"
                    hitSlop={10}
                    style={{ position: "absolute", right: 4, top: 4, width: 22, height: 22, borderRadius: 11, backgroundColor: "rgba(0,0,0,0.55)", alignItems: "center", justifyContent: "center" }}
                  >
                    <X size={13} color="#fff" />
                  </TouchableOpacity>
                </View>
              ))}
              <TouchableOpacity
                onPress={addPhoto}
                disabled={busy}
                accessibilityRole="button"
                accessibilityLabel="Add photo"
                accessibilityState={{ busy }}
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
                {busy ? <Text style={{ color: T.primary, fontFamily: FONT }}>Saving…</Text> : <Plus size={24} color={T.primary} strokeWidth={1.5} />}
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

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: T.bg }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <HeroHeader
          title={existing ? `Edit ${existing.name}` : "Add New Dog"}
          subtitle={existing ? "Keep your dog's profile up to date" : "Tell us about your furry friend"}
          onBack={goBack}
          overlap={62}
        />

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
          <SectionCard icon={PawPrint} title="Basic Info">
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
          </SectionCard>

          <SectionCard icon={Ruler} title="Physical Traits">
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
          </SectionCard>

          <SectionCard icon={Smile} title="Personality" subtitle="Pick up to 3 traits that describe your dog">
            <TemperamentPicker value={form.temperament} onChange={(v) => set("temperament", v)} />
            {errors.temperament ? <Text style={{ fontSize: 12, color: T.error, marginTop: 6, fontFamily: FONT }}>{errors.temperament}</Text> : null}
          </SectionCard>

          <SectionCard icon={FileText} title="About" subtitle="Optional">
            <Field
              value={form.description}
              onChangeText={(v) => set("description", v)}
              placeholder="Health history, personality, breeding experience…"
              multiline
              maxLength={1000}
              style={{ marginBottom: 0 }}
            />
          </SectionCard>

          <Btn
            title={existing ? "Save Changes" : "Add Dog Profile"}
            icon={existing ? Check : Plus}
            size="hero"
            loading={saving}
            onPress={submit}
            style={{ marginTop: 4 }}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
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
        backgroundColor: active ? T.primaryLight : T.inputBg,
        alignItems: "center",
      }}
    >
      {icon}
      <Text style={{ fontSize: 14, color: active ? T.primaryDark : T.medium, fontFamily: FONT_BOLD }}>{label}</Text>
    </TouchableOpacity>
  );
}

export function AddDog() {
  const needsLocation = useLocationGate();
  return needsLocation ? <Loading /> : <DogForm />;
}

export function EditDog() {
  const { params, myDogs, dogsLoaded, goBack } = useApp();
  const dog = myDogs.find((d) => d.id === params.dogId);
  if (!dog) {
    if (!dogsLoaded) return <Loading />;
    return (
      <ScreenShell title="Edit Dog" onBack={goBack}>
        <ErrorView message="This dog profile no longer exists." />
      </ScreenShell>
    );
  }
  return <DogForm existing={dog} />;
}

/* ── Owner profile (Figure 14) ──────────────────────────────────── */
export function OwnerProfile() {
  const { navigate, goBack, canGoBack, myDogs, switchPortal } = useApp();
  const session = useSession();
  const owner = session.owner;
  const memberSince = formatDate(session.user.created_at, { day: undefined });
  const hasReviews = !!owner && owner.review_count > 0;

  const stats = [
    { label: myDogs.length === 1 ? "Dog" : "Dogs", value: String(myDogs.length), go: () => navigate(myDogs.length ? "dog-profile" : "add-dog") },
    { label: owner?.completed_matches === 1 ? "Match" : "Matches", value: String(owner?.completed_matches ?? 0), go: () => navigate("reputation") },
    { label: hasReviews ? `${owner!.review_count} review${owner!.review_count === 1 ? "" : "s"}` : "No reviews", value: hasReviews ? `${owner!.rating.toFixed(1)}★` : "—", go: () => navigate("reputation") },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        <HeroHeader
          title="My Profile"
          subtitle="Your account, dogs and reputation"
          onBack={canGoBack ? goBack : undefined}
          overlap={56}
          right={
            <View style={{ flexDirection: "row", gap: 8 }}>
              <HeroIconButton icon={Edit} label="Edit profile" onPress={() => navigate("edit-profile")} />
              <HeroIconButton icon={Settings} label="Settings" onPress={() => navigate("owner-settings")} />
            </View>
          }
        />

        {/* Profile card overlapping the hero */}
        <View style={{ marginTop: -56, marginHorizontal: 20, borderRadius: 22, backgroundColor: T.white, padding: 18, ...shadow, elevation: 6 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
            <TouchableOpacity
              onPress={() => navigate("edit-profile")}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Change profile picture"
            >
              <View style={{ padding: 3, borderRadius: 40, backgroundColor: T.primaryLight }}>
                <Avatar name={session.user.full_name} size={68} uri={api.avatarUrl(session.user.avatar_url)} />
              </View>
              <View
                style={{
                  position: "absolute",
                  right: -2,
                  bottom: -2,
                  width: 26,
                  height: 26,
                  borderRadius: 13,
                  backgroundColor: T.primary,
                  borderWidth: 2.5,
                  borderColor: T.white,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Camera size={12} color="#fff" strokeWidth={2.5} />
              </View>
            </TouchableOpacity>

            <View style={{ flex: 1, gap: 4 }}>
              <Text style={{ fontSize: 18, color: T.dark, fontFamily: FONT_BOLD }} numberOfLines={2}>
                {session.user.full_name}
              </Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <MapPin size={12} color={T.medium} />
                <Text style={{ fontSize: 12, color: T.medium, fontFamily: FONT, flexShrink: 1 }} numberOfLines={1}>
                  {session.user.location}
                </Text>
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <Calendar size={12} color={T.medium} />
                <Text style={{ fontSize: 12, color: T.medium, fontFamily: FONT }}>Member since {memberSince}</Text>
              </View>
              <View style={{ marginTop: 2 }}>
                {owner?.verified_at ? (
                  <Tag label="✓ Verified Owner" tone="success" />
                ) : (
                  <Tag label="Not yet verified" tone="warning" />
                )}
              </View>
            </View>
          </View>

          <View style={{ flexDirection: "row", marginTop: 16, paddingTop: 14, borderTopWidth: 1, borderTopColor: T.bg }}>
            {stats.map((s, i) => (
              <TouchableOpacity
                key={i}
                onPress={s.go}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={`${s.value === "—" ? "No" : s.value} ${s.label}`}
                style={{ flex: 1, alignItems: "center", borderLeftWidth: i === 0 ? 0 : 1, borderLeftColor: T.border }}
              >
                <Text style={{ fontSize: 20, color: T.dark, fontFamily: FONT_BOLD }}>{s.value}</Text>
                <Text style={{ fontSize: 12, color: T.medium, fontFamily: FONT, marginTop: 2 }}>{s.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={{ paddingHorizontal: 20, marginTop: 24 }}>
          <SectionTitle title="My Dogs" icon={PawPrint} />
          {myDogs.length === 0 ? (
            <TouchableOpacity
              onPress={() => navigate("add-dog")}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Add your first dog"
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 14,
                padding: 16,
                borderRadius: 18,
                backgroundColor: T.primaryLight,
                borderWidth: 2,
                borderColor: T.primary + "50",
                borderStyle: "dashed",
              }}
            >
              <View style={{ width: 48, height: 48, borderRadius: 16, backgroundColor: T.primary, alignItems: "center", justifyContent: "center" }}>
                <Plus size={24} color="#fff" strokeWidth={2.25} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 15, color: T.primaryDark, fontFamily: FONT_BOLD }}>Add your first dog</Text>
                <Text style={{ fontSize: 12, color: T.medium, fontFamily: FONT, marginTop: 2, lineHeight: 17 }}>
                  Create a profile to start getting compatible matches.
                </Text>
              </View>
              <ChevronRight size={20} color={T.primaryDark} />
            </TouchableOpacity>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingBottom: 6 }}>
              {myDogs.map((dog) => (
                <TouchableOpacity
                  key={dog.id}
                  onPress={() => navigate("dog-profile", { dogId: dog.id })}
                  accessibilityRole="button"
                  accessibilityLabel={`${dog.name}, ${dog.breed}, ${dog.verified ? `Tier ${dog.tier} verified` : "not yet verified"}`}
                  style={{ alignItems: "center", gap: 6, padding: 12, borderRadius: 16, backgroundColor: T.white, width: 112, ...shadow }}
                >
                  <View>
                    <DogImage uri={dog.img} width={72} height={72} radius={36} />
                    <View style={{ position: "absolute", right: -4, bottom: -4, backgroundColor: T.white, borderRadius: 10 }}>
                      {dog.verified ? <CheckCircle size={18} color={T.success} /> : <Clock size={18} color={T.warning} />}
                    </View>
                  </View>
                  <Text style={{ fontSize: 13, color: T.dark, fontFamily: FONT_BOLD }} numberOfLines={1}>{dog.name}</Text>
                  <Text style={{ fontSize: 11, color: T.medium, fontFamily: FONT, textAlign: "center" }} numberOfLines={1}>{dog.breed}</Text>
                  <VeriBadge tier={dog.tier} />
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                onPress={() => navigate("add-dog")}
                accessibilityRole="button"
                accessibilityLabel="Add dog"
                style={{
                  width: 96,
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
                <Plus size={24} color={T.primary} strokeWidth={1.75} />
                <Text style={{ fontSize: 12, color: T.primaryDark, fontFamily: FONT_BOLD }}>Add Dog</Text>
              </TouchableOpacity>
            </ScrollView>
          )}
        </View>

        <Card
          style={{ marginHorizontal: 20, marginTop: 20, flexDirection: "row", alignItems: "center", gap: 14, borderRadius: 18 }}
          onPress={() => navigate("reputation")}
          accessibilityLabel="Reputation and history"
        >
          <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: T.secondaryLight, alignItems: "center", justifyContent: "center" }}>
            <Star size={22} color={T.secondaryDark} fill={hasReviews ? T.secondary : "transparent"} strokeWidth={2} />
          </View>
          <View style={{ flex: 1, gap: 3 }}>
            <Text style={{ fontSize: 15, color: T.dark, fontFamily: FONT_BOLD }}>Reputation & History</Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Stars rating={owner?.rating ?? 0} size={12} />
              <Text style={{ fontSize: 12, color: T.medium, fontFamily: FONT }}>
                {hasReviews ? `${owner!.rating.toFixed(1)} / 5.0` : "No reviews yet"}
              </Text>
            </View>
            <Text style={{ fontSize: 12, color: T.medium, fontFamily: FONT }}>Badges, reviews and match history</Text>
          </View>
          <ChevronRight size={20} color={T.light} />
        </Card>

        {session.verifier && (
          <View style={{ marginHorizontal: 20, marginTop: 16, borderRadius: 18, overflow: "hidden", ...shadow }}>
            <ListItem
              icon={Stethoscope}
              title="Switch to Vet / Breeder"
              subtitle={session.verifier.approved ? "Review documents sent to you" : "Your application is waiting for approval"}
              onPress={() => switchPortal("vet")}
              last
            />
          </View>
        )}
      </ScrollView>
    </View>
  );
}

/* ── Owner settings ─────────────────────────────────────────────── */
export function OwnerSettings() {
  const { navigate, goBack, canGoBack, myDogs, signOut, switchPortal, unreadCount } = useApp();
  const session = useSession();
  const version = Constants.expoConfig?.version ?? "1.0.0";
  const verifiedDogs = myDogs.filter((d) => d.verified).length;
  const scroll = useThemeScrollRestore();

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <ScrollView {...scroll} contentContainerStyle={{ paddingBottom: 32 }}>
        <HeroHeader title="Settings" subtitle="Manage your PawMatch account" onBack={canGoBack ? goBack : undefined} overlap={36} />

        <View style={{ marginTop: -36, paddingHorizontal: 20, gap: 22 }}>
          <SettingsProfileCard
            name={session.user.full_name}
            email={session.user.email}
            avatarUri={api.avatarUrl(session.user.avatar_url)}
            onPress={() => navigate("edit-profile")}
          />

          <SettingsGroup title="ACCOUNT">
            <ListItem icon={User} title="Edit Profile" subtitle="Name, phone, location and photo" onPress={() => navigate("edit-profile")} />
            <ListItem icon={KeyRound} title="Change Password" subtitle="Keep your account secure" onPress={() => navigate("change-password")} />
            <ListItem
              icon={Bell}
              title="Notifications"
              subtitle="Match requests, messages and verification updates"
              onPress={() => navigate("notifications")}
              right={unreadCount > 0 ? <CountBadge count={unreadCount} /> : undefined}
              last
            />
          </SettingsGroup>

          <SettingsGroup title="MY DOGS">
            <ListItem
              icon={PawPrint}
              title="Manage Dogs"
              subtitle={myDogs.length ? `${myDogs.length} dog${myDogs.length === 1 ? "" : "s"} • ${verifiedDogs} verified` : "You haven't added a dog yet"}
              onPress={() => navigate(myDogs.length ? "dog-profile" : "add-dog")}
            />
            <ListItem icon={Plus} title="Add a Dog" subtitle="Create a new dog profile" onPress={() => navigate("add-dog")} />
            <ListItem icon={Upload} title="Upload Documents" subtitle="Vaccination card, health clearance, pedigree" onPress={() => navigate(myDogs.length ? "verify-upload" : "add-dog")} />
            <ListItem icon={ShieldCheck} title="Verification Status" subtitle="Track documents sent to verifiers" onPress={() => navigate(myDogs.length ? "verify-status" : "add-dog")} last />
          </SettingsGroup>

          <SettingsGroup title="MATCHING">
            <ListItem icon={Heart} title="Find Matches" subtitle="Filter and browse compatible dogs" onPress={() => navigate("filter")} />
            <ListItem icon={MessageSquare} title="Match Requests" subtitle="Sent, received and ongoing conversations" onPress={() => navigate("requests")} />
            <ListItem icon={Star} title="Reputation & Reviews" subtitle="Badges, reviews and match history" onPress={() => navigate("reputation")} last />
          </SettingsGroup>

          <SettingsGroup title="APPEARANCE">
            <View style={{ padding: 14 }}>
              <DarkModeToggle />
            </View>
          </SettingsGroup>

          {(session.verifier || session.user.role === "admin") && (
            <SettingsGroup title="PORTALS">
              {session.verifier && (
                <ListItem
                  icon={Stethoscope}
                  title="Switch to Vet / Breeder"
                  subtitle={session.verifier.approved ? "Review documents sent to you" : "Your application is waiting for approval"}
                  onPress={() => switchPortal("vet")}
                  last={session.user.role !== "admin"}
                />
              )}
              {session.user.role === "admin" && (
                <ListItem icon={ShieldCheck} title="Admin Panel" subtitle="Approve vets and breeders" onPress={() => navigate("admin-verifiers")} last />
              )}
            </SettingsGroup>
          )}

          <SettingsGroup title="SUPPORT & PRIVACY">
            <ListItem icon={HelpCircle} title="Help & About" subtitle="How matching and verification work, contact support" onPress={() => navigate("settings")} />
            <ListItem icon={Lock} title="Privacy Policy" subtitle="What we collect and how it's used" onPress={() => openLink(PRIVACY_URL)} />
            <ListItem icon={Trash2} title="Delete Account & Data" subtitle="How to request deletion of your data" onPress={() => openLink(DATA_DELETION_URL)} last />
          </SettingsGroup>

          <View style={{ borderRadius: 18, overflow: "hidden", ...shadow }}>
            <ListItem
              icon={LogOut}
              title="Log Out"
              danger
              last
              onPress={() => confirmAction("Log out?", "You'll need to sign in again to use PawMatch.", "Log Out", signOut)}
            />
          </View>

          <Text style={{ fontSize: 12, color: T.medium, fontFamily: FONT, textAlign: "center" }}>
            PawMatch Mobile • Version {version} (beta)
          </Text>
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
            <TextLink label="View Audit Trail" onPress={() => navigate("audit-trail", { dogId: d.id })} style={{ alignSelf: "flex-start" }} />
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
  const needsLocation = useLocationGate();
  return needsLocation ? <Loading /> : <SendRequestForm />;
}

function SendRequestForm() {
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
        <ErrorView
          message={target.error ?? "This dog profile is no longer available."}
          onRetry={target.error ? () => target.reload() : undefined}
        />
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
                title={`Add a ${oppositeSex(target.data.sex)} dog first`}
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
                    <Field
                      value={message}
                      onChangeText={setMessage}
                      placeholder={`Introduce ${mine?.name ?? "your dog"}, share health details or suggest a meet-up…`}
                      multiline
                      maxLength={2000}
                      style={{ marginBottom: 0 }}
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
