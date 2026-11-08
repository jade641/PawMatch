import { Camera, CheckCircle, Clock, RotateCcw, Send, XCircle } from "lucide-react-native";
import { useState } from "react";
import { Image, Platform, ScrollView, Text, View } from "react-native";
import { FONT, FONT_BOLD, formatDate, T } from "../constants/theme";
import { useApp, useSession } from "../contexts/AppContext";
import { useAsync } from "../hooks/useAsync";
import * as api from "../services/api";
import { type PickedFile, takePhoto } from "../services/media";
import { Btn, Card, DogImage, ErrorView, Header, Loading, showMessage } from "./ui";

const CODE_LIFETIME_MS = 24 * 3600 * 1000;

function codeExpired(issuedAt: string) {
  return Date.now() - new Date(issuedAt).getTime() >= CODE_LIFETIME_MS;
}

function StatusCard({ icon: Icon, color, tint, title, text }: { icon: typeof Clock; color: string; tint: string; title: string; text: string }) {
  return (
    <Card style={{ alignItems: "center", gap: 10, paddingVertical: 24 }}>
      <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: tint, alignItems: "center", justifyContent: "center" }}>
        <Icon size={38} color={color} strokeWidth={1.75} />
      </View>
      <Text style={{ fontSize: 18, color: T.dark, fontFamily: FONT_BOLD, textAlign: "center" }}>{title}</Text>
      <Text style={{ fontSize: 14, color: T.medium, fontFamily: FONT, textAlign: "center", lineHeight: 20 }}>{text}</Text>
    </Card>
  );
}

function Step({ n, text }: { n: number; text: string }) {
  return (
    <View style={{ flexDirection: "row", gap: 12 }}>
      <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: T.primary, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ fontSize: 12, color: "#fff", fontFamily: FONT_BOLD }}>{n}</Text>
      </View>
      <Text style={{ flex: 1, fontSize: 14, color: T.dark, fontFamily: FONT, lineHeight: 20 }}>{text}</Text>
    </View>
  );
}

/* ── Owner: earn the "Photo Verified" badge ─────────────────────── */
export function PhotoVerificationScreen() {
  const { goBack, canGoBack, params, myDogs, dogsLoaded, showToast } = useApp();
  const session = useSession();
  const dog = myDogs.find((d) => d.id === params.dogId);
  const latest = useAsync(() => (dog ? api.getLatestPhotoVerification(dog.id) : Promise.resolve(null)), [dog?.id, dog?.photo_verified_at]);
  const [photo, setPhoto] = useState<PickedFile | null>(null);
  const [starting, setStarting] = useState(false);
  const [sending, setSending] = useState(false);

  const header = <Header title="Photo Verified Badge" icon={Camera} onBack={canGoBack ? goBack : undefined} />;

  if (!dogsLoaded) return <Loading />;
  if (!dog) {
    return (
      <View style={{ flex: 1, backgroundColor: T.bg }}>
        {header}
        <ErrorView message="This dog profile no longer exists." />
      </View>
    );
  }

  const start = async () => {
    setStarting(true);
    try {
      latest.setData(await api.startPhotoVerification(dog.id));
      setPhoto(null);
    } catch (e) {
      showMessage("Couldn't get a code", api.errorMessage(e));
    } finally {
      setStarting(false);
    }
  };

  const capture = async () => {
    // The browser would open a file picker, which would allow any saved image.
    if (Platform.OS === "web") {
      showMessage("Use your phone", "The verification photo has to be taken with the PawMatch app on your phone.");
      return;
    }
    const file = await takePhoto();
    if (file) setPhoto(file);
  };

  const submit = async () => {
    if (!photo || !latest.data) return;
    setSending(true);
    try {
      await api.submitPhotoVerification(latest.data.id, session.user.id, photo.uri, photo.mimeType);
      showToast("Photo sent for review", "You'll get a notification when it's checked.", "success");
      setPhoto(null);
      await latest.reload(true);
    } catch (e) {
      showMessage("Couldn't send the photo", api.errorMessage(e));
    } finally {
      setSending(false);
    }
  };

  const v = latest.data;
  const awaitingPhoto = v?.status === "awaiting_photo" && !codeExpired(v.code_issued_at);

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      {header}
      <ScrollView contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: 40 }}>
        <Card style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <DogImage uri={dog.img} width={52} height={52} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 16, color: T.dark, fontFamily: FONT_BOLD }}>{dog.name}</Text>
            <Text style={{ fontSize: 12, color: T.medium, fontFamily: FONT }}>{dog.breed}</Text>
          </View>
        </Card>

        {latest.loading ? (
          <Loading />
        ) : latest.error ? (
          <ErrorView message={latest.error} onRetry={() => latest.reload()} />
        ) : dog.photo_verified_at ? (
          <>
            <StatusCard
              icon={CheckCircle}
              color={T.success}
              tint={T.successLight}
              title={`${dog.name} is Photo Verified`}
              text={`The PawMatch team confirmed this listing on ${formatDate(dog.photo_verified_at)}.`}
            />
            <Text style={{ fontSize: 12, color: T.medium, fontFamily: FONT, textAlign: "center", lineHeight: 18 }}>
              Changing {dog.name}&apos;s main photo removes the badge, and you&apos;ll need to verify again.
            </Text>
          </>
        ) : v?.status === "pending" ? (
          <StatusCard
            icon={Clock}
            color={T.warning}
            tint={T.warningLight}
            title="Waiting for review"
            text="The PawMatch team is checking your photo. You'll get a notification when it's done."
          />
        ) : awaitingPhoto ? (
          <>
            <Card style={{ alignItems: "center", gap: 6, paddingVertical: 20 }}>
              <Text style={{ fontSize: 13, color: T.medium, fontFamily: FONT }}>Your code</Text>
              <Text selectable style={{ fontSize: 34, color: T.primaryDark, fontFamily: FONT_BOLD, letterSpacing: 2 }}>{v.code}</Text>
              <Text style={{ fontSize: 12, color: T.medium, fontFamily: FONT }}>Valid for 24 hours</Text>
            </Card>
            <Card style={{ gap: 12 }}>
              <Step n={1} text="Write the code clearly on a piece of paper." />
              <Step n={2} text={`Hold the paper next to ${dog.name}, so the code and the dog's face are both visible.`} />
              <Step n={3} text="Take the photo below. Saved or downloaded pictures aren't accepted." />
            </Card>
            {photo ? (
              <Image source={{ uri: photo.uri }} accessibilityLabel="Your verification photo" style={{ width: "100%", height: 320, borderRadius: 16, backgroundColor: T.bg }} resizeMode="contain" />
            ) : null}
            <Btn title={photo ? "Retake Photo" : "Take Photo"} icon={photo ? RotateCcw : Camera} variant={photo ? "outline" : "primary"} disabled={sending} onPress={capture} />
            {photo ? <Btn title="Send for Review" icon={Send} size="large" loading={sending} onPress={submit} /> : null}
          </>
        ) : (
          <>
            {v?.status === "rejected" ? (
              <StatusCard
                icon={XCircle}
                color={T.error}
                tint={T.errorLight}
                title="Photo not approved"
                text={v.review_notes ?? "Please try again with a clearer photo."}
              />
            ) : null}
            <Card style={{ gap: 12 }}>
              <Text style={{ fontSize: 15, color: T.dark, fontFamily: FONT_BOLD }}>Show owners that {dog.name} is real</Text>
              <Text style={{ fontSize: 14, color: T.medium, fontFamily: FONT, lineHeight: 20 }}>
                The badge tells other owners the PawMatch team confirmed this listing. You&apos;ll get a code, then take a photo of
                it next to your dog. Only you and the PawMatch team can see that photo, and it&apos;s deleted after review.
              </Text>
              {dog.img ? null : (
                <Text style={{ fontSize: 13, color: T.error, fontFamily: FONT }}>Add a profile photo of {dog.name} first.</Text>
              )}
            </Card>
            <Btn title={v?.status === "rejected" ? "Get a New Code" : "Get My Code"} icon={Camera} size="large" loading={starting} disabled={!dog.img} onPress={start} />
          </>
        )}
      </ScrollView>
    </View>
  );
}
